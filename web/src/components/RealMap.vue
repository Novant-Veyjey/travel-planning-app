<template>
  <div class="real-map" ref="mapRef" :class="{ night: isNight }"
       @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp"
       @pointercancel="onUp" @pointerleave="onUp" @dblclick.prevent="onDblClick"
       @wheel.prevent="onWheel">
    <svg class="canvas" :width="size.w" :height="size.h">
      <defs>
        <linearGradient id="rm-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" class="rm-g1" stop-color="#eaf4dd" />
          <stop offset="1" class="rm-g2" stop-color="#dbeac6" />
        </linearGradient>
      </defs>
      <rect :width="size.w" :height="size.h" fill="url(#rm-ground)" />

      <!-- 真实水系：湖泊多边形 + 河流/海岸折线（真实经纬度处呈现） -->
      <polygon v-for="(w, i) in lakes" :key="'lk'+i" :points="polyPoints(w.坐标)" class="water-fill" />
      <polyline v-for="(w, i) in rivers" :key="'rv'+i" :points="polyPoints(w.坐标)" class="water-line" />

      <!-- 真实道路：白边 + 路面 -->
      <polyline v-for="(r, i) in roads" :key="'rc'+i" :points="polyPoints(r.坐标)" class="road-casing" />
      <polyline v-for="(r, i) in roads" :key="'rd'+i" :points="polyPoints(r.坐标)"
                :class="r.类型 === '环线' ? 'road road-ring' : 'road'" />

      <!-- 街区建筑：成片分布的普通楼房（确定性生成，平移不漂移）。
           三面各自带明暗（正面原色 / 侧面压暗 / 顶面提亮），光从左上打来，
           缩放到任何级别都是一栋有体积的楼，而不是一块扁平方块 -->
      <g class="blocks">
        <g v-for="b in streetBlocks" :key="b.key" :data-key="b.key">
          <ellipse :cx="b.x + b.w * 0.28" :cy="b.y" :rx="b.w * 0.56" :ry="b.w * 0.2" class="b-shadow" />
          <g class="blocks-body">
            <polygon :points="b.front" :fill="b.cFront" />
            <polygon :points="b.side" :fill="b.cSide" />
            <polygon :points="b.top" :fill="b.cTop" />
          </g>
        </g>
      </g>

      <!-- 只画一段虚线：当前位置 → 下一个要去的地方 -->
      <template v-if="guideTarget">
        <defs>
          <marker id="rm-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#ff8b00" />
          </marker>
        </defs>
        <line v-if="me" :x1="me.x" :y1="me.y" :x2="guideTarget.x" :y2="guideTarget.y"
              class="guide-line" marker-end="url(#rm-arrow)" />
      </template>
      <!-- 其余打卡点之间不画连线，用序号气泡 + 状态配色 + "下一站"角标表示顺序 -->

      <!-- 特征建筑：按真实形制绘制（楼阁/塔/宫殿/穹顶/电视塔/大佛/桥/城楼…） -->
      <g v-for="(b, i) in visibleBuildings" :key="'b'+i">
        <ellipse :cx="b.x" :cy="b.y" :rx="b.w / 2" :ry="b.w * 0.22" class="b-shadow" />
        <!-- 形体整体压暗（夜里），灯光单独亮起 -->
        <g class="bldg-body">
          <path v-for="(pt, pi) in b.parts" :key="'pt' + pi" :d="pt.d"
                :fill="pt.fill" :stroke="pt.stroke || 'none'" :stroke-width="pt.sw || 0.5" />
        </g>
        <circle v-for="(wd, wi) in b.windows" :key="'w' + wi" :cx="wd.x" :cy="wd.y"
                :r="wd.r || 1.7" class="b-window" />
        <text :x="b.x" :y="b.y - b.h - 3" class="b-ico">{{ b.ico }}</text>
        <text v-if="b.显示名称" :x="b.x" :y="b.y + 13" class="b-label">{{ b.名称 }}</text>
      </g>

      <!-- 行程打卡点：气泡挂在建筑侧边（不压楼体），引线指回真实点位 -->
      <g v-for="(p, i) in pinList" :key="'p'+i" :class="'mark mark-' + p.状态">
        <ellipse :cx="p.x" :cy="p.y" rx="6" ry="2.6" class="mark-shadow" />
        <polyline :points="p.lead" class="mark-lead" />
        <circle :cx="p.bx" :cy="p.by" r="13" class="mark-bg" />
        <text :x="p.bx" :y="p.by + 5" class="mark-ico">{{ iconOf(p.名称) }}</text>
        <text :x="p.x" :y="p.y + 17" class="mark-name">{{ i + 1 }}. {{ p.名称 }}</text>
        <text v-if="i === nextIndex" :x="p.bx" :y="p.by - 19" class="mark-next">下一站</text>
      </g>

      <!-- 周边推荐点 -->
      <circle v-for="(n, i) in nearbyPins" :key="'n'+i" :cx="n.x" :cy="n.y" r="3.5" class="nearby-dot" />

      <!-- 立体山峰：当地山地按真实坐标绘制（左右两面 + 雪顶，越高的山越大） -->
      <g v-for="(m, i) in mountains" :key="'mt'+i">
        <ellipse :cx="m.x" :cy="m.y" :rx="m.r" :ry="m.r * 0.32" class="mt-shadow" />
        <polygon :points="`${m.x - m.r},${m.y} ${m.x},${m.y - m.h} ${m.x},${m.y}`" class="mt-left" />
        <polygon :points="`${m.x},${m.y - m.h} ${m.x + m.r},${m.y} ${m.x},${m.y}`" class="mt-right" />
        <polygon :points="`${m.x - m.r * 0.36},${m.y - m.h * 0.58} ${m.x},${m.y - m.h} ${m.x + m.r * 0.36},${m.y - m.h * 0.58} ${m.x + m.r * 0.1},${m.y - m.h * 0.66} ${m.x - m.r * 0.12},${m.y - m.h * 0.62}`" class="mt-snow" />
        <text :x="m.x" :y="m.y + 12" class="mt-label">{{ m.ico }} {{ m.名称 }}</text>
      </g>

      <!-- 当地植被：按真实地理位置散布（景点/山地周边 + 稳定散布） -->
      <text v-for="(f, i) in floraSpots" :key="'fl'+i" :x="f.x" :y="f.y"
            :style="{ fontSize: f.size + 'px' }" class="flora-ico">{{ f.ico }}</text>

      <!-- 真实地形/特色要素：真实经纬度处的卡通标注 -->
      <g v-for="(t, i) in terrainList" :key="'t'+i">
        <ellipse :cx="t.x" :cy="t.y" rx="12" ry="4" class="mark-shadow" />
        <rect :x="t.x - 34" :y="t.y - 30" width="68" height="17" rx="8.5" class="terrain-pill" />
        <text :x="t.x" :y="t.y - 18" class="terrain-text">{{ t.ico }} {{ t.名称 }}</text>
      </g>

      <!-- 我的人物建模：站在真实 GPS 坐标上，服饰随当地民族传统服饰变化；
           与打卡点重合时人物错开一点，真实坐标处留光点 + 引线 -->
      <g v-if="me" class="avatar-me">
        <circle :cx="me.x" :cy="me.y - 8" r="16" class="me-pulse" />
        <template v-if="avatarOff.x || avatarOff.y">
          <circle :cx="me.x" :cy="me.y" r="2.6" class="me-dot" />
          <line :x1="me.x" :y1="me.y" :x2="meDraw.x" :y2="meDraw.y" class="me-lead" />
        </template>
        <!-- 朝向锥：贴地指向当前行进方向（画在人偶脚下） -->
        <polygon v-if="heading !== null" :points="headingPath" class="me-cone" />
        <FigureAvatar :x="meDraw.x" :y="meDraw.y" :scale="0.98" :costume="costume" />
        <text :x="meDraw.x" :y="meDraw.y + 14" class="me-tag">📍 我的位置 · {{ costume.服饰 }}</text>
      </g>
    </svg>

    <!-- 夜晚星空：只铺在画面上半部（天上），往下渐隐，
         星星挂在天上而不是压在地面建筑上；不随地图平移缩放，只缓慢闪烁 -->
    <div v-if="isNight" class="star-layer">
      <span v-for="(s, i) in stars" :key="'st' + i" class="star" :class="{ 'star-glow': s.glow }"
            :style="{ left: s.left + '%', top: s.top + '%', width: s.d + 'px',
                      height: s.d + 'px', animationDelay: s.delay + 's',
                      animationDuration: s.dur + 's' }"></span>
    </div>

    <!-- 天气：与当地当前天气一致（雨天落雨、雪天飘雪、晴天出太阳、夜晚出月亮） -->
    <div v-if="isRain || isSnow" class="wx-tint" :class="isSnow ? 'tint-snow' : 'tint-rain'"></div>
    <div v-if="isRain" class="wx-layer">
      <!-- 夜里雨点更密、颜色更亮，压在深色底上才看得清 -->
      <span v-for="n in (isNight ? 52 : 34)" :key="'r'+n" class="wx-drop"
            :style="{ left: (n * 29) % 100 + '%', animationDelay: (n * 0.11) + 's' }"></span>
    </div>
    <div v-if="isSnow" class="wx-layer">
      <span v-for="n in (isNight ? 34 : 24)" :key="'s'+n" class="wx-flake"
            :style="{ left: (n * 37) % 100 + '%', animationDelay: (n * 0.17) + 's' }">❄</span>
    </div>
    <div v-if="isNight" class="wx-moon">🌙 <em>{{ temp }}°</em></div>
    <div v-else-if="isSun" class="wx-sun">☀️ <em>{{ temp }}°</em></div>

    <!-- 比例尺 -->
    <div class="scale-bar">
      <div class="scale-line" :style="{ width: scale.px + 'px' }"></div>
      <span>{{ scale.text }}</span>
    </div>

    <!-- 缩放控件：不要让 pointerdown 冒泡到地图，否则会立刻中止刚触发的缩放动画 -->
    <div class="zoom-ctl" @pointerdown.stop @dblclick.stop>
      <button @click="zoomIn" title="放大">＋</button>
      <button @click="zoomOut" title="缩小">－</button>
      <button @click="fitView(true)" title="全览真实地理要素">⛶</button>
      <button @click="recenter" title="回到我的位置">◎</button>
    </div>

    <div class="gps-chip">🛰 {{ gpsText }}</div>
    <!-- 当前人物服饰：随当地民族传统服饰变化 -->
    <div class="costume-chip" :title="`${costume.民族}传统服饰`">
      🪡 {{ costume.服饰 }}<em>{{ costume.民族 }}</em>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from "vue";
import { api } from "../api/index.js";
import { assignIcons } from "../assets/poiIcon.js";
import FigureAvatar from "./FigureAvatar.vue";
import { DEFAULT_COSTUME } from "../assets/ethnicCostume.js";
import { buildingShapeOf, buildBuildingShape, SHAPE_SIZE, SHAPE_NAMES } from "../assets/cityBuilding.js";

const props = defineProps({
  city: { type: String, default: "" },
  user: { type: Object, default: () => ({ lat: null, lon: null }) },
  pins: { type: Array, default: () => [] }, // [{名称, 纬度, 经度, 状态}]
  icons: { type: Object, default: () => ({}) }, // 名称 → 卡通图标
  nextIndex: { type: Number, default: -1 }, // 下一站下标（画指引线）
  terrains: { type: Array, default: () => [] }, // 真实地形标注 [{名称, 纬度, 经度, ico}]
  flora: { type: Array, default: () => [] }, // 目的地植被卡通图标
  costume: { type: Object, default: () => ({}) }, // 当地民族传统服饰（人物建模换装）
  weather: { type: Object, default: () => ({}) }, // 当地天气场景（雨/雪/晴）
  temp: { type: [Number, String], default: "" }, // 当地温度
  gpsState: { type: String, default: "idle" },
  height: { type: Number, default: 420 },
  radiusKm: { type: Number, default: 1.5 },
});
const emit = defineEmits(["nearby"]);

const mapRef = ref(null);
const size = reactive({ w: 360, h: props.height });
const geo = reactive({ 水系: [], 道路: [], 建筑: [], 中心: null });
const center = reactive({ lat: 30.665, lon: 104.075 });
const zoom = ref(16);
const nearby = ref([]);
const me = ref(null);
const heading = ref(null);
let lastFix = { lat: null, lon: null };
let lastNearbyAt = 0;

const gpsText = computed(() =>
  props.gpsState === "on" ? "GPS 定位" : props.gpsState === "err" ? "模拟定位" : "待定位"
);

/* ============ Web Mercator 投影 ============ */
function mercY(lat) {
  const s = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
}
function project(lat, lon) {
  const scale = 256 * Math.pow(2, zoom.value);
  const cx = ((center.lon + 180) / 360) * scale;
  const cy = mercY(center.lat) * scale;
  return {
    x: size.w / 2 + (((lon + 180) / 360) * scale - cx),
    y: size.h / 2 + (mercY(lat) * scale - cy),
  };
}
function unproject(px, py) {
  const scale = 256 * Math.pow(2, zoom.value);
  const mx = px - size.w / 2 + ((center.lon + 180) / 360) * scale;
  const my = py - size.h / 2 + mercY(center.lat) * scale;
  const n = Math.PI - 2 * Math.PI * (my / scale);
  return {
    lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
    lon: (mx / scale) * 360 - 180,
  };
}
const metersPerPixel = computed(
  () => (156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / Math.pow(2, zoom.value)
);

/* ============ 图层 ============ */
const rivers = computed(() => geo.水系.filter((w) => w.类型 !== "湖泊"));
const lakes = computed(() => geo.水系.filter((w) => w.类型 === "湖泊"));
const roads = computed(() => geo.道路);

function polyPoints(coords) {
  return (coords || [])
    .map(([la, lo]) => {
      const p = project(la, lo);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");
}

function hashOf(s) {
  let h = 5381;
  for (const c of String(s || "")) h = (h * 33 + c.codePointAt(0)) % 100003;
  return h;
}

/* 颜色明暗：amt > 0 提亮（往白靠），amt < 0 压暗（往黑靠）。
   楼房三面用同一个基色派生出不同明度，立体感才自然统一 */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))))
  );
  return `#${ch.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/* ============ 天气（与当地实时天气一致：雨天落雨、雪天飘雪、晴天出太阳） ============ */
const scene = computed(() => props.weather?.场景 || "sunny");
const isRain = computed(() => scene.value === "rainy" || (props.weather?.雨滴 || 0) > 0);
const isSnow = computed(() => scene.value === "snowy" || (props.weather?.雪花 || 0) > 0);
const isSun = computed(() => !isRain.value && !isSnow.value);

/* ============ 夜晚模式：19:00–06:00 切深色底图 + 星空（下雨再叠雨点） ============ */
const NIGHT_FROM = 19; // 19:00 入夜
const NIGHT_TO = 6; // 次日 06:00 天亮
const nightNow = ref(Date.now());
let nightTimer = null;

const isNight = computed(() => {
  // 支持 ?night=1 / ?night=0 手动预览；默认按本机当地时间判断
  const forced = new URLSearchParams(location.search).get("night");
  if (forced === "1") return true;
  if (forced === "0") return false;
  const h = new Date(nightNow.value).getHours();
  return h >= NIGHT_FROM || h < NIGHT_TO;
});

// 星空：位置由城市名派生的稳定伪随机数生成（同一城市星图一致），
// 用百分比固定在"天上"那一层，平移缩放地图时星点不会跟着滑动。
// 少量亮星带光晕、大小与闪烁节奏各不相同，星点才不会看起来像均匀噪点
const stars = computed(() => {
  const seed = hashOf(props.city || "sky");
  const out = [];
  for (let i = 0; i < 64; i++) {
    const a = (seed + i * 613) % 997;
    const b = (seed + i * 389) % 991;
    const big = a % 7 === 0; // 约七分之一是亮星
    out.push({
      left: +((a / 997) * 100).toFixed(2),
      top: +((b / 991) * 100).toFixed(2),
      d: +(big ? 2.6 + ((a >> 4) % 3) * 0.4 : 0.9 + ((a >> 3) % 3) * 0.7).toFixed(1),
      delay: +((b % 44) / 11).toFixed(1),
      dur: +(2.4 + (b % 17) / 7).toFixed(1),
      glow: big,
    });
  }
  return out;
});

/* ============ 立体山峰：当地山地按真实坐标绘制 ============ */
const mountains = computed(() =>
  props.terrains
    .filter((t) => t.isMountain && t.纬度 != null && t.经度 != null)
    .map((t) => {
      const p = project(t.纬度, t.经度);
      const seed = hashOf(t.名称);
      return { ...t, ...p, r: 20 + (seed % 14), h: 28 + (seed % 24) };
    })
    .filter((m) => m.x > -60 && m.x < size.w + 60 && m.y > -80 && m.y < size.h + 60)
);

/* ============ 当地植被：依附真实地形/景点周边 + 稳定散布 ============ */
const floraSpots = computed(() => {
  if (!props.flora.length) return [];
  const out = [];
  const anchors = [...mountains.value, ...terrainList.value].slice(0, 8);
  anchors.forEach((a, i) => {
    out.push({ ico: props.flora[(i * 2) % props.flora.length], x: a.x + 28, y: a.y + 3, size: 15 });
    out.push({ ico: props.flora[(i * 2 + 1) % props.flora.length], x: a.x - 28, y: a.y - 1, size: 13 });
  });
  // 补白植被按"城市中心周围真实经纬度"散布（不是屏幕百分比），
  // 这样平移/缩放时它们跟建筑、标注一起移动，不会像浮层一样滑动
  const anchorPt = geo.中心 || [center.lat, center.lon];
  const seed = hashOf(props.city);
  for (let i = 0; i < 8; i++) {
    const s = (seed + i * 977) % 997;
    const meters = 300 + (s % 70) * 30; // 300m ~ 2.4km
    const ang = (((s >> 3) % 360) * Math.PI) / 180;
    const lat = anchorPt[0] + (meters * Math.cos(ang)) / 111320;
    const lon =
      anchorPt[1] +
      (meters * Math.sin(ang)) / (111320 * Math.cos((anchorPt[0] * Math.PI) / 180));
    const p = project(lat, lon);
    out.push({ ico: props.flora[i % props.flora.length], x: p.x, y: p.y, size: 12 + (s % 5) });
  }
  return out.filter((f) => f.x > 0 && f.x < size.w && f.y > 0 && f.y < size.h);
});

/* ============ 街区建筑：按"可见范围内的固定经纬网格"确定性生成 ============
 * 地标建筑只有 6–18 个，放大后没东西可看；这里按 ~90m 网格补普通楼房。
 * 关键一：每格的取舍/高度/配色都由 (城市+格号) 哈希决定，与当前视野无关，
 *         所以平移、缩放、来回拖动时同一栋楼永远长在同一个经纬度上，不会漂移。
 * 关键二：先按 3×3 格划分"街区"，整片决定留空 / 低层 / 高层，
 *         楼房才会成片聚拢成街区，而不是均匀撒成一片马赛克方块。
 * 关键三：三面由同一基色派生出明暗差（正面原色 / 侧面压暗 / 顶面提亮），
 *         光从左上打来，任何缩放级别下都是一栋有体积的楼。 */
const BLOCK_COLORS = ["#9fb8d6", "#c9a98a", "#a8c6a2", "#c3a8c9", "#d9c48a", "#8ea9c9"];
// 夜间换一套更沉的底色：三面仍保留明暗差，才不会糊成一片黑方块
const BLOCK_COLORS_NIGHT = ["#3a5074", "#52412e", "#3a5244", "#4b3a55", "#544a2e", "#34465e"];

const streetBlocks = computed(() => {
  const mpp = metersPerPixel.value;
  // 网格按 45 / 90 / 180m 三档切换，让屏幕上每格维持在 ~12–45px，
  // 从 1km 视野到街区级都保持相近的楼房密度
  let cellM = 90;
  if (90 / mpp < 12) cellM = 180;
  else if (90 / mpp > 30) cellM = 45;
  const cellPx = cellM / mpp;
  if (cellPx < 8) return []; // 视角太远就整体不画，保证流畅

  const seed = hashOf(props.city || "city");
  const night = isNight.value;
  const palette = night ? BLOCK_COLORS_NIGHT : BLOCK_COLORS;
  const latStep = cellM / 111320;
  const lonStep = cellM / (111320 * Math.cos((center.lat * Math.PI) / 180));
  const tl = unproject(-cellPx, -cellPx);
  const br = unproject(size.w + cellPx, size.h + cellPx);
  // 注意：左上角纬度比右下角大，纬度方向必须取 min/max，否则网格区间为空
  const i0 = Math.floor(Math.min(tl.lat, br.lat) / latStep);
  const i1 = Math.ceil(Math.max(tl.lat, br.lat) / latStep);
  const j0 = Math.floor(Math.min(tl.lon, br.lon) / lonStep);
  const j1 = Math.ceil(Math.max(tl.lon, br.lon) / lonStep);

  const out = [];
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      // 街区容积率：每 3×3 格共用一个哈希。三成多整片留空（公园/广场/水面），
      // 剩下的分成低层、多层、高层片区，楼房才有疏有密、成片成团
      const dRoll =
        (hashOf(`${seed}|${cellM}|D|${Math.floor(i / 3)}|${Math.floor(j / 3)}`) % 1000) / 1000;
      if (dRoll < 0.4) continue; // 整片空地
      const tallZone = dRoll > 0.86; // 高层片区
      const keepProb = tallZone ? 0.52 : dRoll > 0.66 ? 0.38 : 0.2;

      const h1 = (hashOf(`${seed}|${cellM}|${i}|${j}`) % 1000) / 1000;
      if (h1 > keepProb) continue; // 街区内留出空隙
      const h2 = (hashOf(`${seed}|${cellM}|${i}|${j}|b`) % 997) / 997;
      const lat = (i + 0.12 + h1 * 0.66) * latStep;
      const lon = (j + 0.12 + h2 * 0.66) * lonStep;
      // 紧贴地标的格子不画，免得和标志性建筑叠在一起
      let tooNear = false;
      for (const b of geo.建筑) {
        if (
          Math.abs(b.纬度 - lat) < latStep * 0.9 &&
          Math.abs(b.经度 - lon) < lonStep * 0.9
        ) {
          tooNear = true;
          break;
        }
      }
      if (tooNear) continue;

      const p = project(lat, lon);
      if (p.x < -40 || p.x > size.w + 40 || p.y < -60 || p.y > size.h + 40) continue;
      // 楼体比格子窄一点：既有体量、看得出高度，又留出街道缝隙
      const w = Math.max(5, Math.min(30, cellPx * (0.46 + h2 * 0.22)));
      const heightM = tallZone ? 42 + Math.round(h2 * 78) : 10 + Math.round(h2 * 26);
      // 楼高同时受"真实高度"和"自身宽度"约束：否则街景级会拉成一堆细高柱子
      const bh = Math.max(5, Math.min(56, w * 3.2, (heightM / mpp) * 1.6));
      const d = w * 0.42;
      const { x, y } = p;
      const base = palette[hashOf(`${seed}|${cellM}|${i}|${j}|c`) % palette.length];
      out.push({
        // key 用"格号"而不是下标：平移时 Vue 能复用同一栋楼的 DOM，减少重建
        key: `${cellM}|${i}|${j}`,
        x, y, w, h: bh,
        // 正面用底色，侧面压暗、顶面提亮 → 一致的光照方向，立体但不杂乱。
        // 三面明暗差拉到 0.76，小尺寸屏幕上也能一眼看出体积
        cFront: shade(base, night ? -0.1 : 0),
        cSide: shade(base, -0.44),
        cTop: shade(base, 0.32),
        front: `${x - w / 2},${y} ${x + w / 2},${y} ${x + w / 2},${y - bh} ${x - w / 2},${y - bh}`,
        side: `${x + w / 2},${y} ${x + w / 2 + d},${y - d * 0.6} ${x + w / 2 + d},${y - bh - d * 0.6} ${x + w / 2},${y - bh}`,
        top: `${x - w / 2},${y - bh} ${x + w / 2},${y - bh} ${x + w / 2 + d},${y - bh - d * 0.6} ${x - w / 2 + d},${y - bh - d * 0.6}`,
      });
    }
  }
  return out.sort((a, b) => a.y - b.y);
});

/* ============ 立体标志性建筑：真实高度 + 卡通配色/屋顶/窗户/图标 ============ */
const BUILDING_COLORS = ["#8fb8e8", "#f0b27a", "#9fd6b0", "#d7a8e0", "#f2c94c"];
const landmarkIcons = computed(() => {
  const list = assignIcons(geo.建筑.map((b) => ({ 名称: b.名称 })));
  const m = {};
  geo.建筑.forEach((b, i) => (m[b.名称] = list[i]?.emoji || "🏢"));
  return m;
});

const visibleBuildings = computed(() => {
  const mpp = metersPerPixel.value;
  const out = [];
  for (const b of geo.建筑) {
    // 按名称判定形制；自然景观（山/湖/江/岛）返回 null，不建楼，交给山峰与地形标注
    const shape = buildingShapeOf(b.名称);
    if (!shape) continue;
    const p = project(b.纬度, b.经度);
    if (p.x < -70 || p.x > size.w + 70 || p.y < -150 || p.y > size.h + 80) continue;
    // 真实高度 → 屏幕高度（保底 20px，否则远景时地标会缩成看不见的小色块）；
    // 宽度同时参考真实占地与高度，再按形制调宽高比（宫殿宽而矮、塔与塔楼窄而高）
    const size2 = SHAPE_SIZE[shape] || SHAPE_SIZE.generic;
    const hBase = Math.max(20, Math.min(320, (b.高度 / mpp) * 1.6));
    const wBase = Math.max(60 / mpp, hBase * 0.5);
    const w = Math.max(10, Math.min(110, wBase * size2.w));
    const h = hBase * size2.h;
    const { x, y } = p;
    const { parts, lights } = buildBuildingShape(shape, x, y, w, h);
    // 通用方块保留按名称派生的随机配色，避免一片同色
    if (shape === "generic") parts[0].fill = BUILDING_COLORS[hashOf(b.名称) % BUILDING_COLORS.length];
    out.push({
      名称: b.名称,
      高度: b.高度,
      形制: SHAPE_NAMES[shape] || "建筑",
      shape,
      ico: landmarkIcons.value[b.名称] || "🏢",
      x, y, w, h,
      parts,
      windows: lights,
    });
  }
  // 放大后展示更多建筑名称，方便逐个查看地标；
  // 已经是行程打卡点的地标不再重复标注（图钉上已有名字）
  const labelCap = zoom.value >= 17.5 ? 18 : zoom.value >= 15.5 ? 12 : 8;
  const pinNames = new Set(props.pins.map((p) => p.名称));
  [...out]
    .sort((a, b) => b.高度 - a.高度)
    .slice(0, labelCap)
    .forEach((b) => (b.显示名称 = !pinNames.has(b.名称)));
  return out.sort((a, b) => a.y - b.y);
});

// 该名称对应地标建筑的半宽：图钉气泡据此让开，避免压在楼体上
function landmarkHalfWidth(name) {
  const b = visibleBuildings.value.find((x) => x.名称 === name);
  return b ? b.w / 2 : 0;
}

// 打卡点标注：气泡挪到建筑侧边（压在楼体上就看不见建筑了）+ 引线指回真实点位
const pinList = computed(() =>
  props.pins
    .filter((p) => p.纬度 && p.经度)
    .map((p) => {
      const xy = project(p.纬度, p.经度);
      const halfW = landmarkHalfWidth(p.名称);
      // 左右交替，避免所有气泡挤在同一侧；越界时翻到另一侧
      let dir = hashOf(p.名称) % 2 ? 1 : -1;
      if (dir === 1 && xy.x + halfW + 46 > size.w) dir = -1;
      if (dir === -1 && xy.x - halfW - 46 < 0) dir = 1;
      const bx = +(xy.x + dir * (halfW + 17)).toFixed(1);
      const by = +(xy.y - 26).toFixed(1);
      return {
        ...p,
        ...xy,
        bx,
        by,
        halfW,
        // 引线：从点位斜拉到气泡底部
        lead: `${xy.x},${xy.y - 4} ${bx},${by + 12}`,
      };
    })
);
const nearbyPins = computed(() =>
  nearby.value.map((n) => ({ ...n, ...project(n.纬度, n.经度) }))
    .filter((n) => n.x > -20 && n.x < size.w + 20 && n.y > -20 && n.y < size.h + 20)
);

// 地点卡通图标：优先用父级传入的映射，否则按名称即时生成
const localIcons = computed(() => {
  const list = assignIcons(props.pins.map((p) => ({ 名称: p.名称 })));
  const m = {};
  props.pins.forEach((p, i) => (m[p.名称] = list[i]?.emoji || "📍"));
  return m;
});
function iconOf(name) {
  return props.icons[name] || localIcons.value[name] || "📍";
}

// 只连到"下一个要去的地方"（按名称匹配，避免坐标缺失时下标错位）
const guideTarget = computed(() => {
  const list = pinList.value;
  if (!list.length) return null;
  const nextName = props.pins[props.nextIndex]?.名称;
  if (nextName) {
    const hit = list.find((p) => p.名称 === nextName);
    if (hit) return hit;
  }
  return list.find((p) => p.状态 !== "done") || null;
});

// 真实地形标注：按真实坐标投影，并在旁边点缀当地植被卡通图标
const terrainList = computed(() =>
  props.terrains
    .filter((t) => t.纬度 != null && t.经度 != null)
    .map((t, i) => ({
      ...t,
      ...project(t.纬度, t.经度),
      flora: props.flora.length ? props.flora[i % props.flora.length] : "",
    }))
    .filter((t) => t.x > -50 && t.x < size.w + 50 && t.y > -40 && t.y < size.h + 40)
);



// 当前服饰（兜底：汉族交领汉服），人物建模据此换装
const costume = computed(() => ({ ...DEFAULT_COSTUME, ...props.costume }));

// 人物与打卡点/地标重合时错开一点（模拟定位时首个打卡点正好在"我"脚下），
// 人物挪开、真实坐标留一个光点，这样人和建筑都看得见
const avatarOff = computed(() => {
  if (!me.value || !pinList.value.length) return { x: 0, y: 0 };
  let best = null;
  for (const p of pinList.value) {
    const d = Math.hypot(p.x - me.value.x, p.y - me.value.y);
    if (!best || d < best.d) {
      best = { d, dx: me.value.x - p.x, dy: me.value.y - p.y, halfW: p.halfW };
    }
  }
  const need = Math.max(34, best.halfW + 20); // 让开距离同时考虑气泡与建筑宽度
  if (best.d > need) return { x: 0, y: 0 };
  const push = need - best.d;
  const ux = best.d < 1 ? -0.86 : best.dx / best.d; // 完全重合时默认往左下让
  const uy = best.d < 1 ? 0.5 : best.dy / best.d;
  return { x: +(ux * push).toFixed(1), y: +(uy * push).toFixed(1) };
});

const meDraw = computed(() =>
  me.value
    ? { x: +(me.value.x + avatarOff.value.x).toFixed(1), y: +(me.value.y + avatarOff.value.y).toFixed(1) }
    : null
);

// 朝向锥：以人偶脚下为顶点、朝行进方向张开的半透明扇形（地图式方位指示）
const headingPath = computed(() => {
  if (!meDraw.value || heading.value === null) return "";
  const a = ((heading.value - 90) * Math.PI) / 180; // 0° 指向北
  const { x, y } = meDraw.value;
  const r = 20; // 锥长
  const w = 0.5; // 半张角
  return [
    `${x + Math.cos(a) * r},${y + Math.sin(a) * r}`,
    `${x + Math.cos(a + w) * r * 0.3},${y + Math.sin(a + w) * r * 0.3}`,
    `${x + Math.cos(a - w) * r * 0.3},${y + Math.sin(a - w) * r * 0.3}`,
  ].join(" ");
});

const routePoints = computed(() => {
  if (pinList.value.length < 2) return "";
  return pinList.value.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
});

/* ============ 比例尺 ============ */
const scale = computed(() => {
  const candidates = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  const mpp = metersPerPixel.value;
  let pick = candidates[0];
  for (const m of candidates) if (m / mpp <= 96) pick = m;
  return { px: Math.max(24, Math.round(pick / mpp)), text: pick >= 1000 ? `${pick / 1000} km` : `${pick} m` };
});

/* ============ 视野 ============ */
function allFeaturePoints() {
  const pts = [];
  geo.建筑.forEach((b) => pts.push([b.纬度, b.经度]));
  geo.水系.forEach((w) => w.坐标.forEach((c) => pts.push(c)));
  geo.道路.forEach((r) => r.坐标.forEach((c) => pts.push(c)));
  return pts;
}
function zoomForKm(km) {
  let z = 19;
  for (; z >= 11; z--) {
    const mpp = (156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / Math.pow(2, z);
    if (mpp * size.w >= km * 1000) break;
  }
  return z;
}
function fitView(apply = false) {
  // 只展示"本次规划"的打卡点范围；打卡点还没坐标时才退回城市要素
  let pinPts = props.pins
    .filter((p) => p.纬度 != null && p.经度 != null)
    .map((p) => [p.纬度, p.经度]);
  // 远途一日游（如庐山、鄱阳湖，动辄上百公里）不参与框选，否则小地图会被拉到几十公里外
  if (pinPts.length >= 2) {
    const keep = [pinPts[0]];
    let cLat = pinPts[0][0];
    let cLon = pinPts[0][1];
    for (let i = 1; i < pinPts.length; i++) {
      const km = Math.hypot(
        (pinPts[i][0] - cLat) * 111.32,
        (pinPts[i][1] - cLon) * 111.32 * Math.cos((cLat * Math.PI) / 180)
      );
      if (km <= 8) {
        keep.push(pinPts[i]);
        cLat = keep.reduce((s, p) => s + p[0], 0) / keep.length;
        cLon = keep.reduce((s, p) => s + p[1], 0) / keep.length;
      }
    }
    pinPts = keep;
  }
  const usePins = pinPts.length >= 2;
  const anchor = geo.中心 || [center.lat, center.lon];
  const pts = usePins
    ? pinPts
    : allFeaturePoints().filter(([la, lo]) => {
        const dLat = (la - anchor[0]) * 111.32;
        const dLon = (lo - anchor[1]) * 111.32 * Math.cos((la * Math.PI) / 180);
        return Math.hypot(dLat, dLon) <= 4.5;
      });
  if (!pts.length) return;
  const lats = pts.map((p) => p[0]);
  const lons = pts.map((p) => p[1]);
  center.lat = (Math.min(...lats) + Math.max(...lats)) / 2;
  center.lon = (Math.min(...lons) + Math.max(...lons)) / 2;
  for (let z = 18; z >= 11; z--) {
    zoom.value = z;
    const xy = pts.map(([la, lo]) => project(la, lo));
    const w = Math.max(...xy.map((p) => p.x)) - Math.min(...xy.map((p) => p.x));
    const h = Math.max(...xy.map((p) => p.y)) - Math.min(...xy.map((p) => p.y));
    if (w <= size.w * 0.82 && h <= size.h * 0.82) break;
  }
  // 只限制"贴得过近"：视野不小于 near 公里（规划范围 600m / 城市要素 1.2km），
  // 其余交给上面的自适应——打卡点跨度大时自然放宽，保证规划的点都在画面内
  const near = usePins ? 0.6 : 1.2;
  zoom.value = Math.min(zoom.value, zoomForKm(near));
  stopZoom(); // 全览时同步缩放目标，避免与进行中的缩放动画打架
  if (apply) syncMe();
}

/* ============ 平移 & 缩放：帧同步 + 指针锚定 + 惯性 + 双指捏合 ============ */
const MIN_ZOOM = 11;
const MAX_ZOOM = 20;
let zoomTarget = 16; // 缩放目标（可浮点），逐帧缓动逼近，缩放过程不再一跳一跳
let zoomAnchor = null; // 缩放锚点（屏幕坐标）：锚点下的地物保持不动，方便放大看某栋建筑
let zoomRaf = null;
let dragRaf = null;
let inertiaRaf = null;
let drag = null;
let inertiaBase = null;
const pointers = new Map();
let pinch = null;

const clampZoom = (z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

function invMercY(t) {
  const n = Math.PI - 2 * Math.PI * t;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/** 按屏幕像素增量平移：内容跟手（指针右移 → 视野西移） */
function panByPixels(dx, dy) {
  const scale = 256 * Math.pow(2, zoom.value);
  center.lat = Math.max(-85, Math.min(85, invMercY(mercY(center.lat) - dy / scale)));
  center.lon = ((((center.lon - (dx / scale) * 360 + 540) % 360) + 360) % 360) - 180;
}

function localXY(e) {
  const r = mapRef.value?.getBoundingClientRect();
  return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: size.w / 2, y: size.h / 2 };
}

/** 立刻把缩放设到某个值，并保持锚点下的地理位置不动 */
function applyZoom(next) {
  const a = zoomAnchor || { x: size.w / 2, y: size.h / 2 };
  const before = unproject(a.x, a.y);
  zoom.value = clampZoom(next);
  const after = unproject(a.x, a.y);
  center.lat += before.lat - after.lat;
  center.lon += before.lon - after.lon;
  syncMe();
}

/** 平滑缩放到目标级别；传锚点则围绕该点缩放（滚轮/双击/捏合处） */
function setZoomTarget(z, anchor = null) {
  zoomTarget = clampZoom(z);
  if (anchor) zoomAnchor = anchor;
  if (!zoomRaf) zoomRaf = requestAnimationFrame(stepZoom);
}
function stepZoom() {
  zoomRaf = null;
  const dz = zoomTarget - zoom.value;
  if (Math.abs(dz) < 0.004) {
    applyZoom(zoomTarget);
    zoomAnchor = null;
    return;
  }
  applyZoom(zoom.value + dz * 0.25); // 缓动逼近
  zoomRaf = requestAnimationFrame(stepZoom);
}
function stopZoom() {
  if (zoomRaf) cancelAnimationFrame(zoomRaf);
  zoomRaf = null;
  zoomAnchor = null;
  zoomTarget = zoom.value;
}

function zoomIn() { setZoomTarget(zoomTarget + 1); }
function zoomOut() { setZoomTarget(zoomTarget - 1); }

function onWheel(e) {
  // 触控板双指缩放（ctrlKey）步长更大；普通滚轮按像素折算，避免一格跳一级
  const unit = e.deltaMode === 1 ? 0.06 : 0.0024;
  const step = -e.deltaY * unit * (e.ctrlKey ? 2.2 : 1);
  setZoomTarget(zoomTarget + Math.max(-0.8, Math.min(0.8, step)), localXY(e));
}

function onDblClick(e) { setZoomTarget(zoomTarget + 1.5, localXY(e)); }

function stopInertia() {
  if (inertiaRaf) cancelAnimationFrame(inertiaRaf);
  inertiaRaf = null;
  inertiaBase = null;
}

// 松手后的惯性滑动
function startInertia(vx, vy) {
  inertiaBase = { lat: center.lat, lon: center.lon };
  let dx = 0;
  let dy = 0;
  const step = () => {
    vx *= 0.93;
    vy *= 0.93;
    if (Math.hypot(vx, vy) < 0.05) { inertiaRaf = null; return; }
    dx += vx * 16;
    dy += vy * 16;
    const scale = 256 * Math.pow(2, zoom.value);
    center.lat = Math.max(-85, Math.min(85, invMercY(mercY(inertiaBase.lat) - dy / scale)));
    center.lon = ((((inertiaBase.lon - (dx / scale) * 360 + 540) % 360) + 360) % 360) - 180;
    syncMe();
    inertiaRaf = requestAnimationFrame(step);
  };
  inertiaRaf = requestAnimationFrame(step);
}

function onDown(e) {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  stopInertia();
  stopZoom(); // 新手势接管：中止进行中的缩放动画，避免拖拽与缩放同时改中心
  // 第二根手指落下 → 进入捏合缩放
  if (pointers.size === 2) {
    const [p1, p2] = [...pointers.values()];
    pinch = { dist: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1, zoom: zoomTarget };
    drag = null;
    return;
  }
  drag = {
    id: e.pointerId, x: e.clientX, y: e.clientY, ax: e.clientX, ay: e.clientY,
    vx: 0, vy: 0, t: performance.now(),
  };
  // 指针捕获：拖到地图外面也能继续拖
  try { mapRef.value?.setPointerCapture?.(e.pointerId); } catch (err) { /* 忽略 */ }
}

function onMove(e) {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  // 双指捏合：按两指间距比缩放，锚点取两指中点
  if (pinch && pointers.size >= 2) {
    const [p1, p2] = [...pointers.values()];
    const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const r = mapRef.value?.getBoundingClientRect();
    setZoomTarget(
      pinch.zoom + Math.log2(dist / pinch.dist),
      r ? { x: mid.x - r.left, y: mid.y - r.top } : null
    );
    return;
  }

  if (!drag || e.pointerId !== drag.id) return;
  const now = performance.now();
  const dt = Math.max(8, now - drag.t);
  drag.vx = (e.clientX - drag.x) / dt;
  drag.vy = (e.clientY - drag.y) / dt;
  drag.x = e.clientX;
  drag.y = e.clientY;
  drag.t = now;
  if (!dragRaf) dragRaf = requestAnimationFrame(applyDrag);
}

// 每帧只落一次位移：pointermove 频率可达上百次/秒，逐次重绘整图会明显卡顿
function applyDrag() {
  dragRaf = null;
  if (!drag) return;
  panByPixels(drag.x - drag.ax, drag.y - drag.ay);
  drag.ax = drag.x;
  drag.ay = drag.y;
  syncMe();
}

function onUp(e) {
  if (e?.pointerId != null) pointers.delete(e.pointerId);
  const wasPinch = pinch !== null;
  if (pointers.size < 2) pinch = null;

  if (dragRaf) { cancelAnimationFrame(dragRaf); dragRaf = null; }
  if (drag) {
    // 补齐最后一帧，松手时不差一截
    panByPixels(drag.x - drag.ax, drag.y - drag.ay);
    syncMe();
    const { vx, vy } = drag;
    drag = null;
    if (Math.hypot(vx, vy) > 0.18) startInertia(vx, vy);
  }
  // 捏合后剩一根手指：可以接着拖
  if (wasPinch && pointers.size === 1) {
    const [id, p] = [...pointers.entries()][0];
    drag = { id, x: p.x, y: p.y, ax: p.x, ay: p.y, vx: 0, vy: 0, t: performance.now() };
  }
}

function syncMe() {
  if (props.user?.lat == null || props.user?.lon == null) { me.value = null; return; }
  me.value = { ...project(props.user.lat, props.user.lon) };
}
function recenter() {
  if (props.user?.lat == null) return;
  center.lat = props.user.lat;
  center.lon = props.user.lon;
  syncMe();
}

function measure() {
  const el = mapRef.value;
  if (el) {
    size.w = el.clientWidth || 360;
    size.h = el.clientHeight || props.height;
  }
}

async function refreshNearby(force = false) {
  if (!props.city || props.user?.lat == null) return;
  const now = Date.now();
  const moved =
    lastFix.lat == null
      ? 1e9
      : Math.abs(props.user.lat - lastFix.lat) * 111320 +
        Math.abs(props.user.lon - lastFix.lon) * 111320;
  if (!force && moved < 15 && now - lastNearbyAt < 5000) return;
  lastNearbyAt = now;
  lastFix = { lat: props.user.lat, lon: props.user.lon };
  try {
    const r = await api.getNearby(props.city, props.user.lat, props.user.lon, props.radiusKm);
    nearby.value = r.周边 || [];
    emit("nearby", nearby.value);
  } catch (e) { /* 忽略 */ }
}

async function loadGeo() {
  if (!props.city) return;
  try {
    const g = await api.getCityGeo(props.city);
    geo.水系 = g.水系 || [];
    geo.道路 = g.道路 || [];
    geo.建筑 = g.建筑 || [];
    geo.中心 = g.中心 || null;
    const c = g.中心 || (geo.建筑[0] ? [geo.建筑[0].纬度, geo.建筑[0].经度] : null);
    if (c && props.user?.lat == null) {
      center.lat = c[0];
      center.lon = c[1];
    }
    measure();
    fitView();
    syncMe();
    refreshNearby(true);
  } catch (e) { console.error("[RealMap] 地理数据加载失败", e); }
}

watch(() => props.city, () => loadGeo());
watch(() => [props.user?.lat, props.user?.lon], () => {
  const prev = me.value;
  syncMe();
  if (me.value && prev && (props.user.lat !== lastFix.lat || props.user.lon !== lastFix.lon)) {
    heading.value = (Math.atan2(props.user.lon - (lastFix.lon ?? props.user.lon), props.user.lat - (lastFix.lat ?? props.user.lat)) * 180) / Math.PI;
  }
  refreshNearby();
});
// 打卡点变化（换天/换城市）时自动重新框选规划范围
watch(
  () => props.pins.map((p) => `${p.名称}|${p.纬度}`).join(","),
  () => fitView(true)
);

onMounted(() => {
  measure();
  loadGeo();
  if (props.user?.lat != null) {
    center.lat = props.user.lat;
    center.lon = props.user.lon;
    syncMe();
  }
  window.addEventListener("resize", measure);
  // 每分钟校准一次，跨过 19:00 / 06:00 时自动切昼夜
  nightTimer = setInterval(() => (nightNow.value = Date.now()), 60000);
});
onUnmounted(() => {
  window.removeEventListener("resize", measure);
  if (nightTimer) clearInterval(nightTimer);
  nightTimer = null;
  // 清掉所有动画帧，避免离开页面后仍在跑
  if (dragRaf) cancelAnimationFrame(dragRaf);
  if (zoomRaf) cancelAnimationFrame(zoomRaf);
  if (inertiaRaf) cancelAnimationFrame(inertiaRaf);
  dragRaf = zoomRaf = inertiaRaf = null;
  pointers.clear();
});

defineExpose({ fitView, recenter, zoomIn, zoomOut });
</script>

<style scoped>
.real-map {
  position: relative; width: 100%; height: 100%;
  border-radius: 16px; overflow: hidden; touch-action: none;
  background: #eaf3e0; box-shadow: inset 0 -18px 26px rgba(90, 130, 70, 0.12);
}
.canvas { position: absolute; inset: 0; touch-action: none; }

/* 真实水系 */
.water-fill { fill: #8fc7ea; stroke: #6fb0dc; stroke-width: 1; opacity: 0.92; }
.water-line { fill: none; stroke: #7fbde6; stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; opacity: 0.92; }

/* 真实道路 */
.road-casing { fill: none; stroke: #fff; stroke-width: 9; stroke-linecap: round; stroke-linejoin: round; opacity: 0.95; }
.road { fill: none; stroke: #c9d2c2; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; }
.road-ring { stroke: #d8c8a8; }

/* 3D 立体建筑：街区楼房的三面颜色由 JS 从同一基色派生（正面原色 / 侧面压暗 /
   顶面提亮），这里只保留投影；下面三个类给 cityBuilding.js 的通用形制兜底 */
.b-shadow { fill: rgba(45, 66, 32, 0.18); }
.blocks-body { shape-rendering: geometricPrecision; }
.b-front { fill: #8fb8e8; stroke: #6f97c9; stroke-width: 0.5; }
.b-side { fill: #5d86bd; stroke: #4a6f9f; stroke-width: 0.5; }
.b-top { fill: #b7d4f7; stroke: #93b6e0; stroke-width: 0.5; }
.b-label { font-size: 9px; fill: #4a5a44; text-anchor: middle; paint-order: stroke; stroke: #fff; stroke-width: 2.5px; }

/* 地点卡通图标标注：圆形底 + 名称（状态配色） */
.mark-bg { fill: rgba(255, 255, 255, 0.94); stroke: #4aa3ff; stroke-width: 2; }
.mark-cur .mark-bg { stroke: #ff8b00; stroke-width: 2.5; }
.mark-done .mark-bg { stroke: #34c77b; }
.mark-ico { font-size: 15px; text-anchor: middle; }
.mark-name { font-size: 9.5px; fill: #3b4a36; text-anchor: middle; paint-order: stroke; stroke: #fff; stroke-width: 2.5px; }
.mark-cur .mark-name { fill: #b06a00; font-weight: 600; }
.mark-next { font-size: 9px; fill: #ff8b00; text-anchor: middle; paint-order: stroke; stroke: #fff; stroke-width: 2.5px; font-weight: 600; }
.mark-shadow { fill: rgba(45, 66, 32, 0.22); }
/* 打卡点引线：气泡在侧边，用虚线指回真实点位 */
.mark-lead { fill: none; stroke: #c3cedb; stroke-width: 1.2; stroke-dasharray: 3 3; }
.mark-cur .mark-lead { stroke: #ffb066; }
.mark-done .mark-lead { stroke: #a9d8b6; }
/* 只画当前位置→下一站的这一条虚线 */
.guide-line { stroke: #ff8b00; stroke-width: 3; stroke-dasharray: 7 5; opacity: 0.95; }
.nearby-dot { fill: #ff7a45; stroke: #fff; stroke-width: 1; opacity: 0.9; }

/* 真实地形卡通标注 */
.terrain-pill { fill: rgba(255, 255, 255, 0.94); stroke: #dfe8f5; stroke-width: 1; }
.terrain-text { font-size: 10px; fill: #3b4a36; text-anchor: middle; }

/* 立体山峰 */
.mt-shadow { fill: rgba(45, 66, 32, 0.22); }
.mt-left { fill: #9dbf8e; stroke: #86a978; stroke-width: 0.5; }
.mt-right { fill: #7ba46c; stroke: #6b9160; stroke-width: 0.5; }
.mt-snow { fill: #f2f7fb; opacity: 0.95; }
.mt-label { font-size: 9.5px; fill: #3b4a36; text-anchor: middle; paint-order: stroke; stroke: #fff; stroke-width: 2.5px; }
.flora-ico { text-anchor: middle; opacity: 0.95; }

/* 立体建筑细节 */
.b-window { fill: rgba(255, 255, 255, 0.75); }
.b-roof { fill: rgba(255, 255, 255, 0.35); stroke: rgba(255, 255, 255, 0.5); stroke-width: 0.5; }
.b-ico { font-size: 13px; text-anchor: middle; }

/* 天气层 */
.wx-tint { position: absolute; inset: 0; pointer-events: none; }
.tint-rain { background: linear-gradient(180deg, rgba(70, 95, 120, 0.28), rgba(70, 95, 120, 0.14)); }
.tint-snow { background: linear-gradient(180deg, rgba(235, 245, 255, 0.55), rgba(220, 235, 250, 0.3)); }
.wx-layer { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.wx-drop {
  position: absolute; top: -12px; width: 2px; height: 14px; border-radius: 2px;
  background: rgba(120, 165, 220, 0.85); animation: wxFall 1s linear infinite;
}
.wx-flake {
  position: absolute; top: -18px; font-size: 15px; color: #eaf3ff;
  animation: wxSnow 2.6s linear infinite;
}
@keyframes wxFall { to { transform: translateY(440px); } }
@keyframes wxSnow { to { transform: translateY(460px); } }
.wx-sun {
  position: absolute; right: 12px; top: 8px; font-size: 26px;
  display: flex; align-items: center; gap: 4px; pointer-events: none;
}
.wx-sun em {
  font-style: normal; font-size: 11px; color: #b06a00;
  background: rgba(255, 255, 255, 0.85); padding: 1px 6px; border-radius: 10px;
}

/* GPS 当前位置：人物建模（正面卡通人偶，服饰随当地民族变化） */
.me-tag { font-size: 9.5px; fill: #2f6fd0; text-anchor: middle; paint-order: stroke; stroke: #fff; stroke-width: 3px; }
.me-pulse { fill: rgba(47, 111, 208, 0.16); animation: pulse 1.8s ease-out infinite; transform-box: fill-box; transform-origin: center; }
.me-cone { fill: rgba(47, 111, 208, 0.35); }
/* 人物被错开时，真实坐标处的光点与引线 */
.me-dot { fill: #2f6fd0; stroke: #fff; stroke-width: 1.4; }
.me-lead { stroke: rgba(47, 111, 208, 0.6); stroke-width: 1.2; stroke-dasharray: 3 3; }
@keyframes pulse { 0% { opacity: 0.9; transform: scale(0.6); } 100% { opacity: 0; transform: scale(1.6); } }

.scale-bar {
  position: absolute; left: 10px; bottom: 10px; display: flex; align-items: center; gap: 6px;
  background: rgba(255, 255, 255, 0.9); padding: 3px 8px; border-radius: 10px;
  font-size: 11px; color: #4a5a44; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.scale-line { height: 6px; border: 1.5px solid #4a5a44; border-top: none; }

.zoom-ctl { position: absolute; right: 10px; bottom: 10px; display: flex; flex-direction: column; gap: 6px; }
.zoom-ctl button {
  width: 32px; height: 32px; border: none; border-radius: 10px; background: rgba(255, 255, 255, 0.95);
  font-size: 16px; color: #3d5a35; cursor: pointer; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
}
.gps-chip {
  position: absolute; left: 10px; top: 10px; font-size: 11px; color: #2f6fd0;
  background: rgba(255, 255, 255, 0.92); padding: 3px 8px; border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
/* 当前人物服饰（当地民族传统服饰） */
.costume-chip {
  position: absolute; left: 10px; top: 36px; font-size: 11px; color: #8a4a86;
  background: rgba(255, 255, 255, 0.92); padding: 3px 8px; border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  display: flex; align-items: center; gap: 4px;
}
.costume-chip em { font-style: normal; font-size: 10px; color: #b0a3c4; }

/* 月亮（夜里替代太阳） */
.wx-moon {
  position: absolute; right: 12px; top: 8px; font-size: 24px;
  display: flex; align-items: center; gap: 4px; pointer-events: none;
  filter: drop-shadow(0 0 7px rgba(175, 205, 255, 0.55));
}
.wx-moon em {
  font-style: normal; font-size: 11px; color: #cfe0f5;
  background: rgba(18, 27, 43, 0.85); padding: 1px 6px; border-radius: 10px;
}

/* ============ 夜晚：整体换成深色底图（19:00–06:00 自动生效） ============ */
/* 天幕上深下浅：最上面是夜空，越往下越接近地面，星星就"挂"在最上面那一层 */
.night { background: #0b1220; box-shadow: inset 0 -18px 26px rgba(0, 0, 0, 0.5); }
.night .rm-g1 { stop-color: #060b16; }
.night .rm-g2 { stop-color: #16263e; }

/* 星空：只占画面上半部（天上），越往下越淡，不会盖到地面建筑上；
   固定不随地图平移缩放，只缓慢闪烁 */
.star-layer {
  position: absolute; left: 0; right: 0; top: 0; height: 56%;
  overflow: hidden; pointer-events: none;
  opacity: 0.92; mix-blend-mode: screen; /* 叠在深色底图上，不遮挡也不拦截操作 */
  -webkit-mask-image: linear-gradient(180deg, #000 0%, rgba(0, 0, 0, 0.88) 55%, transparent 100%);
  mask-image: linear-gradient(180deg, #000 0%, rgba(0, 0, 0, 0.88) 55%, transparent 100%);
}
.star {
  position: absolute; border-radius: 50%; background: #fff;
  opacity: 0.9; animation: twinkle 3.2s ease-in-out infinite;
}
/* 亮星：带一圈冷色光晕，把星空拉开层次，不至于全是一样的小白点 */
.star-glow { box-shadow: 0 0 6px 1.6px rgba(186, 214, 255, 0.8); }
@keyframes twinkle {
  0%, 100% { opacity: 0.22; }
  50% { opacity: 0.95; }
}

/* 水系 / 道路压成夜色 */
.night .water-fill { fill: #16405f; stroke: #1d5378; }
.night .water-line { stroke: #1b4a70; }
.night .road-casing { stroke: #131c2c; opacity: 0.9; }
.night .road { stroke: #38455c; }
.night .road-ring { stroke: #4a4436; }

/* 建筑：形体压暗（留一点本色，别把塔/宫殿的特征色全吃掉），灯光亮成暖黄 */
.night .b-shadow { fill: rgba(0, 0, 0, 0.45); }
.night .bldg-body { filter: brightness(0.6) saturate(0.8); }
.night .b-window { fill: #ffd76a; opacity: 0.95; }
.night .b-roof { fill: rgba(255, 255, 255, 0.12); stroke: rgba(255, 255, 255, 0.18); }

/* 山峰 / 植被 / 各类标注在深色底上重新配色 */
.night .mt-shadow { fill: rgba(0, 0, 0, 0.45); }
.night .mt-left { fill: #2f4a3c; stroke: #26392f; }
.night .mt-right { fill: #24382e; stroke: #1d2c24; }
.night .mt-snow { fill: #cfe0f2; opacity: 0.85; }
.night .flora-ico { opacity: 0.72; }
.night .b-label, .night .mark-name, .night .mt-label { fill: #e6edf7; stroke: #0b1220; }
.night .mark-cur .mark-name { fill: #ffc266; }
.night .terrain-pill { fill: rgba(20, 30, 48, 0.92); stroke: #33415b; }
.night .terrain-text { fill: #dbe6f5; }
.night .mark-bg { fill: rgba(18, 27, 43, 0.94); }
.night .mark-shadow { fill: rgba(0, 0, 0, 0.5); }
.night .me-tag { fill: #9ec5ff; stroke: #0b1220; }
.night .guide-line { stroke: #ffa02e; }

/* 夜里下雨/下雪：雨点更亮、天幕更沉 */
.night .tint-rain { background: linear-gradient(180deg, rgba(10, 18, 32, 0.5), rgba(10, 18, 32, 0.26)); }
.night .tint-snow { background: linear-gradient(180deg, rgba(90, 120, 165, 0.4), rgba(60, 85, 125, 0.24)); }
.night .wx-drop { background: rgba(170, 210, 255, 0.95); box-shadow: 0 0 4px rgba(150, 200, 255, 0.6); }
.night .wx-flake { color: #eaf3ff; opacity: 0.9; }

/* 夜间控件配色 */
.night .scale-bar, .night .gps-chip, .night .costume-chip {
  background: rgba(18, 27, 43, 0.9); color: #cfe0f5;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}
.night .scale-line { border-color: #cfe0f5; }
.night .gps-chip { color: #8fc2ff; }
.night .costume-chip { color: #e0b6dd; }
.night .costume-chip em { color: #93a2bd; }
.night .zoom-ctl button {
  background: rgba(18, 27, 43, 0.9); color: #cfe0f5;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
}
</style>
