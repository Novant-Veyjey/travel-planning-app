<template>
  <div class="phone">
    <div class="topbar">
      <button class="back" @click="$router.back()">←</button>
      <h1>GPS 步行导航</h1>
      <span class="gps-tag" :class="gpsState">{{ gpsText }}</span>
    </div>

    <div class="empty-state" v-if="!geoReady && !loadErr">
      <div class="spinner"></div>
      <p>正在加载真实地图数据…</p>
    </div>
    <div class="empty-state" v-if="loadErr">
      <div class="empty-ico">📡</div>
      <h3>地图数据加载失败</h3>
      <button class="btn btn-primary" @click="reload">重试</button>
    </div>

    <!-- 真实坐标地图：水系 / 道路 / 3D 建筑 / GPS 位置 -->
    <div v-show="geoReady && !loadErr" class="map3d" ref="mapRef"
         @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp"
         @pointerleave="onUp" @wheel.prevent="onWheel">
      <svg class="canvas" :width="size.w" :height="size.h">
        <defs>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#eaf4dd" />
            <stop offset="1" stop-color="#dbeac6" />
          </linearGradient>
        </defs>
        <!-- 地面 -->
        <rect :width="size.w" :height="size.h" fill="url(#ground)" />

        <!-- 湖泊（真实经纬度多边形，平铺在地面上） -->
        <polygon v-for="(w, i) in lakes" :key="'lk'+i" :points="polyPoints(w.坐标)"
                 class="water-fill" />
        <!-- 河流 / 海岸（真实经纬度折线） -->
        <polyline v-for="(w, i) in rivers" :key="'rv'+i" :points="polyPoints(w.坐标)"
                  class="water-line" />

        <!-- 道路：先描白边再画路面，形成真实道路质感 -->
        <polyline v-for="(r, i) in roads" :key="'rc'+i" :points="polyPoints(r.坐标)"
                  class="road-casing" />
        <polyline v-for="(r, i) in roads" :key="'rd'+i" :points="polyPoints(r.坐标)"
                  :class="r.类型 === '环线' ? 'road road-ring' : 'road'" />

        <!-- 步行路线 -->
        <polyline v-if="routePoints" :points="routePoints" class="route" />

        <!-- 3D 立体建筑：地面阴影 + 正面 + 侧面 + 顶面 -->
        <g v-for="(b, i) in visibleBuildings" :key="'b'+i">
          <ellipse :cx="b.x" :cy="b.y" :rx="b.w / 2" :ry="b.w * 0.22" class="b-shadow" />
          <polygon :points="b.front" class="b-front" />
          <polygon :points="b.side" class="b-side" />
          <polygon :points="b.top" class="b-top" />
          <text v-if="b.显示名称" :x="b.x" :y="b.y + 12" class="b-label">{{ b.名称 }}</text>
        </g>

        <!-- 周边景点图钉 -->
        <g v-for="(p, i) in pins" :key="'p'+i" @click="selectTarget(p)">
          <ellipse :cx="p.x" :cy="p.y" rx="5" ry="2" class="pin-shadow" />
          <path :d="pinPath(p)" :class="p.名称 === target?.名称 ? 'pin pin-sel' : 'pin'" />
          <text :x="p.x" :y="p.y - 12" class="pin-label">{{ p.名称 }}</text>
        </g>

        <!-- GPS 当前位置 -->
        <g v-if="me">
          <circle :cx="me.x" :cy="me.y" r="16" class="me-pulse" />
          <ellipse :cx="me.x" :cy="me.y" rx="7" ry="3" class="me-shadow" />
          <circle :cx="me.x" :cy="me.y" r="7" class="me-dot" />
          <polygon v-if="heading !== null" :points="headingPath" class="me-head" />
        </g>
      </svg>

      <!-- 比例尺 -->
      <div class="scale-bar">
        <div class="scale-line" :style="{ width: scalePx + 'px' }"></div>
        <span>{{ scaleText }}</span>
      </div>

      <!-- 比例尺 / 缩放控制 -->
      <div class="zoom-ctl">
        <button @click="zoomIn" title="放大">＋</button>
        <button @click="zoomOut" title="缩小">－</button>
        <button class="loc" @click="fitView" title="全览真实地理要素">⛶</button>
        <button class="loc" @click="recenter" title="回到我的位置">◎</button>
      </div>

      <!-- 定位方式切换 -->
      <div class="mode-ctl">
        <button :class="{ active: mode === 'gps' }" @click="startGps">GPS 定位</button>
        <button :class="{ active: mode === 'sim' }" @click="startSim">模拟行走</button>
      </div>
    </div>

    <!-- 目的地导航条 -->
    <div v-if="target && geoReady" class="target-bar">
      <span class="tb-ico">🚶</span>
      <span class="tb-text">
        步行前往 <b>{{ target.名称 }}</b>
        <em>{{ walk.距离 }} 米 · 约 {{ walk.步行分钟 }} 分钟 · 真实直线距离</em>
      </span>
      <button class="tb-clear" @click="target = null">取消</button>
    </div>

    <!-- 周边推荐（随移动实时刷新） -->
    <div v-if="geoReady" class="card">
      <h3>周边推荐 <em class="hint">半径 {{ radiusKm }} km，随位置实时更新</em></h3>
      <div class="nearby">
        <div v-for="(p, i) in nearby" :key="i" class="nb-item"
             :class="{ active: p.名称 === target?.名称 }" @click="selectTarget(p)">
          <span class="nb-ico">{{ nearbyIcons[i]?.emoji || nearbyIcons[i]?.char || "📍" }}</span>
          <span class="nb-name">{{ p.名称 }}</span>
          <span class="nb-dist">{{ fmtDist(p.距离) }}</span>
          <span class="nb-walk">🚶 {{ p.步行分钟 }}′</span>
        </div>
      </div>
      <div v-if="!nearby.length" class="empty-tip">附近暂无收录景点</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api/index.js";
import { assignIcons } from "../assets/poiIcon.js";

const router = useRouter();
const mapRef = ref(null);
const size = reactive({ w: 360, h: 420 });

const city = ref("成都");
const geo = reactive({ 水系: [], 道路: [], 建筑: [], 中心: null });
const geoReady = ref(false);
const loadErr = ref(false);

const center = reactive({ lat: 30.665, lon: 104.075 });
const zoom = ref(16);
const me = ref(null); // 当前位置（屏幕坐标 + 经纬度）
const userPos = reactive({ lat: 30.665, lon: 104.075 });
const heading = ref(null);
const nearby = ref([]);
const target = ref(null);
const walk = reactive({ 距离: 0, 步行分钟: 0 });
const radiusKm = ref(1.5);
const mode = ref("gps"); // gps | sim
const gpsState = ref("idle"); // idle | on | err
const gpsText = computed(() =>
  gpsState.value === "on" ? "定位中" : gpsState.value === "err" ? "模拟定位" : "待定位"
);

let watchId = null;
let simRaf = null;
let lastNearbyAt = 0;
let lastNearbyPos = { lat: 0, lon: 0 };

/* ================= Web Mercator 投影 ================= */
function mercY(lat) {
  const s = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
}
function project(lat, lon) {
  const scale = 256 * Math.pow(2, zoom.value);
  const cx = ((center.lon + 180) / 360) * scale;
  const cy = mercY(center.lat) * scale;
  const x = ((lon + 180) / 360) * scale;
  const y = mercY(lat) * scale;
  return { x: size.w / 2 + (x - cx), y: size.h / 2 + (y - cy) };
}
function unproject(px, py) {
  const scale = 256 * Math.pow(2, zoom.value);
  const cx = ((center.lon + 180) / 360) * scale;
  const cy = mercY(center.lat) * scale;
  const mx = px - size.w / 2 + cx;
  const my = py - size.h / 2 + cy;
  const lon = (mx / scale) * 360 - 180;
  const n = Math.PI - 2 * Math.PI * (my / scale);
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lon };
}
// 每像素代表的实际米数（用于建筑高度与比例尺）
const metersPerPixel = computed(
  () => (156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / Math.pow(2, zoom.value)
);

/* ================= 图层数据 ================= */
const rivers = computed(() => geo.水系.filter((w) => w.类型 !== "湖泊"));
const lakes = computed(() => geo.水系.filter((w) => w.类型 === "湖泊"));
const roads = computed(() => geo.道路);

function polyPoints(coords) {
  return coords.map(([la, lo]) => {
    const p = project(la, lo);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(" ");
}

// 建筑：按真实经纬度投影，高度按真实米数换算，绘制成斜二测立体块
const visibleBuildings = computed(() => {
  const mpp = metersPerPixel.value;
  const out = [];
  for (const b of geo.建筑) {
    const p = project(b.纬度, b.经度);
    if (p.x < -60 || p.x > size.w + 60 || p.y < -80 || p.y > size.h + 60) continue;
    const w = Math.max(9, Math.min(70, 60 / mpp)); // 占地约 60m
    // 真实高度换算，并做 1.6 倍垂直夸张（地图制图惯例），小比例尺下 3D 体感更明显
    const h = Math.max(8, Math.min(300, (b.高度 / mpp) * 1.6));
    const d = w * 0.45; // 进深（斜二测偏移）
    const x = p.x;
    const y = p.y;
    out.push({
      名称: b.名称,
      高度: b.高度,
      x, y, w,
      front: `${x - w / 2},${y} ${x + w / 2},${y} ${x + w / 2},${y - h} ${x - w / 2},${y - h}`,
      side: `${x + w / 2},${y} ${x + w / 2 + d},${y - d * 0.6} ${x + w / 2 + d},${y - h - d * 0.6} ${x + w / 2},${y - h}`,
      top: `${x - w / 2},${y - h} ${x + w / 2},${y - h} ${x + w / 2 + d},${y - h - d * 0.6} ${x - w / 2 + d},${y - h - d * 0.6}`,
    });
  }
  // 只有最高的若干地标带名称，避免密集区域文字互相压盖
  [...out].sort((a, b) => b.高度 - a.高度).slice(0, 8).forEach((b) => (b.显示名称 = true));
  return out.sort((a, b) => a.y - b.y); // 近处后画，保证遮挡关系正确
});

const pins = computed(() =>
  nearby.value
    .map((p) => ({ ...p, ...project(p.纬度, p.经度) }))
    .filter((p) => p.x > -30 && p.x < size.w + 30 && p.y > -30 && p.y < size.h + 30)
);

function pinPath(p) {
  const x = p.x;
  const y = p.y;
  const r = 6;
  return `M${x},${y} L${x - r},${y - r * 1.8} A${r * 1.3},${r * 1.3} 0 1 1 ${x + r},${y - r * 1.8} Z`;
}

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

/* ================= 比例尺（随缩放自适应） ================= */
const scale = computed(() => {
  const candidates = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  const mpp = metersPerPixel.value;
  let pick = candidates[0];
  for (const m of candidates) if (m / mpp <= 96) pick = m;
  return { px: Math.max(24, Math.round(pick / mpp)), text: pick >= 1000 ? `${pick / 1000} km` : `${pick} m` };
});
const scalePx = computed(() => scale.value.px);
const scaleText = computed(() => scale.value.text);

/* ================= 视野适配：把真实水系/道路/建筑装进画面中央 ================= */
function allFeaturePoints() {
  const pts = [];
  geo.建筑.forEach((b) => pts.push([b.纬度, b.经度]));
  geo.水系.forEach((w) => w.坐标.forEach((c) => pts.push(c)));
  geo.道路.forEach((r) => r.坐标.forEach((c) => pts.push(c)));
  return pts;
}

// 让画面宽度约为 km 公里的缩放层级
function zoomForKm(km) {
  const target = km * 1000;
  let z = 19;
  for (; z >= 11; z--) {
    const mpp = (156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / Math.pow(2, z);
    if (mpp * size.w >= target) break;
  }
  return z;
}

function fitView() {
  const anchor = geo.中心 || [center.lat, center.lon];
  // 只以市中心 4.5km 内的要素定视野，避免远郊景点把比例尺拉得过大
  const pts = allFeaturePoints().filter(([la, lo]) => {
    const dLat = (la - anchor[0]) * 111.32;
    const dLon = (lo - anchor[1]) * 111.32 * Math.cos((la * Math.PI) / 180);
    return Math.hypot(dLat, dLon) <= 4.5;
  });
  if (!pts.length) return;
  const lats = pts.map((p) => p[0]);
  const lons = pts.map((p) => p[1]);
  center.lat = (Math.min(...lats) + Math.max(...lats)) / 2;
  center.lon = (Math.min(...lons) + Math.max(...lons)) / 2;
  // 从大比例尺往小试，找到能把要素装进画面的层级
  for (let z = 18; z >= 11; z--) {
    zoom.value = z;
    const xy = pts.map(([la, lo]) => project(la, lo));
    const xs = xy.map((p) => p.x);
    const ys = xy.map((p) => p.y);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    if (w <= size.w * 0.82 && h <= size.h * 0.82) break;
  }
  // 步行视角：画面宽度控制在 3.2km 以内，城市核心更清晰
  zoom.value = Math.max(zoom.value, zoomForKm(3.2));
  syncMe();
}

/* ================= 路线 ================= */
const routePoints = computed(() => {
  if (!target.value || !me.value) return "";
  const a = me.value;
  const b = project(target.value.纬度, target.value.经度);
  return `${a.x},${a.y} ${b.x},${b.y}`;
});

function fmtDist(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

// 周边列表图标：按景点名称自动生成，组内不重复
const nearbyIcons = computed(() => assignIcons(nearby.value));

/* ================= 交互：缩放 / 拖动 / 滚轮 ================= */
function zoomIn() { zoom.value = Math.min(19, zoom.value + 1); }
function zoomOut() { zoom.value = Math.max(12, zoom.value - 1); }
function onWheel(e) { e.deltaY < 0 ? zoomIn() : zoomOut(); }

let drag = null;
function onDown(e) {
  drag = { x: e.clientX, y: e.clientY, lat: center.lat, lon: center.lon };
}
function onMove(e) {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  const a = unproject(size.w / 2, size.h / 2);
  const b = unproject(size.w / 2 - dx, size.h / 2 - dy);
  center.lat = drag.lat + (b.lat - a.lat);
  center.lon = drag.lon + (b.lon - a.lon);
  syncMe();
}
function onUp() { drag = null; }
function recenter() {
  center.lat = userPos.lat;
  center.lon = userPos.lon;
  syncMe();
}

/* ================= 定位 ================= */
function syncMe() {
  me.value = { ...project(userPos.lat, userPos.lon), lat: userPos.lat, lon: userPos.lon };
}

async function refreshNearby(force = false) {
  const moved =
    Math.abs(userPos.lat - lastNearbyPos.lat) * 111320 +
    Math.abs(userPos.lon - lastNearbyPos.lon) * 111320;
  const now = Date.now();
  if (!force && moved < 15 && now - lastNearbyAt < 5000) return;
  lastNearbyAt = now;
  lastNearbyPos = { lat: userPos.lat, lon: userPos.lon };
  try {
    const r = await api.getNearby(city.value, userPos.lat, userPos.lon, radiusKm.value);
    nearby.value = r.周边 || [];
    if (target.value) updateWalk();
  } catch (e) { /* 忽略 */ }
}

function setPos(lat, lon, hd = null) {
  const prevLat = userPos.lat;
  const prevLon = userPos.lon;
  userPos.lat = lat;
  userPos.lon = lon;
  if (hd !== null) heading.value = hd;
  else if (lat !== prevLat || lon !== prevLon) {
    heading.value =
      (Math.atan2(lon - prevLon, lat - prevLat) * 180) / Math.PI;
  }
  syncMe();
  refreshNearby();
}

function startGps() {
  stopSim();
  mode.value = "gps";
  if (!navigator.geolocation) {
    gpsState.value = "err";
    startSim();
    return;
  }
  gpsState.value = "on";
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      gpsState.value = "on";
      setPos(pos.coords.latitude, pos.coords.longitude, pos.coords.heading ?? null);
      center.lat = userPos.lat;
      center.lon = userPos.lon;
      syncMe();
    },
    (err) => {
      console.warn("[GPS] 定位失败:", err.message);
      gpsState.value = "err";
      startSim();
    },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
  );
}

// 模拟行走：沿真实坐标向目标移动，用于无 GPS 权限/桌面预览
function startSim() {
  mode.value = "sim";
  gpsState.value = "err";
  if (!nearby.value.length) refreshNearby(true);
  let last = performance.now();
  const SPEED = 14; // 演示用前进速度（米/秒）
  function step(now) {
    const dt = (now - last) / 1000;
    last = now;
    let dest = target.value || nearby.value[0];
    if (!dest) { simRaf = requestAnimationFrame(step); return; }
    const dLat = dest.纬度 - userPos.lat;
    const dLon = dest.经度 - userPos.lon;
    const distM = Math.hypot(dLat * 111320, dLon * 111320 * Math.cos((userPos.lat * Math.PI) / 180));
    if (distM < 8) {
      // 到达后换下一个最近景点，保持"边走边推荐"
      const idx = nearby.value.findIndex((p) => p.名称 === dest.名称);
      dest = nearby.value[(idx + 1) % Math.max(1, nearby.value.length)] || dest;
      selectTarget(dest, true);
    }
    const k = Math.min(1, (SPEED * dt) / Math.max(1, distM));
    setPos(userPos.lat + dLat * k, userPos.lon + dLon * k);
    center.lat = userPos.lat;
    center.lon = userPos.lon;
    syncMe();
    simRaf = requestAnimationFrame(step);
  }
  if (simRaf) cancelAnimationFrame(simRaf);
  simRaf = requestAnimationFrame(step);
}

function stopSim() {
  if (simRaf) cancelAnimationFrame(simRaf);
  simRaf = null;
}

function selectTarget(p, silent = false) {
  target.value = p;
  updateWalk();
  if (!silent) {
    center.lat = (userPos.lat + p.纬度) / 2;
    center.lon = (userPos.lon + p.经度) / 2;
    syncMe();
  }
}

async function updateWalk() {
  if (!target.value) return;
  try {
    const r = await api.getWalkInfo(userPos.lat, userPos.lon, target.value.纬度, target.value.经度);
    Object.assign(walk, r);
  } catch (e) { /* 忽略 */ }
}

/* ================= 初始化 ================= */
async function loadGeo() {
  geoReady.value = false;
  loadErr.value = false;
  try {
    const q = router.currentRoute.value.query;
    const to = typeof q.to === "string" && q.to ? q.to : "";
    const cf = to ? await api.getCityFeature(to).catch(() => null) : null;
    city.value = cf?.城市 || to || "成都";

    const g = await api.getCityGeo(city.value);
    geo.水系 = g.水系 || [];
    geo.道路 = g.道路 || [];
    geo.建筑 = g.建筑 || [];
    geo.中心 = g.中心 || null;

    // 初始视野：自动适配该城市全部真实地理要素，比例尺舒适不空旷
    const c = g.中心 || (geo.建筑[0] ? [geo.建筑[0].纬度, geo.建筑[0].经度] : [30.665, 104.075]);
    center.lat = c[0];
    center.lon = c[1];
    measure();
    // 未取得 GPS 前，先把"我"放在城市中心
    userPos.lat = c[0];
    userPos.lon = c[1];
    fitView();
    syncMe();
    await refreshNearby(true);
    geoReady.value = true;
    startGps();
  } catch (e) {
    console.error(e);
    loadErr.value = true;
  }
}

function measure() {
  const el = mapRef.value;
  if (el) {
    size.w = el.clientWidth || 360;
    size.h = el.clientHeight || 420;
  }
}

function reload() { loadGeo(); }

onMounted(async () => {
  await loadGeo();
  window.addEventListener("resize", measure);
});
onUnmounted(() => {
  window.removeEventListener("resize", measure);
  if (watchId && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
  stopSim();
});
</script>

<style scoped>
.map3d {
  position: relative; height: 420px; margin: 12px 16px;
  border-radius: 16px; overflow: hidden; touch-action: none;
  background: #eaf3e0; box-shadow: inset 0 -18px 26px rgba(90, 130, 70, 0.12);
}
.canvas { position: absolute; inset: 0; }

/* 水系：真实经纬度处呈现 */
.water-fill { fill: #8fc7ea; stroke: #6fb0dc; stroke-width: 1; opacity: 0.9; }
.water-line { fill: none; stroke: #7fbde6; stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; opacity: 0.92; }

/* 道路：白色路缘 + 灰色路面 */
.road-casing { fill: none; stroke: #ffffff; stroke-width: 9; stroke-linecap: round; stroke-linejoin: round; opacity: 0.95; }
.road { fill: none; stroke: #c9d2c2; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; }
.road-ring { stroke: #d8c8a8; }

.route { fill: none; stroke: #ff8b00; stroke-width: 4; stroke-dasharray: 9 7; stroke-linecap: round; }

/* 3D 立体建筑 */
.b-shadow { fill: rgba(45, 66, 32, 0.18); }
.b-front { fill: #8fb8e8; stroke: #6f97c9; stroke-width: 0.5; }
.b-side { fill: #5d86bd; stroke: #4a6f9f; stroke-width: 0.5; }
.b-top { fill: #b7d4f7; stroke: #93b6e0; stroke-width: 0.5; }
.b-label { font-size: 9px; fill: #4a5a44; text-anchor: middle; paint-order: stroke; stroke: #fff; stroke-width: 2.5px; }

.pin { fill: #ff7a45; stroke: #fff; stroke-width: 1.5; cursor: pointer; }
.pin-sel { fill: #2f8f4e; }
.pin-shadow { fill: rgba(45, 66, 32, 0.2); }
.pin-label { font-size: 9px; fill: #333; text-anchor: middle; paint-order: stroke; stroke: #fff; stroke-width: 2.5px; }

.me-dot { fill: #2f6fd0; stroke: #fff; stroke-width: 2.5; }
.me-shadow { fill: rgba(45, 66, 32, 0.28); }
.me-pulse { fill: rgba(47, 111, 208, 0.18); animation: pulse 1.8s ease-out infinite; transform-box: fill-box; transform-origin: center; }
.me-head { fill: #2f6fd0; }
@keyframes pulse { 0% { opacity: 0.9; transform: scale(0.6); } 100% { opacity: 0; transform: scale(1.6); } }

/* 比例尺 */
.scale-bar {
  position: absolute; left: 10px; bottom: 10px; display: flex; align-items: center; gap: 6px;
  background: rgba(255, 255, 255, 0.9); padding: 3px 8px; border-radius: 10px;
  font-size: 11px; color: #4a5a44; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.scale-line { height: 6px; border: 1.5px solid #4a5a44; border-top: none; }

/* 缩放控制 */
.zoom-ctl { position: absolute; right: 10px; bottom: 10px; display: flex; flex-direction: column; gap: 6px; }
.zoom-ctl button {
  width: 32px; height: 32px; border: none; border-radius: 10px; background: rgba(255, 255, 255, 0.95);
  font-size: 16px; color: #3d5a35; cursor: pointer; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
}
.zoom-ctl .loc { font-size: 18px; }

.mode-ctl { position: absolute; right: 10px; top: 10px; display: flex; gap: 6px; }
.mode-ctl button {
  border: none; background: rgba(255, 255, 255, 0.92); font-size: 11px; padding: 4px 9px;
  border-radius: 12px; color: #5a6b52; cursor: pointer; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
.mode-ctl button.active { background: var(--primary); color: #fff; }

.gps-tag { font-size: 11px; padding: 3px 8px; border-radius: 12px; background: #eef6ff; color: var(--blue); }
.gps-tag.on { background: #e4f5e9; color: #2f8f4e; }
.gps-tag.err { background: #fff3d6; color: #b06a00; }

.target-bar {
  display: flex; align-items: center; gap: 8px; margin: 0 16px 10px;
  background: #fff8ec; border: 1px solid #ffe0b2; border-radius: 12px; padding: 8px 10px;
}
.tb-ico { font-size: 18px; }
.tb-text { flex: 1; font-size: 13px; }
.tb-text b { color: var(--primary); }
.tb-text em { display: block; font-style: normal; font-size: 11px; color: var(--text-light); }
.tb-clear { border: none; background: #fff; color: var(--text-light); font-size: 12px; border-radius: 10px; padding: 5px 9px; cursor: pointer; }

.hint { font-style: normal; font-size: 11px; color: var(--text-light); font-weight: 400; }
.nearby .nb-item {
  display: flex; align-items: center; gap: 8px; padding: 7px 0;
  border-bottom: 1px dashed #eef2f7; cursor: pointer;
}
.nearby .nb-item.active { background: #fff8ec; border-radius: 8px; padding: 7px 6px; }
.nb-ico { font-size: 14px; }
.nb-name { flex: 1; font-size: 14px; }
.nb-dist { font-size: 12px; color: var(--text-light); }
.nb-walk { font-size: 12px; color: var(--blue); min-width: 48px; text-align: right; }
.empty-tip { text-align: center; font-size: 12px; color: var(--text-light); padding: 10px 0; }

.spinner {
  width: 30px; height: 30px; border: 3px solid #dbe7f5; border-top-color: var(--primary);
  border-radius: 50%; animation: spin 0.9s linear infinite; margin: 18px auto 8px;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
