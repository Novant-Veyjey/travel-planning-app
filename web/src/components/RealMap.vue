<template>
  <div class="real-map" ref="mapRef"
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

    <!-- 天气：与当地当前天气一致（雨天落雨、雪天飘雪、晴天出太阳） -->
    <div v-if="isRain || isSnow" class="wx-tint" :class="isSnow ? 'tint-snow' : 'tint-rain'"></div>
    <div v-if="isRain" class="wx-layer">
      <span v-for="n in 34" :key="'r'+n" class="wx-drop"
            :style="{ left: (n * 29) % 100 + '%', animationDelay: (n * 0.11) + 's' }"></span>
    </div>
    <div v-if="isSnow" class="wx-layer">
      <span v-for="n in 24" :key="'s'+n" class="wx-flake"
            :style="{ left: (n * 37) % 100 + '%', animationDelay: (n * 0.17) + 's' }">❄</span>
    </div>
    <div v-if="isSun" class="wx-sun">☀️ <em>{{ temp }}°</em></div>

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

/* 字符串 → 稳定伪随机整数。
 * 末尾必须做雪崩混合：单纯 h*33+cp 是线性的，"…|1|2" 与 "…|1|3" 只差 1，
 * 相邻格子的随机数几乎相同，楼房就会整齐对齐成一片等距网格，而不是自然散布。 */
function hashOf(s) {
  let h = 5381;
  for (const c of String(s || "")) h = (h * 33 + c.codePointAt(0)) % 100003;
  h = (h ^ (h >>> 7)) % 100003;
  h = (Math.imul(h, 2246822519) >>> 0) % 100003;
  h = (h ^ (h >>> 9)) % 100003;
  return h;
}

/* ============ 天气（与当地实时天气一致：雨天落雨、雪天飘雪、晴天出太阳） ============ */
const scene = computed(() => props.weather?.场景 || "sunny");
const isRain = computed(() => scene.value === "rainy" || (props.weather?.雨滴 || 0) > 0);
const isSnow = computed(() => scene.value === "snowy" || (props.weather?.雪花 || 0) > 0);
const isSun = computed(() => !isRain.value && !isSnow.value);

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

/* ============ 立体标志性建筑：真实高度 + 卡通配色/屋顶/窗户/图标 ============ */
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
    // 只画有真实形制的地标（塔/楼阁/宫殿/穹顶/桥/城楼/大佛…）：
    // 自然景观返回 null；generic 就是"一个方块"，同样不画——地图上不要方块
    const shape = buildingShapeOf(b.名称);
    if (!shape || shape === "generic") continue;
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
});
onUnmounted(() => {
  window.removeEventListener("resize", measure);
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

/* 立体建筑投影 */
.b-shadow { fill: rgba(45, 66, 32, 0.18); }
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

</style>
