<template>
  <div class="phone">
    <div class="topbar">
      <button class="back" @click="$router.back()">←</button>
      <h1>当前导航</h1>
      <div class="topbar-right">
        <span class="clock-chip" title="按真实交通耗时推演的行程时间">🕒 {{ clockText }}</span>
        <span class="weather">{{ weather.图标 }} {{ weather.温度 }}°</span>
        <button class="exit-btn" @click="exitToHome" title="退出并保留数据">退出</button>
      </div>
    </div>

    <!-- 未填写行程的空态引导 -->
    <div v-if="noInput" class="empty-state">
      <div class="empty-ico">🗺️</div>
      <h3>还没有行程信息</h3>
      <p>请先填写出发地和目的地，再开始导航</p>
      <button class="btn btn-primary" @click="$router.push('/')">去填写行程 →</button>
    </div>

    <!-- 导航指引条：GPS 实时定位 + 到下一站的步行/乘车分钟数 -->
    <div v-if="!noInput" class="guide-bar">
      <span class="g-arrow" :style="{ transform: `rotate(${bearing == null ? 0 : bearing}deg)` }">➤</span>
      <span class="g-text">
        {{ guideText }}
        <em v-if="walkMins != null">
          🚶 步行 {{ walkMins }} 分钟 · 🚕 乘车 {{ driveMins }} 分钟 · {{ gpsLabel }}
        </em>
      </span>
      <button class="g-toggle" @click="travelMode = travelMode === 'walk' ? 'drive' : 'walk'">
        {{ travelMode === "walk" ? "步行" : "乘车" }}
      </button>
    </div>

    <!-- 唯一地图：真实经纬度底图（卡通渲染）+ 立体建筑/山峰 + 我的立体形象 + 路线 -->
    <div v-if="!noInput" class="real-wrap">
      <RealMap :city="cityName || destination" :user="gps" :pins="realPins"
               :icons="poiIcons" :next-index="nextIndex" :terrains="terrainLabels"
               :flora="floraIcons" :weather="scenario" :temp="weather.温度"
               :gps-state="gpsState" @nearby="nearbyList = $event" />
      <!-- 移动中实时推荐周边景点（按真实距离排序） -->
      <div v-if="nearbyList.length" class="nearby-strip">
        <span class="nb-title">边走边看</span>
        <span v-for="(n, i) in nearbyList.slice(0, 4)" :key="i" class="nb-chip">
          {{ n.名称 }} <em>{{ n.距离 >= 1000 ? (n.距离 / 1000).toFixed(1) + "km" : n.距离 + "m" }}</em>
        </span>
      </div>
    </div>

    <!-- 当地民族特色 / 建筑（区域元数据驱动） -->
    <div v-if="!noInput && regionMeta.民族" class="ethnic-strip">
      <span class="et-main">🧑‍🤝‍🧑 {{ regionMeta.民族 }}</span>
      <span class="et-tag" v-for="b in regionMeta.建筑类型" :key="'b' + b">🏠 {{ b }}</span>
      <span class="et-tag et-elem" v-for="e in regionMeta.民族元素" :key="'e' + e">✦ {{ e }}</span>
    </div>

    <!-- 底部行程面板：当天时间线 + 完整路线 -->
    <div v-if="!noInput" class="card timeline-card">
      <h3 style="text-align:center;">
        {{ fullRoute?.路线名 ? fullRoute.路线名 : `今日行程 · ${destination}` }}
      </h3>
      <div class="day-switch" v-if="routeDays.length">
        <span class="ds-hint">今日行程</span>
        <button v-for="(d, i) in routeDays" :key="i" class="ds-tab"
                :class="{ active: i === dayIndex }" @click="switchDay(i)">
          D{{ d.第几天 }}<em>{{ (d.打卡点 || []).length }}点</em>
        </button>
      </div>
      <div class="day-clock">
        🕒 {{ dayStartText }} 首站出发 → 预计 {{ dayEndText }} 结束（{{ totalMinsText }}）
        <span class="gps-inline">
          {{ gpsLabel }}<template v-if="nextDistText"> · 距下一站 {{ nextDistText }}</template>
        </span>
      </div>
      <div class="timeline">
        <div v-for="(p, i) in currentPois" :key="i" class="item"
             :class="{ 'item-done': i < currentStop, 'item-cur': i === currentStop }"
             @click="jumpTo(i)">
          <span class="t-order">{{ i + 1 }}</span>
          <span class="t-ico">{{ poiIcons[p.名称] }}</span>
          <span class="t-time">{{ arriveLabel(i) }}</span>
          <span class="t-name">{{ p.名称 }}</span>
          <span class="traffic">{{ modeIcon(p.交通?.推荐方式) }} {{ p.交通?.推荐方式 }}·{{ p.交通?.耗时 }}</span>
        </div>
      </div>
      <div v-if="!currentPois.length" class="empty-tip">暂无打卡点数据，请返回"我的路线"重新生成</div>
      <div style="display:flex;gap:12px;margin-top:12px;">
        <button class="btn btn-primary" style="flex:1" @click="nextStop">
          {{ currentStop >= currentPois.length - 1 ? "行程结束 ✅" : "下一站 →" }}
        </button>
        <button class="btn btn-outline" style="flex:1" @click="goRoutes">我的路线</button>
      </div>
      <button class="btn btn-ghost" style="width:100%;margin-top:10px;" @click="goWalk">
        🛰 回到我的位置（真实 GPS 定位）
      </button>

      <!-- 完整路线：与地图同源的规划结果（多天行程 + 全程交通） -->
      <div v-if="fullRoute" class="full-route">
        <div class="fr-head" @click="showFull = !showFull">
          <span class="fr-title">
            完整路线
            <em v-if="fullRoute.强度" class="fr-badge">{{ fullRoute.强度 }}</em>
            <em class="fr-count">{{ routeDays.length }}天 · {{ totalPoiCount }}个打卡点</em>
          </span>
          <span class="fr-toggle">{{ showFull ? "收起 ▲" : "展开 ▼" }}</span>
        </div>
        <div v-if="showFull" class="fr-body">
          <div class="fr-meta" v-if="fullRoute.适合人群">👥 适合：{{ fullRoute.适合人群 }}</div>
          <div class="fr-meta" v-if="fullRoute.亮点">✨ {{ fullRoute.亮点 }}</div>
          <div class="fr-meta" v-if="fullRoute.全程交通?.length">
            🚄 全程交通：{{ fullRoute.全程交通.map((t) => `${t.方式}${t.耗时}`).join(" / ") }}
            <em v-if="fullRoute.全程交通来源" class="fr-src">（{{ fullRoute.全程交通来源 }}）</em>
          </div>
          <div v-if="regionMeta.民族" class="fr-meta">
            🧑‍🤝‍🧑 民族特色：{{ regionMeta.民族 }} · {{ regionMeta.建筑类型.join("、") }} · {{ regionMeta.民族元素.join("、") }}
          </div>
          <div v-for="(d, di) in routeDays" :key="di" class="fr-day"
               :class="{ active: di === dayIndex }" @click="switchDay(di)">
            <div class="fr-day-title">
              第{{ d.第几天 }}天
              <em v-if="d.天气">{{ d.天气 }}</em>
              <em v-if="d.地形">· {{ d.地形 }}</em>
            </div>
            <div v-for="(p, pi) in (d.打卡点 || [])" :key="pi" class="fr-poi">
              <span class="fr-idx">{{ pi + 1 }}</span>
              <span class="fr-name">{{ p.名称 }}</span>
              <span class="fr-time">{{ dayEta(di, pi, p) }}</span>
              <span class="fr-traffic">{{ modeIcon(p.交通?.推荐方式) }}{{ p.交通?.耗时 }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 到达提示 toast -->
    <transition name="toast">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api/index.js";
import { session } from "../session.js";
import { assignIcons } from "../assets/poiIcon.js";
import RealMap from "../components/RealMap.vue";

const router = useRouter();

const weather = reactive({ 温度: 25, 天气: "晴", 图标: "☀️" });
const scenario = reactive({ 场景: "sunny", 太阳: true, 雨滴: 0, 雪花: 0, 配饰: "墨镜" });
const cityFeature = ref(null); // 后端城市特色（含区域元数据：民族/建筑类型/民族元素）
const destination = ref("");
const noInput = ref(false);
const toast = ref("");
let toastTimer = null;

const currentDay = ref({ 第几天: 1, 地形: "平原", 打卡点: [] });
const currentPois = ref([]);
const currentStop = ref(0);

const fullRoute = ref(null);
const dayIndex = ref(0);
const showFull = ref(true);

/* ============ 时钟：从首站推荐时间起算，逐段按真实交通耗时推进 ============ */
const DEFAULT_START = 9 * 60;
const clockMinutes = ref(DEFAULT_START);

const MODE_ICON = {
  步行: "🚶", 骑行: "🚴", 公交: "🚌", 地铁: "🚇",
  打车: "🚕", 高铁: "🚄", 自驾: "🚗", 长途大巴: "🚌",
};
function modeIcon(mode) {
  return MODE_ICON[mode] || "🚇";
}

function parseMinutes(text) {
  const m = String(text || "").match(/(\d+)\s*(分钟|min)/);
  return m ? parseInt(m[1], 10) : null;
}
function parseClock(text) {
  const m = String(text || "").match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Math.min(23, parseInt(m[1], 10)) * 60 + Math.min(59, parseInt(m[2], 10));
}
function parseTimeRange(text) {
  const m = String(text || "").match(/(\d{1,2}):(\d{2})\s*[-~—至]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const start = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  let end = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
  if (end < start) end += 1440;
  return { start, end };
}
function fmtClock(mins) {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const PLAY_MIN = {
  "美食打卡": 60, 夜游: 60, "休闲街区": 75,
  "标志性景点": 100, "人文历史": 90, "自然风光": 120,
};
function playMinutes(p) {
  const r = parseTimeRange(p?.推荐时间);
  if (r && r.end > r.start) return Math.min(300, r.end - r.start);
  return PLAY_MIN[p?.类型] || 90;
}

// 到达 = 上一站离开 + 真实交通耗时；离开 = 到达 + 游玩时长
function buildSchedule(list) {
  const out = [];
  let leave = null;
  (list || []).forEach((p, i) => {
    const play = playMinutes(p);
    const range = parseTimeRange(p?.推荐时间);
    const arrive =
      i === 0
        ? (range ? range.start : (parseClock(p?.推荐时间) ?? DEFAULT_START))
        : leave + (parseMinutes(p?.交通?.耗时) ?? 15);
    leave = arrive + play;
    out.push({ arrive, play, leave });
  });
  return out;
}

const schedule = computed(() => buildSchedule(currentPois.value));
const routeDays = computed(() => fullRoute.value?.每日行程 || []);
const daySchedules = computed(() => routeDays.value.map((d) => buildSchedule(d.打卡点 || [])));
const totalPoiCount = computed(() => routeDays.value.reduce((n, d) => n + (d.打卡点?.length || 0), 0));

const clockText = computed(() => fmtClock(clockMinutes.value));
const dayStartText = computed(() => (schedule.value.length ? fmtClock(schedule.value[0].arrive) : "--:--"));
const dayEndText = computed(() =>
  schedule.value.length ? fmtClock(schedule.value[schedule.value.length - 1].leave) : "--:--"
);
const totalMinsText = computed(() => {
  if (!schedule.value.length) return "--";
  const mins = schedule.value[schedule.value.length - 1].leave - schedule.value[0].arrive;
  return `全程约 ${Math.floor(mins / 60)} 小时 ${mins % 60} 分`;
});

function arriveLabel(i) {
  const s = schedule.value[i];
  if (!s) return "";
  const t = fmtClock(s.arrive);
  if (i === currentStop.value) return `${t} 在此`;
  if (i < currentStop.value) return `${t} 已到`;
  return `${t} 到达`;
}
function dayEta(di, pi, poi) {
  const s = daySchedules.value[di]?.[pi];
  return s ? `${fmtClock(s.arrive)} 到达` : (poi?.推荐时间 || "");
}
function syncClock() {
  const s = schedule.value[Math.min(currentStop.value, schedule.value.length - 1)];
  clockMinutes.value = s ? s.arrive : DEFAULT_START;
}

/* ============ 地点卡通图标（按名称自动生成） ============ */
const poiIcons = computed(() => {
  const list = assignIcons(currentPois.value.map((p) => ({ 名称: p.名称, 类型: p.类型 })));
  const m = {};
  currentPois.value.forEach((p, i) => (m[p.名称] = list[i]?.emoji || "📍"));
  return m;
});

/* ============ GPS：真实定位（卡通人物 + 自动打卡） ============ */
const gps = reactive({ lat: null, lon: null });
const gpsState = ref("idle"); // idle | on | err
const poiCoords = ref({}); // 打卡点名称 → 真实坐标
const nearbyList = ref([]);
let gpsWatch = null;
let simWalkTimer = null;

const gpsLabel = computed(() =>
  gpsState.value === "on" ? "🛰 GPS 定位中" : gpsState.value === "err" ? "🛰 模拟定位" : "🛰 待定位"
);

const realPins = computed(() =>
  currentPois.value.map((p, i) => {
    const c = poiCoords.value[p.名称];
    return {
      名称: p.名称,
      纬度: c?.纬度 ?? null,
      经度: c?.经度 ?? null,
      状态: i < currentStop.value ? "done" : i === currentStop.value ? "cur" : "todo",
    };
  })
);

function toMeters(aLat, aLon, bLat, bLon) {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/* ============ 导航指引：方位 + 分钟级时间 ============ */
const travelMode = ref("walk"); // walk | drive
const nextIndex = computed(() => Math.min(currentStop.value + 1, Math.max(0, currentPois.value.length - 1)));
const nextPoiName = computed(() => currentPois.value[nextIndex.value]?.名称 || "");
const nextCoord = computed(() => poiCoords.value[nextPoiName.value] || null);
const nextDistanceM = computed(() => {
  if (gps.lat == null || !nextCoord.value) return null;
  return Math.round(toMeters(gps.lat, gps.lon, nextCoord.value.纬度, nextCoord.value.经度));
});
const walkMins = computed(() =>
  nextDistanceM.value == null ? null : Math.max(1, Math.round((nextDistanceM.value / 1000 / 4.5) * 60))
);
const driveMins = computed(() =>
  nextDistanceM.value == null ? null : Math.max(1, Math.round((nextDistanceM.value / 1000 / 28) * 60 + 1))
);
const distanceText = computed(() =>
  nextDistanceM.value == null
    ? ""
    : nextDistanceM.value >= 1000
      ? `${(nextDistanceM.value / 1000).toFixed(1)} km`
      : `${nextDistanceM.value} m`
);
const nextDistText = computed(() => distanceText.value);

function bearingDeg(aLat, aLon, bLat, bLon) {
  const p1 = (aLat * Math.PI) / 180;
  const p2 = (bLat * Math.PI) / 180;
  const dl = ((bLon - aLon) * Math.PI) / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
const COMPASS = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
const bearing = computed(() =>
  gps.lat == null || !nextCoord.value
    ? null
    : bearingDeg(gps.lat, gps.lon, nextCoord.value.纬度, nextCoord.value.经度)
);
const compassText = computed(() => (bearing.value == null ? "--" : COMPASS[Math.round(bearing.value / 45) % 8]));

const guideText = computed(() => {
  if (!nextPoiName.value) return "本日行程已全部完成 🎉";
  if (nextDistanceM.value == null) return `定位后显示前往「${nextPoiName.value}」的实时指引`;
  if (nextDistanceM.value <= 40) return `已到达「${nextPoiName.value}」，可以前往下一站`;
  const mins = travelMode.value === "walk" ? walkMins.value : driveMins.value;
  return `向${compassText.value}前行 ${distanceText.value}，${travelMode.value === "walk" ? "步行" : "乘车"}约 ${mins} 分钟到达「${nextPoiName.value}」`;
});

/* ============ 区域元数据：民族 / 建筑类型 / 民族元素 ============ */
const regionMeta = computed(() => ({
  民族: cityFeature.value?.民族 || "",
  建筑类型: cityFeature.value?.建筑类型 || [],
  民族元素: cityFeature.value?.民族元素 || [],
}));

/* ============ 真实地形标注（当地山川/湖泊/特色/建筑类型/民族元素） ============ */
const terrainLabels = ref([]);
const floraIcons = ref([]);

async function loadTerrains() {
  const cf = cityFeature.value;
  if (!cf) return;
  floraIcons.value = cf.植被?.length ? cf.植被 : ["🌳", "🌿"];
  const poiNames = new Set(currentPois.value.map((p) => p.名称));
  const names = [
    ...new Set([
      ...(cf.特色建筑 || []).slice(0, 3),
      ...(cf.地形 || []).slice(0, 3),
      ...(cf.特色元素 || []).slice(0, 3),
      ...(cf.建筑类型 || []).slice(0, 2),
      ...(cf.民族元素 || []).slice(0, 3),
    ]),
  ].filter((n) => n && !poiNames.has(n));
  if (!names.length) return;
  const icons = assignIcons(names.map((n) => ({ 名称: n })));
  try {
    const r = await api.getPoiCoords(cityName.value || destination.value, names);
    const byName = {};
    (r.打卡点 || []).forEach((c) => (byName[c.名称] = c));
    terrainLabels.value = names.map((n, i) => ({
      名称: n,
      纬度: byName[n]?.纬度 ?? null,
      经度: byName[n]?.经度 ?? null,
      ico: icons[i]?.emoji || "📍",
      isMountain: /山|峰|岭|峡|崖|洞|梯田/.test(n),
    }));
  } catch (e) { /* 忽略 */ }
}

const cityName = ref("");
async function loadPoiCoords() {
  const names = currentPois.value.map((p) => p.名称).filter(Boolean);
  if (!names.length) return;
  try {
    const r = await api.getPoiCoords(cityName.value || destination.value, names);
    const map = {};
    (r.打卡点 || []).forEach((c) => {
      if (c.纬度 != null) map[c.名称] = c;
    });
    poiCoords.value = map;
  } catch (e) { /* 忽略 */ }
}

/* ============ 定位：真实 GPS，失败自动转模拟 ============ */
function startGps() {
  if (!navigator.geolocation) {
    gpsState.value = "err";
    startSimWalk();
    return;
  }
  if (gpsWatch) return;
  gpsState.value = "idle";
  gpsWatch = navigator.geolocation.watchPosition(
    (pos) => {
      gpsState.value = "on";
      gps.lat = pos.coords.latitude;
      gps.lon = pos.coords.longitude;
      autoAdvanceByGps();
    },
    (err) => {
      console.warn("[GPS] 定位失败，改用模拟定位:", err.message);
      gpsState.value = "err";
      startSimWalk();
    },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 8000 }
  );
}

// 走到下一站 40 米内自动打卡
function autoAdvanceByGps() {
  if (gps.lat == null) return;
  const next = currentStop.value + 1;
  if (next >= currentPois.value.length) return;
  const c = poiCoords.value[currentPois.value[next]?.名称];
  if (!c) return;
  if (toMeters(gps.lat, gps.lon, c.纬度, c.经度) <= 40) arriveStop(next);
}

function startSimWalk() {
  if (simWalkTimer) return;
  simWalkTimer = setInterval(() => {
    if (gps.lat == null) {
      const first = poiCoords.value[currentPois.value[0]?.名称];
      if (first) {
        gps.lat = first.纬度;
        gps.lon = first.经度;
      }
    }
    autoAdvanceByGps();
  }, 3000);
}

function stopGps() {
  if (gpsWatch && navigator.geolocation) navigator.geolocation.clearWatch(gpsWatch);
  gpsWatch = null;
  if (simWalkTimer) clearInterval(simWalkTimer);
  simWalkTimer = null;
}

/* ============ 行程推进 ============ */
function arriveStop(next) {
  if (next >= currentPois.value.length) return;
  currentStop.value = next;
  clockMinutes.value = schedule.value[next]?.arrive ?? clockMinutes.value;
  showToast(`🕒 ${clockText.value} 已到达 ${currentPois.value[next]?.名称 || "目的地"}`);
}

function nextStop() {
  if (currentStop.value >= currentPois.value.length - 1) {
    showToast(`🎉 本日行程已全部完成！约 ${dayEndText.value} 结束`);
    return;
  }
  arriveStop(currentStop.value + 1);
}

function jumpTo(i) {
  if (i >= currentPois.value.length) return;
  currentStop.value = i;
  syncClock();
}

function switchDay(i) {
  const day = routeDays.value[i];
  if (!day || i === dayIndex.value) return;
  currentStop.value = 0;
  dayIndex.value = i;
  currentDay.value = day;
  currentPois.value = day.打卡点 || [];
  syncClock();
  loadPoiCoords();
  showToast(`🕒 已切换到第 ${day.第几天} 天行程`);
}

function showToast(msg) {
  toast.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = ""), 2400);
}

/* ============ 初始化 ============ */
onMounted(async () => {
  const q = router.currentRoute.value.query;
  const urlTo = typeof q.to === "string" ? q.to : "";
  const urlSid = typeof q.sid === "string" ? q.sid : "";

  let state = null;
  if (urlSid) {
    localStorage.setItem("travel_session_id", urlSid);
    state = await api.getSession(urlSid).catch(() => null);
  }
  if (!state) state = await session.getState().catch(() => null);
  const input = state?.input || {};
  destination.value = urlTo || input.目的地 || "";

  if (!destination.value) {
    noInput.value = true;
    return;
  }

  // 天气场景 + 城市特色（含区域元数据）
  try {
    const sc = await api.getScenario(destination.value);
    Object.assign(scenario, sc);
    const w = await api.getWeather(destination.value);
    Object.assign(weather, w);
  } catch (e) { console.error(e); }

  let cf = null;
  try {
    cf = await api.getCityFeature(destination.value);
    cityFeature.value = cf;
  } catch (e) { console.error(e); }
  cityName.value = cf?.城市 || destination.value;

  // 完整路线：已选路线 → session 里存的第一条 → 按目的地 POI 合成
  const routes = state?.routes || [];
  const selected = state?.selected_route || routes[state?.selected_index ?? 0] || routes[0] || null;
  if (selected && selected.每日行程?.length) {
    fullRoute.value = selected;
    dayIndex.value = 0;
    currentDay.value = selected.每日行程[0];
    currentPois.value = selected.每日行程[0].打卡点 || [];
  }
  if (!currentPois.value.length) {
    const fallbackPois = await api.searchPoi(cf?.城市 || destination.value).catch(() => []);
    currentPois.value = fallbackPois;
    fullRoute.value = {
      路线名: `${destination.value} · 推荐打卡路线`,
      适合人群: "通用",
      强度: "经典",
      亮点: "按当地著名景点与特色美食自动编排，可逐段导航",
      全程交通: [],
      每日行程: [{
        第几天: 1,
        天气: `${weather.天气} ${weather.温度}°`,
        地形: cf?.地形?.[0] || "城区",
        打卡点: fallbackPois,
      }],
    };
    currentDay.value = fullRoute.value.每日行程[0];
  }

  syncClock();
  await loadPoiCoords();
  await loadTerrains();
  startGps();
});

onUnmounted(() => {
  stopGps();
  if (toastTimer) clearTimeout(toastTimer);
});

/* ============ 页面跳转 ============ */
function goRoutes() {
  const q = router.currentRoute.value.query;
  const sid = localStorage.getItem("travel_session_id") || q.sid || "";
  router.push({
    path: "/routes",
    query: { sid, from: q.from || "", to: q.to || destination.value, days: q.days || "" },
  });
}

// 回到我的位置（真实 GPS 定位）
function goWalk() {
  startGps();
  showToast(gpsState.value === "on" ? "🛰 已回到我的位置" : "🛰 定位中，请允许获取位置权限");
}

function exitToHome() {
  const q = router.currentRoute.value.query;
  const sid = localStorage.getItem("travel_session_id") || q.sid || "";
  router.push({
    path: "/",
    query: { sid, from: q.from || "", to: q.to || destination.value, days: q.days || "" },
  });
}
</script>

<style scoped>
/* 行程时钟 */
.clock-chip {
  background: #eef6ff; color: var(--blue); font-size: 12px;
  padding: 3px 8px; border-radius: 12px; font-variant-numeric: tabular-nums;
}

/* 导航指引条 */
.guide-bar {
  display: flex; align-items: center; gap: 8px; margin: 10px 16px 0;
  background: #fff8ec; border: 1px solid #ffe0b2; border-radius: 12px; padding: 7px 10px;
}
.g-arrow { font-size: 15px; color: #ff8b00; transition: transform 0.3s ease; flex: none; }
.g-text { flex: 1; font-size: 12.5px; line-height: 1.35; }
.g-text em { display: block; font-style: normal; font-size: 11px; color: var(--text-light); margin-top: 1px; }
.g-toggle {
  flex: none; border: none; background: var(--primary); color: #fff;
  font-size: 11px; padding: 5px 10px; border-radius: 10px; cursor: pointer;
}

/* 地图容器 */
.real-wrap { height: 420px; margin: 8px 16px 12px; display: flex; flex-direction: column; gap: 8px; }
.real-wrap .real-map { flex: 1; min-height: 0; }
.nearby-strip { display: flex; align-items: center; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
.nb-title { font-size: 11px; color: var(--text-light); flex: none; }
.nb-chip {
  flex: none; font-size: 11px; background: #fff; border: 1px solid #e6eef8;
  border-radius: 12px; padding: 3px 8px; color: var(--text);
}
.nb-chip em { font-style: normal; color: var(--blue); margin-left: 3px; }

/* 民族特色 / 当地建筑（区域元数据驱动） */
.ethnic-strip {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  margin: 0 16px 10px; padding: 7px 10px;
  background: #f7f4ff; border: 1px solid #e8e0fb; border-radius: 12px;
}
.et-main { font-size: 12px; font-weight: 600; color: #6a4fb6; }
.et-tag {
  font-size: 11px; color: #6b5a8f; background: #fff;
  border: 1px solid #ece6fa; border-radius: 10px; padding: 2px 7px;
}
.et-elem { color: #8a6a3a; border-color: #f0e6d6; background: #fffdf7; }

/* 天数切换 */
.day-switch { display: flex; align-items: center; gap: 6px; margin: 6px 0 2px; flex-wrap: wrap; }
.ds-hint { font-size: 11px; color: var(--text-light); }
.ds-tab {
  border: 1px solid #dbe7f5; background: #fff; color: var(--text);
  font-size: 11px; padding: 3px 8px; border-radius: 12px; cursor: pointer;
}
.ds-tab em { font-style: normal; color: var(--text-light); margin-left: 3px; }
.ds-tab.active { background: var(--primary); border-color: var(--primary); color: #fff; }
.ds-tab.active em { color: rgba(255, 255, 255, 0.85); }
.day-clock {
  text-align: center; font-size: 12px; color: var(--text-light);
  margin: 4px 0 8px; padding: 4px 8px; background: #f6f9ff; border-radius: 10px;
}
.gps-inline { display: block; font-size: 11px; color: var(--blue); margin-top: 2px; }

/* 当天时间线 */
.timeline .item { display: flex; align-items: center; gap: 8px; padding: 6px 0; cursor: pointer; }
.timeline .item-done { opacity: 0.5; }
.timeline .item-cur { background: #eef6ff; border-radius: 8px; padding: 6px 8px; }
.t-order {
  flex: none; width: 18px; height: 18px; border-radius: 50%;
  background: #eef3fa; color: var(--text-light); font-size: 10px;
  display: flex; align-items: center; justify-content: center;
}
.item-cur .t-order { background: var(--primary); color: #fff; }
.item-done .t-order { background: #d8ecdd; color: #57a06f; }
.t-ico { font-size: 14px; flex: none; }
.t-time { font-size: 11px; color: var(--text-light); min-width: 78px; }
.t-name { font-size: 14px; font-weight: 500; }
.traffic { font-size: 11px; color: var(--blue); margin-left: auto; }
.empty-tip { text-align: center; font-size: 12px; color: var(--text-light); padding: 10px 0; }

/* 完整路线面板 */
.full-route { margin-top: 12px; border-top: 1px dashed #e6edf5; padding-top: 8px; }
.fr-head { display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
.fr-title { font-size: 13px; font-weight: 600; }
.fr-badge {
  font-style: normal; font-size: 10px; margin-left: 6px; padding: 1px 6px;
  border-radius: 8px; background: #fff3d6; color: #b06a00;
}
.fr-count { font-style: normal; font-size: 11px; color: var(--text-light); margin-left: 6px; }
.fr-toggle { font-size: 11px; color: var(--blue); }
.fr-body { margin-top: 8px; }
.fr-meta { font-size: 11px; color: var(--text-light); line-height: 1.6; }
.fr-src { font-style: normal; color: #b0b8c4; }
.fr-day {
  margin-top: 8px; padding: 6px 8px; border-radius: 8px; background: #f8fbff;
  cursor: pointer; border: 1px solid transparent;
}
.fr-day.active { border-color: var(--primary); background: #fff8ec; }
.fr-day-title { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
.fr-day-title em { font-style: normal; font-weight: 400; color: var(--text-light); font-size: 11px; }
.fr-poi { display: flex; align-items: center; gap: 6px; font-size: 11px; padding: 2px 0; }
.fr-idx {
  flex: none; width: 14px; height: 14px; border-radius: 50%;
  background: #dceaf9; color: #3d7bbd; font-size: 9px;
  display: flex; align-items: center; justify-content: center;
}
.fr-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fr-time { color: var(--text-light); }
.fr-traffic { color: var(--blue); min-width: 62px; text-align: right; }

/* toast */
.toast {
  position: fixed; left: 50%; top: 14%; transform: translateX(-50%);
  background: rgba(30, 40, 60, 0.88); color: #fff; font-size: 13px;
  padding: 9px 18px; border-radius: 20px; z-index: 99;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25); white-space: nowrap;
}
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, -8px); }
</style>
