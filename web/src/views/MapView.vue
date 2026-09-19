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

    <!-- 卡通地图 -->
    <div v-if="!noInput" class="map" :class="scenario.场景">
      <!-- 世界层：相机跟随人物平移 -->
      <div class="map-world" :style="worldStyle">
        <!-- 植被层：按目的地气候 + 当前天气生成 -->
        <div class="flora-layer">
          <span v-for="(f, i) in floras" :key="'f'+i" class="flora"
                :style="{ left: f.left+'%', top: f.top+'%', fontSize: f.size+'px', animationDelay: f.delay+'s' }">
            {{ f.ico }}
          </span>
        </div>

        <!-- 地形与建筑：来自目的地的著名建筑 / 山川地形 / 特色元素 -->
        <div class="terrain-layer">
          <span v-for="(t, i) in activeTerrains" :key="'t'+i" class="t-item"
                :class="t.kind" :style="t.style">
            <span class="t-emoji">{{ t.ico }}</span> {{ t.name }}
          </span>
        </div>

        <!-- 导航路径：串联打卡点 + 交通耗时 -->
        <svg class="path-svg" viewBox="0 0 400 400" preserveAspectRatio="none">
          <!-- 已走过的路线（实线） -->
          <path v-for="(seg, i) in walkedSegments" :key="'w'+i" :d="seg.d"
                :stroke="seg.stroke" stroke-width="4" fill="none"/>
          <!-- 移动中的当前段（高亮实线） -->
          <path v-if="movingSeg" :d="movingSeg.d" :stroke="movingSeg.stroke"
                stroke-width="5" fill="none" stroke-linecap="round"/>
          <!-- 待走的路线（虚线） -->
          <path v-for="(seg, i) in remainingSegments" :key="'r'+i" :d="seg.d"
                :stroke="seg.stroke" stroke-width="4" stroke-dasharray="8 6" fill="none"/>
        </svg>

        <!-- 路段信息标注：贴在每段路径中点，显示该段交通方式+耗时 -->
        <div class="seg-label-layer">
          <span v-for="(s, i) in segLabels" :key="'s'+i"
                class="seg-chip" :class="{ done: i < currentStop }" :style="s.style">
            {{ s.text }}
          </span>
        </div>

        <!-- 打卡点标注：序号 + 名称 + 预计到达时刻 -->
        <div class="poi-layer">
          <div v-for="(p, i) in pois" :key="i" class="poi"
               :class="{ 'poi-done': i < currentStop, 'poi-cur': i === currentStop }"
               :style="poiPos(i)">
            <span class="p-order">{{ i + 1 }}</span>
            <span class="p-body">
              <span class="p-name">{{ p.名称 }}</span>
              <span class="p-eta">🕒 {{ poiEta(i) }}</span>
            </span>
          </div>
        </div>

        <!-- 卡通人物（沿路径实时移动）：标签放头顶，脚下留出接地阴影 -->
        <div class="avatar" :class="{ walking: navigating, 'face-left': faceLeft }" :style="avatarStyle">
          <span class="you-tag">{{ navigating ? "导航中" : "当前位置" }}</span>
          <span class="char">{{ avatarEmoji }}<span v-if="scenario.配饰 === '雨伞'" class="umbrella">☂️</span></span>
        </div>
      </div>

      <!-- 天气粒子：雨/雪（覆盖全图，不随相机移动） -->
      <div v-if="scenario.雨滴 > 0" class="rain-layer">
        <span v-for="n in 40" :key="n" class="drop"
              :style="{ left: (n*23)%100+'%', animationDelay: (n*0.13)+'s' }"></span>
      </div>
      <div v-if="scenario.雪花 > 0" class="snow-layer">
        <span v-for="n in 30" :key="n" class="flake"
              :style="{ left: (n*31)%100+'%', animationDelay: (n*0.2)+'s' }">❄</span>
      </div>
      <!-- 太阳（晴天） -->
      <div v-if="scenario.太阳" class="sun">☀️</div>
      <div v-if="scenario.太阳" class="sun-temp">{{ weather.天气 }} {{ weather.温度 }}°</div>

      <!-- 实时导航状态条 -->
      <div v-if="navigating" class="nav-status">
        <div class="nav-row">
          <span class="nav-walk">🚶</span>
          <span class="nav-text">
            正在前往 <b>{{ navInfo.target }}</b>
            <em class="nav-mode">
              {{ modeIcon(navInfo.mode) }} {{ navInfo.mode }} · 约{{ navInfo.mins }}分钟{{ navInfo.km ? ` · ${navInfo.km}` : "" }} ·
              预计 <b class="eta">{{ etaText }}</b> 到达（还有 {{ etaLeftMins }} 分钟）
            </em>
          </span>
          <button class="nav-skip" @click="skipNav">跳过 »</button>
        </div>
        <div class="nav-progress"><div class="nav-progress-bar" :style="{ width: (navProgress*100)+'%' }"></div></div>
      </div>
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
      </div>
      <div class="timeline">
        <div v-for="(p, i) in currentPois" :key="i" class="item"
             :class="{ 'item-done': i < currentStop, 'item-cur': i === currentStop,
                       'item-next': navigating && i === currentStop + 1 }"
             @click="jumpTo(i)">
          <span class="t-order">{{ i + 1 }}</span>
          <span class="t-time">{{ arriveLabel(i) }}</span>
          <span class="t-name">{{ p.名称 }}</span>
          <span class="traffic">{{ modeIcon(p.交通?.推荐方式) }} {{ p.交通?.推荐方式 }}·{{ p.交通?.耗时 }}</span>
        </div>
      </div>
      <div v-if="!currentPois.length" class="empty-tip">暂无打卡点数据，请返回"我的路线"重新生成</div>
      <div style="display:flex;gap:12px;margin-top:12px;">
        <button class="btn btn-primary" style="flex:1" @click="nextStop" :disabled="navigating">
          {{ currentStop >= currentPois.length - 1 ? "行程结束 ✅" : (navigating ? "导航中…" : "继续导航 →") }}
        </button>
        <button class="btn btn-outline" style="flex:1" @click="goRoutes">我的路线</button>
      </div>
      <button class="btn btn-ghost" style="width:100%;margin-top:10px;" @click="goWalk">
        🧭 GPS 步行导航（真实地图 · 3D 建筑）
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

const router = useRouter();

const weather = reactive({ 温度: 25, 天气: "晴", 图标: "☀️" });
const scenario = reactive({ 场景: "sunny", 太阳: true, 雨滴: 0, 雪花: 0, 配饰: "墨镜" });
const destination = ref("");
const avatarEmoji = ref("🧍‍♀️");
const currentDay = ref({ 第几天: 1, 地形: "平原", 打卡点: [] });
const currentPois = ref([]);
const currentStop = ref(0); // 当前所在打卡点下标
const navigating = ref(false); // 是否正在沿路径移动
const navProgress = ref(0); // 当前段移动进度 0~1
const navInfo = reactive({ target: "", mode: "步行", mins: 10, km: "" });
const faceLeft = ref(false);
const noInput = ref(false); // 无行程时的空态
const toast = ref("");

/* 完整路线（与地图同源：底部面板展示规划结果的全部天数） */
const fullRoute = ref(null);
const dayIndex = ref(0);
const showFull = ref(true); // 默认展开：底部面板直接呈现完整规划结果
let rafId = null;
let toastTimer = null;

// 地图上画出当天全部打卡点（与底部时间线一一对应）
const pois = computed(() => currentPois.value);

/* ============ 植被层：按目的地气候（后端 cityFeature）+ 当前天气生成 ============ */
// 按当前天气场景叠加的气候元素（雪天叠加雪山/雪人，雨天叠加水滴）
const SCENE_FLORA = {
  snowy: ["❄️", "☃️", "🏔️"],
  rainy: ["💧", "🌧️", "🍄"],
};
// 植被固定分布点位（伪随机散布，避开路径中心带）
const FLORA_SPOTS = [
  [6, 12, 26], [70, 8, 22], [8, 55, 30], [72, 50, 26], [12, 82, 24],
  [68, 84, 28], [40, 6, 22], [58, 90, 24], [30, 70, 20], [62, 28, 20],
];

const floras = computed(() => {
  // 气候植被取自后端 cityFeature（城市 → 省份气候兜底），前端不再硬编码省份表
  const base = cityFeature.value?.植被?.length
    ? cityFeature.value.植被
    : ["🌳", "🌿", "🌸", "🌾"];
  const byScene = SCENE_FLORA[scenario.场景] || [];
  // 晴天高温 → 偏热带感；低温 → 偏秋冬感
  let byTemp = [];
  if (scenario.场景 !== "snowy" && scenario.场景 !== "rainy") {
    if (weather.温度 >= 27) byTemp = ["☀️", "🌾"];
    else if (weather.温度 <= 10) byTemp = ["🍂", "🍁"];
  }
  const pool = [...base, ...byScene, ...byTemp];
  return FLORA_SPOTS.map(([l, t, s], i) => ({
    ico: pool[i % pool.length],
    left: toWorld(l), top: toWorld(t), size: s,
    delay: (i * 0.7) % 3,
  }));
});

/* ============ 地形标注：来自目的地的著名建筑 / 地形 / 特色元素 ============ */
const cityFeature = ref(null); // 后端城市特色数据（含气候植被）
const TERRAIN_SPOTS = [
  [10, 16], [64, 12], [14, 42], [66, 46], [12, 64], [64, 72], [42, 88],
];

// 当前站点对应的地形（高亮与当前 POI 匹配的标注）
// 与打卡点重名的当地建筑不再重复标注，避免地图上同一地点出现两个气泡
const activeTerrains = computed(() => {
  const cur = Math.min(currentStop.value, pois.value.length - 1);
  const curPoi = pois.value[cur]?.名称 || "";
  const poiNames = pois.value.map((p) => p.名称 || "");
  return terrains.value
    .filter((t) => !poiNames.some((n) => n && (n.includes(t.name) || t.name.includes(n))))
    .map((t, i) => ({
      ...t,
      active: curPoi.includes(t.name),
      style: terrainPos(i),
    }));
});

const terrains = ref([]);

function terrainPos(offset) {
  const [l, t] = TERRAIN_SPOTS[offset % TERRAIN_SPOTS.length];
  const x = toWorld(l);
  // 靠右的标注改为向左展开，避免长名字被地图右边裁掉
  return {
    left: `${x}%`,
    top: `${toWorld(t)}%`,
    transform: x > 52 ? "translateX(-100%)" : "translateX(0)",
  };
}

/* ============ 坐标空间换算 ============
 * .map-world 用 inset:-14% 放大一圈供相机平移，其内部子元素的百分比是"世界层"坐标，
 * 直接写地图可视区的百分比会被裁掉（标注跑到地图外）。统一用 toWorld 换算。 */
const WORLD_INSET = 14; // 与 .map-world 的 inset 保持一致
const WORLD_SCALE = (100 + WORLD_INSET * 2) / 100;
function toWorld(percent) {
  return +((percent + WORLD_INSET) / WORLD_SCALE).toFixed(2);
}

/* ============ POI 坐标（世界层百分比空间，DOM 与 SVG 共用） ============ */
function poiPos(i) {
  return {
    left: `${toWorld(20 + (i * 16) % 56)}%`,
    top: `${toWorld(20 + (i * 13) % 48)}%`,
  };
}
// 百分比 → viewBox(400x400) 坐标，与 DOM left%/top% 精确对齐（preserveAspectRatio=none）
function poiXY(i) {
  const p = poiPos(i);
  return { x: parseFloat(p.left) * 4, y: parseFloat(p.top) * 4 };
}
// 段的贝塞尔控制点（百分比空间）：与 buildSegments/movingSeg 的 Q 控制点完全一致
// 绘制用 viewBox(400) 的 -20 → 百分比空间换算为 -20 / 4 = -5%
function segMid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 5 };
}
// 二次贝塞尔插值（百分比空间）
function quadBez(a, m, b, t) {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * m.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * m.y + t * t * b.y,
  };
}

// 导航路径分段
function buildSegments(fromIdx, toIdx) {
  const pts = [];
  for (let i = fromIdx; i <= toIdx; i++) pts.push(poiXY(i));
  if (pts.length < 2) return [];
  const colors = ["#4aa3ff", "#34c77b", "#f5a623", "#e47fd0", "#ff6b6b"];
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 20;
    segs.push({
      d: `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`,
      stroke: colors[i % colors.length],
    });
  }
  return segs;
}
// 已走路径（实线）
const walkedSegments = computed(() => {
  if (currentStop.value < 1) return [];
  return buildSegments(0, currentStop.value);
});
// 待走路径（虚线）
const remainingSegments = computed(() => {
  const end = pois.value.length - 1;
  const start = navigating.value ? currentStop.value + 1 : currentStop.value;
  if (start >= end) return [];
  return buildSegments(start, end);
});
// 移动中的当前段（高亮）
const movingSeg = computed(() => {
  if (!navigating.value) return null;
  const a = poiXY(currentStop.value), b = poiXY(currentStop.value + 1);
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 20;
  return {
    d: `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`,
    stroke: "#4aa3ff",
  };
});

/* ============ 人物位置：静止在站点，导航中沿贝塞尔路径实时移动 ============ */
const avatarPos = reactive({ x: 50, y: 50 }); // 百分比坐标

const avatarStyle = computed(() => ({
  left: `${avatarPos.x}%`,
  top: `${avatarPos.y}%`,
}));

function snapToStop(i) {
  const p = poiPos(Math.min(i, pois.value.length - 1));
  avatarPos.x = parseFloat(p.left);
  avatarPos.y = parseFloat(p.top);
}

// 相机跟随：世界层反向平移，人物趋向画面中心（高德式跟随导航）
// 位移按"地图可视区百分比"计算后换算成世界层百分比，避免平移过多把边缘标注挤出画面
const CAMERA_MAX = 8;
const worldStyle = computed(() => {
  const clamp = (v) => Math.max(-CAMERA_MAX, Math.min(CAMERA_MAX, v));
  const dx = clamp((50 - avatarPos.x) * 0.35);
  const dy = clamp((50 - avatarPos.y) * 0.35);
  return { transform: `translate(${(dx / WORLD_SCALE).toFixed(2)}%, ${(dy / WORLD_SCALE).toFixed(2)}%)` };
});

function showToast(msg) {
  toast.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = ""), 2400);
}

// 从交通耗时字符串解析分钟数（"约25分钟" / "25min"）
function parseMinutes(text) {
  const m = String(text || "").match(/(\d+)\s*(分钟|min)/);
  return m ? parseInt(m[1], 10) : null;
}

/* ============ 真实钟表时间：从首站推荐时间起算，逐段按真实交通耗时推进 ============ */
const DEFAULT_START = 9 * 60; // 无推荐时间时默认 09:00 出发
const clockMinutes = ref(DEFAULT_START); // 当前行程时钟（当日 0 点起的分钟数）
const navEta = ref(DEFAULT_START); // 本段导航的预计到达时刻

const MODE_ICON = {
  步行: "🚶", 骑行: "🚴", 公交: "🚌", 地铁: "🚇",
  打车: "🚕", 高铁: "🚄", 自驾: "🚗", 长途大巴: "🚌",
};
function modeIcon(mode) {
  return MODE_ICON[mode] || "🚇";
}

// 解析 "09:00" → 分钟数
function parseClock(text) {
  const m = String(text || "").match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Math.min(23, parseInt(m[1], 10)) * 60 + Math.min(59, parseInt(m[2], 10));
}

// 解析 "09:00-11:00" → { start, end }（分钟数，跨夜自动 +1440）
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

// 各类型打卡点的默认游玩时长（分钟）；有推荐时间段时优先用时间段长度
const PLAY_MIN = {
  "美食打卡": 60, 夜游: 60, "休闲街区": 75,
  "标志性景点": 100, "人文历史": 90, "自然风光": 120,
};
function playMinutes(p) {
  const r = parseTimeRange(p?.推荐时间);
  if (r && r.end > r.start) return Math.min(300, r.end - r.start);
  return PLAY_MIN[p?.类型] || 90;
}

// 逐段推演：到达 = 上一站离开 + 真实交通耗时；离开 = 到达 + 游玩时长
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

/* ============ 完整路线：天数 / 每天时间推演，供底部面板使用 ============ */
const routeDays = computed(() => fullRoute.value?.每日行程 || []);
const daySchedules = computed(() => routeDays.value.map((d) => buildSchedule(d.打卡点 || [])));
const totalPoiCount = computed(() =>
  routeDays.value.reduce((n, d) => n + (d.打卡点?.length || 0), 0)
);

// 完整路线里某天某点的到达时刻（当前天用实时推演值）
function dayEta(di, pi, poi) {
  const s = daySchedules.value[di]?.[pi];
  return s ? `${fmtClock(s.arrive)} 到达` : (poi?.推荐时间 || "");
}

// 地图上的点位到达时刻
function poiEta(i) {
  const s = schedule.value[i];
  return s ? fmtClock(s.arrive) : "--:--";
}

// 切换到某一天：地图点位、路径、时间线、时钟一起同步
function switchDay(i) {
  const day = routeDays.value[i];
  if (!day || i === dayIndex.value) return;
  cancelRaf();
  navigating.value = false;
  navProgress.value = 0;
  currentStop.value = 0;
  dayIndex.value = i;
  currentDay.value = day;
  currentPois.value = day.打卡点 || [];
  snapToStop(0);
  syncClock();
  showToast(`🕒 已切换到第 ${day.第几天} 天行程`);
}

// 点击时间线某条 → 人物直接落到该站（已走过的点可回看）
function jumpTo(i) {
  if (navigating.value || i >= currentPois.value.length) return;
  currentStop.value = i;
  snapToStop(i);
  syncClock();
}

/* ============ 路段信息标注：贴在每段贝塞尔曲线中点，并沿法线外移避免压住打卡点 ============ */
const segLabels = computed(() => {
  const list = currentPois.value;
  const out = [];
  const clamp = (v) => Math.max(6, Math.min(94, v));
  for (let i = 0; i < list.length - 1; i++) {
    const a = poiXY(i);
    const b = poiXY(i + 1);
    const mid = quadBez(a, segMid(a, b), b, 0.5); // viewBox 坐标
    // 沿路径法线方向偏移，让耗时标签落在路线旁边而不是压住节点气泡
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const off = 30; // viewBox 单位 ≈ 7.5%
    const nx = -dy / len;
    const ny = dx / len;
    const seg = list[i + 1]?.交通 || {};
    const mins = parseMinutes(seg.耗时);
    out.push({
      text: `${modeIcon(seg.推荐方式)}${mins ? mins + "′" : (seg.推荐方式 || "")}`.trim(),
      style: {
        left: `${clamp((mid.x + nx * off) / 4)}%`,
        top: `${clamp((mid.y + ny * off) / 4)}%`,
      },
    });
  }
  return out;
});

const clockText = computed(() => fmtClock(clockMinutes.value));
const etaText = computed(() => fmtClock(navEta.value));
const etaLeftMins = computed(() => Math.max(0, Math.round(navEta.value - clockMinutes.value)));
const dayStartText = computed(() => (schedule.value.length ? fmtClock(schedule.value[0].arrive) : "--:--"));
const dayEndText = computed(() =>
  schedule.value.length ? fmtClock(schedule.value[schedule.value.length - 1].leave) : "--:--"
);
const totalMinsText = computed(() => {
  if (!schedule.value.length) return "--";
  const mins = schedule.value[schedule.value.length - 1].leave - schedule.value[0].arrive;
  return `全程约 ${Math.floor(mins / 60)} 小时 ${mins % 60} 分`;
});

// 时间线每项的到达标注
function arriveLabel(i) {
  const s = schedule.value[i];
  if (!s) return "";
  const t = fmtClock(s.arrive);
  if (navigating.value && i === currentStop.value + 1) return `预计 ${t} 到达`;
  if (i === currentStop.value) return `${t} 在此`;
  if (i < currentStop.value) return `${t} 已到`;
  return `${t} 到达`;
}

// 时钟回落到当前所在站点的到达时刻
function syncClock() {
  const s = schedule.value[Math.min(currentStop.value, schedule.value.length - 1)];
  clockMinutes.value = s ? s.arrive : DEFAULT_START;
}

/* ============ 实时导航：rAF 沿路径逐帧移动，不再瞬移 ============ */
function nextStop() {
  if (navigating.value) return;
  if (currentStop.value >= currentPois.value.length - 1) {
    showToast(`🎉 本日行程已全部完成！约 ${dayEndText.value} 结束`);
    return;
  }
  const next = currentStop.value + 1;
  const targetPoi = currentPois.value[next];
  navInfo.target = targetPoi?.名称 || "下一站";
  navInfo.mode = targetPoi?.交通?.推荐方式 || "步行";
  navInfo.mins = parseMinutes(targetPoi?.交通?.耗时) || 10;
  navInfo.km = targetPoi?.交通?.里程 || ""; // 后端按真实经纬度算出的路程

  const a = { ...avatarPos };
  const bp = poiPos(next);
  const b = { x: parseFloat(bp.left), y: parseFloat(bp.top) };
  const m = segMid(a, b);
  faceLeft.value = b.x < a.x;

  // 移动时长按真实耗时映射：约 2.6s ~ 6s（快速模拟）
  const duration = Math.min(6000, Math.max(2600, navInfo.mins * 180));
  navigating.value = true;
  navProgress.value = 0;

  // 时钟从"离开上一站"推进到"预计到达下一站"
  const startClock = schedule.value[currentStop.value]?.leave ?? clockMinutes.value;
  navEta.value = schedule.value[next]?.arrive ?? startClock + navInfo.mins;
  clockMinutes.value = startClock;

  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOut
    const p = quadBez(a, m, b, eased);
    avatarPos.x = p.x;
    avatarPos.y = p.y;
    navProgress.value = t;
    // 钟表时间随导航进度同步推进
    clockMinutes.value = Math.round(startClock + (navEta.value - startClock) * t);
    if (t < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      arriveStop(next);
    }
  }
  rafId = requestAnimationFrame(step);
}

// 到达打卡
function arriveStop(next) {
  cancelRaf();
  currentStop.value = next;
  snapToStop(next);
  navigating.value = false;
  clockMinutes.value = schedule.value[next]?.arrive ?? clockMinutes.value;
  showToast(`🕒 ${clockText.value} 已到达 ${currentPois.value[next]?.名称 || "目的地"}`);
}

// 跳过导航动画（直接到达）
function skipNav() {
  if (!navigating.value) return;
  arriveStop(currentStop.value + 1);
}

function cancelRaf() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

onMounted(async () => {
  // 1. 优先使用 URL query 的 to（Routes 跳转时传入，最可靠）
  const q = router.currentRoute.value.query;
  const urlTo = typeof q.to === "string" ? q.to : "";
  const urlSid = typeof q.sid === "string" ? q.sid : "";

  // 2. 尝试从 session 读取
  let state = null;
  if (urlSid) {
    localStorage.setItem("travel_session_id", urlSid);
    state = await api.getSession(urlSid).catch(() => null);
  }
  if (!state) {
    state = await session.getState().catch(() => null);
  }
  const input = state?.input || {};
  // 3. 合并：URL 的 to 优先级最高
  destination.value = urlTo || input.目的地 || "";

  // 直达 /map 但无目的地 → 显示空态引导，不强制跳回
  if (!destination.value) {
    noInput.value = true;
    return;
  }

  // 天气场景 + 城市（著名建筑/地形/特色元素/植被气候）
  let cf = null;
  try {
    const sc = await api.getScenario(destination.value);
    Object.assign(scenario, sc);
    const w = await api.getWeather(destination.value);
    Object.assign(weather, w);
  } catch (e) { console.error(e); }
  try {
    cf = await api.getCityFeature(destination.value);
    cityFeature.value = cf;
    terrains.value = buildTerrains(cf);
  } catch (e) { console.error(e); }

  // 完整路线：优先用已选路线；否则取 session 里存的第一条；再没有就按目的地 POI 合成单日行程
  const routes = state?.routes || [];
  const selected =
    state?.selected_route || routes[state?.selected_index ?? 0] || routes[0] || null;
  const poiCity = cf?.城市 || cf?.省份 || destination.value;

  if (selected && selected.每日行程?.length) {
    fullRoute.value = selected;
    dayIndex.value = 0;
    currentDay.value = selected.每日行程[0];
    currentPois.value = selected.每日行程[0].打卡点 || [];
  }
  if (!currentPois.value.length) {
    const fallbackPois = await api.searchPoi(poiCity).catch(() => []);
    currentPois.value = fallbackPois;
    // 没有已保存的路线时，用 POI 合成一份完整路线，保证底部面板与地图同源
    fullRoute.value = {
      路线名: `${destination.value} · 推荐打卡路线`,
      适合人群: "通用",
      强度: "经典",
      亮点: "按当地著名景点与特色美食自动编排，可逐段导航",
      全程交通: [],
      每日行程: [{ 第几天: 1, 天气: `${weather.天气} ${weather.温度}°`, 地形: cf?.地形?.[0] || "城区", 打卡点: fallbackPois }],
    };
    currentDay.value = fullRoute.value.每日行程[0];
  }
  snapToStop(0);
  // 时钟从首站推荐时间起算
  syncClock();
});

// 由城市特色数据生成地形标注：著名建筑 / 山川地形 / 特色元素（植被气候由植被层负责）
// 图标不再整类共用一个 emoji，而是按每个名称自动生成（同城市内也不重复）
function buildTerrains(cf) {
  const groups = [
    [(cf.特色建筑 || []).slice(0, 3), "t-building"],
    [(cf.地形 || []).slice(0, 3), "t-land"],
    [(cf.特色元素 || []).slice(0, 3), "t-culture"],
  ];
  const names = groups.flatMap(([list]) => list);
  const icons = assignIcons(names.map((n) => ({ 名称: n, 类型: cf.城市 })));
  let i = 0;
  return groups
    .flatMap(([list, kind]) =>
      list.map((n) => ({ ico: icons[i++]?.emoji || "📍", name: n, kind }))
    )
    .slice(0, 7);
}

onUnmounted(() => {
  cancelRaf();
  if (toastTimer) clearTimeout(toastTimer);
});

// 返回路线页：保留全部数据（from/to/sid 带过去，避免返回后空态/丢失）
function goRoutes() {
  const q = router.currentRoute.value.query;
  const sid = localStorage.getItem("travel_session_id") || q.sid || "";
  router.push({
    path: "/routes",
    query: {
      sid,
      from: q.from || "",
      to: q.to || destination.value,
      days: q.days || "",
    },
  });
}

// 进入 GPS 步行导航（真实坐标地图 + 3D 建筑）
function goWalk() {
  const q = router.currentRoute.value.query;
  const sid = localStorage.getItem("travel_session_id") || q.sid || "";
  router.push({ path: "/walk", query: { sid, to: q.to || destination.value } });
}

// 一键退出到首页：所有数据（出发地/目的地/行程/进度）都保留，不从 session 清除
function exitToHome() {
  const q = router.currentRoute.value.query;
  const sid = localStorage.getItem("travel_session_id") || q.sid || "";
  router.push({
    path: "/",
    query: {
      sid,
      from: q.from || "",
      to: q.to || destination.value,
      days: q.days || "",
    },
  });
}
</script>

<style scoped>
/* 行程时钟 */
.clock-chip {
  background: #eef6ff; color: var(--blue); font-size: 12px;
  padding: 3px 8px; border-radius: 12px; font-variant-numeric: tabular-nums;
}

/* 地图 = 俯视地面：底色用草地/土壤，元素才有"落地"的参照面（原来天空蓝会让所有元素悬空） */
.map {
  position: relative; height: 400px; margin: 12px 16px;
  border-radius: 16px; overflow: hidden;
  background: linear-gradient(180deg, #cfe6a8 0%, #eef6dc 62%, #dfecca 100%);
}
.map.sunny { background: linear-gradient(180deg, #cbe79f 0%, #eaf5d4 62%, #dcebca 100%); }
.map.rainy { background: linear-gradient(180deg, #a8bda9 0%, #cbd8c9 62%, #bccfc0 100%); }
.map.snowy { background: linear-gradient(180deg, #e6eef7 0%, #ffffff 62%, #e9f1f9 100%); }
.map.cloudy { background: linear-gradient(180deg, #bfd0b8 0%, #e2eae0 62%, #d4e0d2 100%); }
/* 地面纹理：草点 + 沙砾，强化"这是一块地面" */
.map::before {
  content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background-image:
    radial-gradient(rgba(255, 255, 255, 0.55) 1px, transparent 1.6px),
    radial-gradient(rgba(120, 160, 90, 0.16) 1.6px, transparent 2.4px);
  background-size: 22px 22px, 34px 34px;
  background-position: 0 0, 11px 17px;
}
/* 地平线：底部一条略深的地面带，给全局提供"地面参考平面" */
.map::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 26%;
  z-index: 0; pointer-events: none;
  background: linear-gradient(180deg, rgba(90, 130, 70, 0) 0%, rgba(90, 130, 70, 0.14) 100%);
}

/* 统一落地：所有悬浮物下方投射接地阴影 */
.flora::after,
.poi::after,
.t-item::after,
.seg-chip::after,
.sun-temp::after {
  content: ""; position: absolute; left: 50%; bottom: -5px;
  width: 76%; height: 7px; transform: translateX(-50%);
  background: radial-gradient(ellipse at center, rgba(45, 66, 32, 0.3), rgba(45, 66, 32, 0) 72%);
  border-radius: 50%; pointer-events: none;
}
/* 锚点：卡片下方的小圆点，表示它"钉"在地面的具体位置 */
.poi::before,
.t-item::before {
  content: ""; position: absolute; left: 50%; bottom: -6px;
  width: 5px; height: 5px; margin-left: -2.5px; border-radius: 50%;
  background: rgba(74, 163, 255, 0.9);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.85);
  pointer-events: none;
}
.t-item::before { background: rgba(120, 150, 110, 0.9); }

/* 世界层：相机跟随平移 */
.map-world {
  position: absolute; inset: -14%; z-index: 1; /* 扩大一圈避免平移露边 */
  transition: transform 0.35s ease-out;
}

/* 植被层 */
.flora-layer { position: absolute; inset: 0; }
.flora {
  position: absolute; transform: translate(-50%, -50%); opacity: 0.9;
  filter: drop-shadow(0 2px 2px rgba(0,0,0,0.12));
  animation: sway 3.2s ease-in-out infinite;
}
@keyframes sway {
  0%, 100% { transform: translate(-50%, -50%) rotate(-3deg); }
  50% { transform: translate(-50%, -50%) rotate(3deg); }
}

/* 太阳 + 温度 */
.sun { position: absolute; top: 8px; right: 14px; font-size: 40px; z-index: 3; animation: pulse 2s infinite; }
.sun-temp {
  position: absolute; top: 50px; right: 8px; z-index: 3;
  background: rgba(255,255,255,0.85); padding: 3px 8px; border-radius: 12px; font-size: 11px;
}
@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }

/* 地形与建筑标注 */
.terrain-layer { position: absolute; inset: 0; }
.t-item {
  position: absolute; display: flex; align-items: center; gap: 3px;
  font-size: 11px; background: rgba(255,255,255,0.85);
  padding: 2px 8px; border-radius: 10px; white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.t-item.t-building { background: rgba(255,243,214,0.92); }   /* 著名建筑 */
.t-item.t-land { background: rgba(222,245,255,0.92); }       /* 山川地形 */
.t-item.t-culture { background: rgba(240,231,255,0.92); }    /* 特色元素 */
.t-emoji { font-size: 15px; }

/* 导航路径（带地面投影，像是画在路面上） */
.path-svg {
  position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none;
  filter: drop-shadow(0 2px 2px rgba(45, 66, 32, 0.18));
}

/* 卡通人物（沿路径实时移动） */
.avatar {
  position: absolute; transform: translate(-50%,-60%);
  display: flex; flex-direction: column; align-items: center; z-index: 4;
}
.avatar .char { font-size: 52px; position: relative; display: inline-block; }
/* 脚下的接地阴影：人物站在地面上 */
.avatar .char::after {
  content: ""; position: absolute; left: 50%; bottom: -2px;
  width: 34px; height: 9px; margin-left: -17px;
  background: radial-gradient(ellipse at center, rgba(45, 66, 32, 0.4), rgba(45, 66, 32, 0) 72%);
  border-radius: 50%;
  z-index: -1;
}
.avatar .umbrella {
  position: absolute; top: -14px; left: 50%; transform: translateX(-10%);
  font-size: 30px;
}
.avatar.walking { animation: bob 0.45s ease-in-out infinite; }
.avatar.face-left .char { transform: scaleX(-1); }
.avatar.face-left .umbrella { transform: translateX(60%); }
@keyframes bob {
  0%, 100% { margin-top: 0; }
  50% { margin-top: -6px; }
}
.avatar .you-tag {
  margin-bottom: 2px; padding: 2px 10px; background: rgba(255,255,255,0.92);
  border-radius: 20px; font-size: 11px; color: var(--primary);
  box-shadow: 0 1px 3px rgba(45, 66, 32, 0.15);
}

/* 路段信息标注（贴在路径中点） */
.seg-label-layer { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.seg-chip {
  position: absolute; transform: translate(-50%,-50%);
  font-size: 10px; color: var(--blue); background: rgba(255,255,255,0.95);
  border: 1px solid rgba(74,163,255,0.4); border-radius: 9px;
  padding: 1px 6px; white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.seg-chip.done { opacity: 0.45; }

/* 打卡点 */
.poi-layer { position: absolute; inset: 0; z-index: 3; }
.poi {
  position: absolute; display: flex; align-items: center; gap: 4px;
  font-size: 11px; background: rgba(255,255,255,0.94);
  padding: 3px 8px 3px 4px; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  transform: translate(-50%,-50%);
}
.poi-done { opacity: 0.5; }
.poi-cur { background: #fff3d6; border: 1.5px solid var(--primary); font-weight: 600; }
.p-order {
  flex: none; width: 16px; height: 16px; border-radius: 50%;
  background: #4aa3ff; color: #fff; font-size: 10px; font-weight: 600;
  display: flex; align-items: center; justify-content: center;
}
.poi-done .p-order { background: #a9d8b6; }
.poi-cur .p-order { background: #ff8b00; }
.p-body { display: flex; flex-direction: column; line-height: 1.2; }
.p-name { white-space: nowrap; }
.p-eta { font-size: 9px; color: var(--text-light); }

/* 实时导航状态条 */
.nav-status {
  position: absolute; left: 10px; right: 10px; bottom: 10px; z-index: 7;
  background: rgba(255,255,255,0.95); border-radius: 14px;
  padding: 8px 12px; box-shadow: 0 4px 14px rgba(0,0,0,0.18);
}
.nav-row { display: flex; align-items: center; gap: 8px; }
.nav-walk { font-size: 20px; animation: bob 0.45s ease-in-out infinite; }
.nav-text { flex: 1; font-size: 13px; line-height: 1.35; }
.nav-text b { color: var(--primary); }
.nav-mode { display: block; font-style: normal; font-size: 11px; color: var(--text-light); }
.nav-mode .eta { color: #ff7a45; font-weight: 600; }
.nav-skip {
  border: none; background: #eef6ff; color: var(--blue);
  font-size: 12px; padding: 6px 10px; border-radius: 10px; cursor: pointer;
}
.nav-progress {
  margin-top: 6px; height: 5px; border-radius: 3px; background: #e8eef5; overflow: hidden;
}
.nav-progress-bar {
  height: 100%; border-radius: 3px;
  background: linear-gradient(90deg, #4aa3ff, #34c77b);
  transition: width 0.12s linear;
}

/* toast */
.toast {
  position: fixed; left: 50%; top: 14%; transform: translateX(-50%);
  background: rgba(30,40,60,0.88); color: #fff; font-size: 13px;
  padding: 9px 18px; border-radius: 20px; z-index: 99;
  box-shadow: 0 6px 18px rgba(0,0,0,0.25); white-space: nowrap;
}
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, -8px); }

/* 底部时间线 */
.day-switch { display: flex; align-items: center; gap: 6px; margin: 6px 0 2px; flex-wrap: wrap; }
.ds-hint { font-size: 11px; color: var(--text-light); }
.ds-tab {
  border: 1px solid #dbe7f5; background: #fff; color: var(--text);
  font-size: 11px; padding: 3px 8px; border-radius: 12px; cursor: pointer;
}
.ds-tab em { font-style: normal; color: var(--text-light); margin-left: 3px; }
.ds-tab.active { background: var(--primary); border-color: var(--primary); color: #fff; }
.ds-tab.active em { color: rgba(255,255,255,0.85); }
.day-clock {
  text-align: center; font-size: 12px; color: var(--text-light);
  margin: 4px 0 8px; padding: 4px 8px; background: #f6f9ff; border-radius: 10px;
}
.timeline .item { display: flex; align-items: center; gap: 8px; padding: 6px 0; cursor: pointer; }
.timeline .item-done { opacity: 0.5; }
.timeline .item-cur { background: #eef6ff; border-radius: 8px; padding: 6px 8px; }
.timeline .item-next { background: #fff6ec; border-radius: 8px; padding: 6px 8px; }
.t-order {
  flex: none; width: 18px; height: 18px; border-radius: 50%;
  background: #eef3fa; color: var(--text-light); font-size: 10px;
  display: flex; align-items: center; justify-content: center;
}
.item-cur .t-order { background: var(--primary); color: #fff; }
.item-done .t-order { background: #d8ecdd; color: #57a06f; }
.t-time { font-size: 11px; color: var(--text-light); min-width: 78px; }
.t-name { font-size: 14px; font-weight: 500; }
.traffic { font-size: 11px; color: var(--blue); margin-left: auto; }
.empty-tip { text-align: center; font-size: 12px; color: var(--text-light); padding: 10px 0; }

/* 完整路线面板 */
.full-route {
  margin-top: 12px; border-top: 1px dashed #e6edf5; padding-top: 8px;
}
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

/* 雨滴 */
.rain-layer { position: absolute; inset: 0; overflow: hidden; z-index: 6; }
.drop {
  position: absolute; top: -10px; width: 2px; height: 14px;
  background: rgba(120,160,220,0.7); border-radius: 2px;
  animation: fall 1s linear infinite;
}
@keyframes fall { to { transform: translateY(410px); } }

/* 雪花 */
.snow-layer { position: absolute; inset: 0; overflow: hidden; z-index: 6; }
.flake {
  position: absolute; top: -20px; font-size: 16px; opacity: 0.8;
  animation: snow 2.5s linear infinite;
}
@keyframes snow { to { transform: translateY(420px); } }
</style>
