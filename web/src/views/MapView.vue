<template>
  <div class="phone">
    <div class="topbar">
      <button class="back" @click="$router.back()">←</button>
      <h1>当前导航</h1>
      <div class="topbar-right">
        <span class="weather">☀️ {{ weather.温度 }}°</span>
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
      <!-- 天气粒子：雨/雪 -->
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
      <div v-if="scenario.太阳" class="sun-temp">晴 {{ weather.温度 }}°</div>

      <!-- 地形与建筑（按当前站点动态切换 + 位置变化） -->
      <div class="terrain-layer">
        <span v-for="(t, i) in activeTerrains" :key="i" class="t-item"
              :class="{ 't-current': t.active }" :style="t.style">
          <span class="t-emoji">{{ t.ico }}</span> {{ t.name }}
        </span>
      </div>

      <!-- 导航路径：串联打卡点 + 交通耗时 -->
      <svg class="path-svg" viewBox="0 0 400 400">
        <!-- 已走过的路线（实线） -->
        <path v-for="(seg, i) in walkedSegments" :key="'w'+i" :d="seg.d"
              :stroke="seg.stroke" stroke-width="4" fill="none"/>
        <!-- 待走的路线（虚线） -->
        <path v-for="(seg, i) in remainingSegments" :key="'r'+i" :d="seg.d"
              :stroke="seg.stroke" stroke-width="4" stroke-dasharray="8 6" fill="none"/>
      </svg>

      <!-- 卡通人物（跟随移动到当前打卡点） -->
      <div class="avatar" :style="avatarStyle">
        <span class="char">{{ avatarEmoji }}</span>
        <span class="you-tag">当前位置</span>
      </div>

      <!-- 打卡点标注 -->
      <div class="poi-layer">
        <div v-for="(p, i) in pois" :key="i" class="poi"
             :class="{ 'poi-done': i < currentStop, 'poi-cur': i === currentStop }"
             :style="poiPos(i)">
          <span class="p-ico">{{ i < currentStop ? "✅" : (i === currentStop ? "⭐" : "📍") }}</span>
          <span class="p-name">{{ p.名称 }}</span>
        </div>
      </div>

    </div>

    <!-- 底部行程时间线 -->
    <div v-if="!noInput" class="card timeline-card">
      <h3 style="text-align:center;">今日行程 · 第{{ currentDay.第几天 }}天 · {{ destination }}</h3>
      <div class="timeline">
        <div v-for="(p, i) in currentPois" :key="i" class="item"
             :class="{ 'item-done': i < currentStop, 'item-cur': i === currentStop }">
          <span class="t-ico">{{ i < currentStop ? "✅" : poiIcon(i) }}</span>
          <span class="t-time">{{ p.推荐时间 }}</span>
          <span class="t-name">{{ p.名称 }}</span>
          <span class="traffic">🚇 {{ p.交通?.推荐方式 }}·{{ p.交通?.耗时 }}</span>
        </div>
      </div>
      <div style="display:flex;gap:12px;margin-top:12px;">
        <button class="btn btn-primary" style="flex:1" @click="nextStop" :disabled="navigating">
          {{ currentStop >= currentPois.length - 1 ? "行程结束 ✅" : (navigating ? "导航中…" : "继续导航 →") }}
        </button>
        <button class="btn btn-outline" style="flex:1" @click="goRoutes">我的路线</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api/index.js";
import { session } from "../session.js";

const router = useRouter();

const weather = reactive({ 温度: 25, 天气: "晴" });
const scenario = reactive({ 场景: "sunny", 太阳: true, 雨滴: 0, 雪花: 0, 配饰: "墨镜" });
const destination = ref("");
const avatarEmoji = ref("🧍‍♀️");
const currentDay = ref({ 第几天: 1, 地形: "平原", 打卡点: [] });
const currentPois = ref([]);
const terrains = ref([]);
const currentStop = ref(0); // 当前所在打卡点下标
const navigating = ref(false); // 是否正在移动动画
const noInput = ref(false); // 无行程时的空态
let animId = null;

const pois = computed(() => currentPois.value.slice(0, 5));

const POI_ICONS = ["⭐", "🏯", "🍜", "🎨", "🛍️", "🏛️", "⛰️", "🏝️"];

// 目的地省份 → 地形图标/名称
const TERRAIN_ICON = {
  江西: [["🏯", "滕王阁"], ["⛰️", "庐山"], ["🏺", "景德镇"]],
  四川: [["🗿", "乐山大佛"], ["⛰️", "峨眉山"], ["🐼", "熊猫基地"]],
  北京: [["🏯", "故宫"], ["🧱", "长城"], ["🦆", "烤鸭店"]],
  上海: [["🗼", "东方明珠"], ["🌊", "黄浦江"], ["🥟", "城隍庙"]],
  西藏: [["🏯", "布达拉宫"], ["🏔️", "雪山"], ["🐂", "纳木错"]],
  贵州: [["🏯", "甲秀楼"], ["💧", "黄果树"], ["🥘", "酸汤鱼"]],
  云南: [["🏛️", "三塔"], ["🌊", "滇池"], ["🍜", "过桥米线"]],
};
const TERRAIN_SPOTS = [
  [6, 14], [70, 10], [16, 40], [78, 46], [8, 62], [85, 70],
];

// 当前站点对应的地形（高亮当前 POI 匹配的地形；位置固定稳定）
const activeTerrains = computed(() => {
  const cur = Math.min(currentStop.value, pois.value.length - 1);
  const curPoi = pois.value[cur]?.名称 || "";
  const len = Math.max(terrains.value.length, 1);
  return terrains.value.map((t, i) => ({
    ...t,
    active: curPoi.includes(t.name.replace(/[^一-龥]/g, "")) || i === (cur % len),
    style: terrainPos(i),
  }));
});

function terrainPos(offset) {
  const [l, t] = TERRAIN_SPOTS[offset % TERRAIN_SPOTS.length];
  return { left: `${l}%`, top: `${t}%` };
}

// POI 位置（像素坐标，供人物移动 + 路径）
function poiPos(i) {
  return {
    left: `${20 + (i * 16) % 56}%`,
    top: `${20 + (i * 13) % 48}%`,
  };
}
function poiXY(i) {
  const p = poiPos(i);
  return {
    x: 50 + (parseFloat(p.left) - 20) * 3.4,
    y: 50 + (parseFloat(p.top) - 20) * 3.4,
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
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    segs.push({
      d: `M${a.x},${a.y} Q${mx},${my - 20} ${b.x},${b.y}`,
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
  if (currentStop.value >= pois.value.length - 1) return [];
  return buildSegments(currentStop.value, pois.value.length - 1);
});

// 人物位置：从当前站点百分比，移动时用 CSS transition 平滑过渡
const avatarStyle = computed(() => {
  if (!pois.value.length) return { left: "50%", top: "50%" };
  const p = poiPos(Math.min(currentStop.value, pois.value.length - 1));
  return { left: p.left, top: p.top };
});

function poiIcon(i) {
  return POI_ICONS[i] || "📍";
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
  const avatar = state?.avatar || {};
  avatarEmoji.value = avatar.当地服饰 ? "👘" : (avatar.性别 === "男" ? "🧍‍♂️" : "🧍‍♀️");

  // 直达 /map 但无目的地 → 显示空态引导，不强制跳回
  if (!destination.value) {
    noInput.value = true;
    return;
  }

  if (destination.value) {
    try {
      const sc = await api.getScenario(destination.value);
      Object.assign(scenario, sc);
      const w = await api.getWeather(destination.value);
      Object.assign(weather, w);
    } catch (e) { console.error(e); }
    try {
      const cf = await api.getCityFeature(destination.value);
      const items = TERRAIN_ICON[cf.省份] || TERRAIN_ICON["四川"];
      terrains.value = (items || []).map(([ico, name]) => ({ ico, name }));
    } catch (e) { console.error(e); }
  }

  const selected = state?.selected_route || null;
  if (selected && selected.每日行程?.length) {
    currentDay.value = selected.每日行程[0];
    currentPois.value = selected.每日行程[0].打卡点 || [];
  } else if (destination.value) {
    currentPois.value = await api.searchPoi(destination.value).catch(() => []);
  }
});

onUnmounted(() => {
  if (animId) clearInterval(animId);
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

// 模拟实时跟随导航：人物逐站沿路径移动，地形随站点切换
function nextStop() {
  if (navigating.value) return;
  if (currentStop.value >= currentPois.value.length - 1) {
    alert("🎉 本日行程已全部完成！");
    return;
  }
  const next = currentStop.value + 1;
  const targetName = currentPois.value[next]?.名称 || "下一站";
  navigating.value = true;
  // 模拟跟随移动：动画过渡到下一站
  setTimeout(() => {
    currentStop.value = next; // 触发位置 + 地形切换
    navigating.value = false;
    alert(`🚶 已到达 ${targetName}`);
  }, 600);
}
</script>

<style scoped>
.map {
  position: relative; height: 400px; margin: 12px 16px;
  border-radius: 16px; overflow: hidden;
  background: linear-gradient(180deg, #b7e3a4, #e8f5d8);
}
.map.sunny { background: linear-gradient(180deg, #8ed1ff, #dff3ff); }
.map.rainy { background: linear-gradient(180deg, #7b8ea8, #b8c4d4); }
.map.snowy { background: linear-gradient(180deg, #e8f0f8, #ffffff); }
.map.cloudy { background: linear-gradient(180deg, #b8c4d4, #dfe6ef); }

/* 太阳 + 温度 */
.sun { position: absolute; top: 8px; right: 14px; font-size: 40px; z-index: 3; animation: pulse 2s infinite; }
.sun-temp {
  position: absolute; top: 50px; right: 8px; z-index: 3;
  background: rgba(255,255,255,0.85); padding: 3px 8px; border-radius: 12px; font-size: 11px;
}
@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }

/* 地形与建筑 */
.terrain-layer { position: absolute; inset: 0; z-index: 1; }
.t-item {
  position: absolute; display: flex; align-items: center; gap: 3px;
  font-size: 11px; background: rgba(255,255,255,0.85);
  padding: 2px 8px; border-radius: 10px; white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  transition: left .8s ease, top .8s ease;
}
.t-item.t-current {
  background: #fff3d6; border: 1.5px solid var(--primary);
  font-weight: 600; box-shadow: 0 2px 6px rgba(74,163,255,0.35);
  transform: scale(1.1);
}
.t-emoji { font-size: 15px; }

/* 导航路径 */
.path-svg { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none; }

/* 卡通人物（跟随移动，用百分比定位 + 过渡动画） */
.avatar {
  position: absolute; transform: translate(-50%,-60%);
  display: flex; flex-direction: column; align-items: center; z-index: 4;
  transition: left .9s ease, top .9s ease;
}
.avatar .char { font-size: 52px; }
.avatar .you-tag {
  margin-top: 4px; padding: 2px 10px; background: rgba(255,255,255,0.92);
  border-radius: 20px; font-size: 11px; color: var(--primary);
}

/* 打卡点 */
.poi-layer { position: absolute; inset: 0; z-index: 3; }
.poi {
  position: absolute; display: flex; align-items: center; gap: 2px;
  font-size: 11px; background: rgba(255,255,255,0.94);
  padding: 3px 8px; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  transform: translate(-50%,-50%);
}
.poi-done { opacity: 0.45; }
.poi-cur { background: #fff3d6; border: 1.5px solid var(--primary); font-weight: 600; }
.p-ico { font-size: 13px; }
.p-name { white-space: nowrap; }

/* 底部时间线 */
.timeline .item { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
.timeline .item-done { opacity: 0.5; }
.timeline .item-cur { background: #eef6ff; border-radius: 8px; padding: 6px 8px; }
.t-ico { font-size: 16px; }
.t-time { font-size: 11px; color: var(--text-light); min-width: 62px; }
.t-name { font-size: 14px; font-weight: 500; }
.traffic { font-size: 11px; color: var(--blue); margin-left: auto; }

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
