<template>
  <div class="real-map" ref="mapRef"
       @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp"
       @pointerleave="onUp" @wheel.prevent="onWheel">
    <svg class="canvas" :width="size.w" :height="size.h">
      <defs>
        <linearGradient id="rm-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#eaf4dd" />
          <stop offset="1" stop-color="#dbeac6" />
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

      <!-- 3D 立体建筑：地面阴影 + 正面 + 侧面 + 顶面 -->
      <g v-for="(b, i) in visibleBuildings" :key="'b'+i">
        <ellipse :cx="b.x" :cy="b.y" :rx="b.w / 2" :ry="b.w * 0.22" class="b-shadow" />
        <polygon :points="b.front" :style="{ fill: b.color }" />
        <polygon :points="b.side" class="b-side" />
        <polygon :points="b.top" class="b-top" />
        <polygon :points="b.roof" class="b-roof" />
        <circle v-for="(wd, wi) in b.windows" :key="'w'+wi" :cx="wd.x" :cy="wd.y" r="1.7" class="b-window" />
        <text :x="b.x" :y="b.y - b.h * 0.42" class="b-ico">{{ b.ico }}</text>
        <text v-if="b.显示名称" :x="b.x" :y="b.y + 13" class="b-label">{{ b.名称 }}</text>
      </g>

      <!-- 行程打卡点：每个地点用与其名称对应的卡通图标标注 -->
      <g v-for="(p, i) in pinList" :key="'p'+i" :class="'mark mark-' + p.状态">
        <ellipse :cx="p.x" :cy="p.y" rx="10" ry="4" class="mark-shadow" />
        <circle :cx="p.x" :cy="p.y - 12" r="13" class="mark-bg" />
        <text :x="p.x" :y="p.y - 7" class="mark-ico">{{ iconOf(p.名称) }}</text>
        <text :x="p.x" :y="p.y + 16" class="mark-name">{{ i + 1 }}. {{ p.名称 }}</text>
        <text v-if="i === nextIndex" :x="p.x" :y="p.y - 30" class="mark-next">下一站</text>
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

      <!-- 我的卡通形象：站在真实 GPS 坐标上（emoji 人偶 + 接地阴影 + 朝向） -->
      <g v-if="me" class="avatar-me">
        <ellipse :cx="me.x" :cy="me.y" rx="11" ry="4" class="me-shadow" />
        <circle :cx="me.x" :cy="me.y - 10" r="18" class="me-pulse" />
        <text :x="me.x" :y="me.y - 2" class="me-char">{{ avatar }}</text>
        <polygon v-if="heading !== null" :points="headingPath" class="me-head" />
        <text :x="me.x" :y="me.y - 34" class="me-tag">当前位置</text>
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

    <div class="zoom-ctl">
      <button @click="zoomIn" title="放大">＋</button>
      <button @click="zoomOut" title="缩小">－</button>
      <button @click="fitView(true)" title="全览真实地理要素">⛶</button>
      <button @click="recenter" title="回到我的位置">◎</button>
    </div>

    <div class="gps-chip">🛰 {{ gpsText }}</div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from "vue";
import { api } from "../api/index.js";
import { assignIcons } from "../assets/poiIcon.js";

const props = defineProps({
  city: { type: String, default: "" },
  user: { type: Object, default: () => ({ lat: null, lon: null }) },
  pins: { type: Array, default: () => [] }, // [{名称, 纬度, 经度, 状态}]
  icons: { type: Object, default: () => ({}) }, // 名称 → 卡通图标
  nextIndex: { type: Number, default: -1 }, // 下一站下标（画指引线）
  terrains: { type: Array, default: () => [] }, // 真实地形标注 [{名称, 纬度, 经度, ico}]
  flora: { type: Array, default: () => [] }, // 目的地植被卡通图标
  avatar: { type: String, default: "🧍‍♀️" }, // 当前位置的卡通形象
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
  const seed = hashOf(props.city);
  for (let i = 0; i < 6; i++) {
    const s = (seed + i * 977) % 997;
    out.push({
      ico: props.flora[i % props.flora.length],
      x: size.w * (0.08 + (s % 84) / 100),
      y: size.h * (0.1 + ((s >> 3) % 78) / 100),
      size: 12 + (s % 5),
    });
  }
  return out.filter((f) => f.x > 0 && f.x < size.w && f.y > 0 && f.y < size.h);
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
    const p = project(b.纬度, b.经度);
    if (p.x < -60 || p.x > size.w + 60 || p.y < -80 || p.y > size.h + 60) continue;
    const w = Math.max(10, Math.min(70, 60 / mpp));
    const h = Math.max(10, Math.min(300, (b.高度 / mpp) * 1.6));
    const d = w * 0.45;
    const { x, y } = p;
    // 窗户按楼层分布，越高层数越多
    const rows = Math.max(1, Math.min(4, Math.floor(h / 12)));
    const windows = [];
    for (let r = 0; r < rows; r++) {
      const wy = y - 6 - (r * (h - 10)) / rows;
      windows.push({ x: x - w * 0.22, y: wy }, { x: x + w * 0.22, y: wy });
    }
    out.push({
      名称: b.名称,
      高度: b.高度,
      ico: landmarkIcons.value[b.名称] || "🏢",
      color: BUILDING_COLORS[hashOf(b.名称) % BUILDING_COLORS.length],
      x, y, w, h, windows,
      front: `${x - w / 2},${y} ${x + w / 2},${y} ${x + w / 2},${y - h} ${x - w / 2},${y - h}`,
      side: `${x + w / 2},${y} ${x + w / 2 + d},${y - d * 0.6} ${x + w / 2 + d},${y - h - d * 0.6} ${x + w / 2},${y - h}`,
      top: `${x - w / 2},${y - h} ${x + w / 2},${y - h} ${x + w / 2 + d},${y - h - d * 0.6} ${x - w / 2 + d},${y - h - d * 0.6}`,
      roof: `${x - w / 2 - 1.5},${y - h} ${x + w / 2 + 1.5},${y - h} ${x + w / 2 + d + 1.5},${y - h - d * 0.6} ${x - w / 2 + d - 1.5},${y - h - d * 0.6}`,
    });
  }
  [...out].sort((a, b) => b.高度 - a.高度).slice(0, 8).forEach((b) => (b.显示名称 = true));
  return out.sort((a, b) => a.y - b.y);
});

const pinList = computed(() =>
  props.pins
    .filter((p) => p.纬度 && p.经度)
    .map((p) => ({ ...p, ...project(p.纬度, p.经度) }))
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



const headingPath = computed(() => {
  if (!me.value || heading.value === null) return "";
  const a = ((heading.value - 90) * Math.PI) / 180;
  const x = me.value.x;
  const y = me.value.y - 14;
  const s = 6;
  return [
    `${x + Math.cos(a) * s},${y + Math.sin(a) * s}`,
    `${x + Math.cos(a + 2.5) * s},${y + Math.sin(a + 2.5) * s}`,
    `${x + Math.cos(a - 2.5) * s},${y + Math.sin(a - 2.5) * s}`,
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
  if (apply) syncMe();
}

function zoomIn() { zoom.value = Math.min(19, zoom.value + 1); }
function zoomOut() { zoom.value = Math.max(12, zoom.value - 1); }
function onWheel(e) { e.deltaY < 0 ? zoomIn() : zoomOut(); }

let drag = null;
function onDown(e) { drag = { x: e.clientX, y: e.clientY, lat: center.lat, lon: center.lon }; }
function onMove(e) {
  if (!drag) return;
  const a = unproject(size.w / 2, size.h / 2);
  const b = unproject(size.w / 2 - (e.clientX - drag.x), size.h / 2 - (e.clientY - drag.y));
  center.lat = drag.lat + (b.lat - a.lat);
  center.lon = drag.lon + (b.lon - a.lon);
  syncMe();
}
function onUp() { drag = null; }

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
onUnmounted(() => window.removeEventListener("resize", measure));

defineExpose({ fitView, recenter, zoomIn, zoomOut });
</script>

<style scoped>
.real-map {
  position: relative; width: 100%; height: 100%;
  border-radius: 16px; overflow: hidden; touch-action: none;
  background: #eaf3e0; box-shadow: inset 0 -18px 26px rgba(90, 130, 70, 0.12);
}
.canvas { position: absolute; inset: 0; }

/* 真实水系 */
.water-fill { fill: #8fc7ea; stroke: #6fb0dc; stroke-width: 1; opacity: 0.92; }
.water-line { fill: none; stroke: #7fbde6; stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; opacity: 0.92; }

/* 真实道路 */
.road-casing { fill: none; stroke: #fff; stroke-width: 9; stroke-linecap: round; stroke-linejoin: round; opacity: 0.95; }
.road { fill: none; stroke: #c9d2c2; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; }
.road-ring { stroke: #d8c8a8; }

/* 3D 立体建筑 */
.b-shadow { fill: rgba(45, 66, 32, 0.18); }
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

/* GPS 当前位置：卡通人物（emoji 形象） */
.me-char { font-size: 26px; text-anchor: middle; }
.me-tag { font-size: 9.5px; fill: #2f6fd0; text-anchor: middle; paint-order: stroke; stroke: #fff; stroke-width: 3px; }
.me-shadow { fill: rgba(45, 66, 32, 0.3); }
.me-pulse { fill: rgba(47, 111, 208, 0.16); animation: pulse 1.8s ease-out infinite; transform-box: fill-box; transform-origin: center; }
.me-head { fill: #2f6fd0; }
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
</style>
