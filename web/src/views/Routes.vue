<template>
  <div class="phone">
    <div class="topbar">
      <button class="back" @click="goHome">←</button>
      <h1>我的行程</h1>
      <span v-if="destination" class="weather">{{ weatherIcon }} {{ weather }}°</span>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>AI 正在规划路线…</p>
    </div>

    <!-- 未填写行程的空态引导 -->
    <div v-else-if="noInput" class="empty-state">
      <div class="empty-ico">🗺️</div>
      <h3>还没有行程信息</h3>
      <p>请先填写出发地和目的地，我们会为你规划合适的路线</p>
      <button class="btn btn-primary" @click="$router.push('/')">去填写行程 →</button>
    </div>

    <div v-else style="padding-bottom: 24px;">
      <!-- 出发地→目的地 融合横幅（特色图左右交融） -->
      <div class="route-banner">
        <div class="banner-img left" :style="{ backgroundImage: `url(${fromImg})` }"></div>
        <div class="banner-fade"></div>
        <div class="banner-img right" :style="{ backgroundImage: `url(${toImg})` }"></div>
        <div class="banner-city left">
          <span class="city-tag">出发地</span>
          <span class="city-name">{{ departure || "出发" }}</span>
          <span class="city-feat">{{ fromFeature.特色建筑?.[0] }}·{{ fromFeature.地形?.[0] }}</span>
        </div>
        <div class="banner-arrow">→</div>
        <div class="banner-city right">
          <span class="city-tag">目的地</span>
          <span class="city-name">{{ destination || "到达" }}</span>
          <span class="city-feat">{{ toFeature.特色建筑?.[0] }}·{{ toFeature.地形?.[0] }}</span>
        </div>
      </div>

      <!-- 3 条路线选择（休闲/经典/特种兵） -->
      <div class="card" v-if="routes.length">
        <h3>为你规划了 {{ routes.length }} 条路线</h3>
        <div class="route-picker">
          <div v-for="(r, i) in routes" :key="i" class="route-opt"
               :class="{ active: selectedIndex === i }" @click="selectRoute(i)">
            <div class="r-name">{{ r.路线名 }}</div>
            <div class="r-tag" :class="r.强度">{{ r.强度 }}</div>
            <div class="r-desc">{{ r.亮点 }}</div>
            <div class="r-who">适合：{{ r.适合人群 }}</div>
          </div>
        </div>
      </div>

      <!-- 交通方式 -->
      <div class="card">
        <h3>交通方式</h3>
        <div class="transport-row">
          <div v-for="(t, i) in transports" :key="i" class="transport-item" :class="{ recommend: i === 0 }">
            <div v-if="i === 0" class="recommend-badge">推荐</div>
            <div class="ico">{{ t.ico }}</div>
            <div class="t">{{ t.方式 }}</div>
            <div class="st">{{ t.耗时 }}</div>
          </div>
        </div>
      </div>

      <!-- 行程概览：每天打卡点 -->
      <div class="card">
        <h3>行程 · {{ days }}天{{ days > 1 ? days - 1 + '晚' : '' }}</h3>
        <div v-if="selectedRoute?.每日行程?.length">
          <div v-for="(day, d) in selectedRoute.每日行程" :key="d" class="day-block">
            <div class="day-title"><span class="dot" :style="{ background: dayDots[d % dayDots.length] }"></span>D{{ day.第几天 }}</div>
            <div class="day-items">
              <div v-for="(p, pidx) in (day.打卡点 || [])" :key="pidx" class="day-col">
                <div class="ico-circle">{{ poiIcons[pidx % poiIcons.length] }}</div>
                <div class="col-name">{{ p.名称 }}</div>
                <div class="col-time">{{ p.推荐时间 }}</div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-tip">暂无行程数据</div>
      </div>

      <!-- 目的地特色 -->
      <div class="card">
        <h3>目的地特色</h3>
        <div class="feature-row">
          <div v-for="(f, i) in destFeatures" :key="i" class="feature-item">
            <div class="ico">{{ f.ico }}</div>
            <div class="t">{{ f.name }}</div>
          </div>
        </div>
      </div>

      <!-- 费用预估 -->
      <div class="card">
        <h3>费用预估</h3>
        <div class="cost-card">
          <div class="amount">¥{{ costLow }}-{{ costHigh }}</div>
          <div class="items">
            <span>🚄 交通</span><span>🏨 住宿</span><span>🍜 餐饮</span><span>🎫 门票</span>
          </div>
        </div>
      </div>

      <!-- 开始导航 -->
      <div style="padding: 0 16px;">
        <button class="btn btn-primary" @click="goMap">开始导航 →</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api/index.js";
import { session } from "../session.js";
import { resolveCityImageKeys } from "../assets/cityImages.js";

const router = useRouter();
const departure = ref("");
const destination = ref("");
const days = ref(4);
const weather = ref(26);
const weatherIcon = ref("☀️");
const loading = ref(true);

const fromFeature = reactive({ 特色建筑: [], 地形: [], 特色元素: [], 图片键: "" });
const toFeature = reactive({ 特色建筑: [], 地形: [], 特色元素: [], 图片键: "" });
const fromImgs = ref([]);
const toImgs = ref([]);

const routes = ref([]);
const selectedIndex = ref(0);
const planId = ref(null);
const noInput = ref(false);

const dayDots = ["#ff6b6b", "#34c77b", "#f5a623", "#e47fd0"];
const poiIcons = ["🏮", "🏯", "🍜", "🎨", "🛍️", "🏛️", "⛰️", "🏝️"];

const fromImg = computed(() => fromImgs.value[0] || "");
const toImg = computed(() => toImgs.value[0] || "");
const selectedRoute = computed(() => routes.value[selectedIndex.value] || null);

// 交通方式：从路线的全程交通读取（后端基于真实城市对耗时表生成）
const transports = computed(() => {
  return selectedRoute.value?.全程交通 || [];
});

// 目的地特色：取路线中的建筑/美食/地形
const destFeatures = computed(() => {
  const feats = [];
  const push = (name, ico) => feats.push({ name, ico });
  toFeature.特色建筑?.[0] && push(toFeature.特色建筑[0], "🏛️");
  toFeature.特色元素?.[0] && push(toFeature.特色元素[0], "🍜");
  toFeature.地形?.[0] && push(toFeature.地形[0], "⛰️");
  if (!feats.length) push(destination.value, "📍");
  return feats.slice(0, 4);
});

// 费用估算（简单按天数）
const costLow = computed(() => Math.round(days.value * 350));
const costHigh = computed(() => Math.round(days.value * 550));

function selectRoute(i) {
  selectedIndex.value = i;
  if (planId.value != null) {
    api.selectPlan(planId.value, i).catch(() => {});
    session.savePlan(planId.value, i).catch(() => {});
  }
}

async function loadCityFeatures() {
  if (departure.value) {
    const f = await api.getCityFeature(departure.value).catch(() => null);
    if (f) {
      Object.assign(fromFeature, f);
      fromImgs.value = resolveCityImageKeys(f.图片键);
    }
  }
  if (destination.value) {
    const f = await api.getCityFeature(destination.value).catch(() => null);
    if (f) {
      Object.assign(toFeature, f);
      toImgs.value = resolveCityImageKeys(f.图片键);
    }
  }
}

async function generateAndLoad(prevIndex) {
  // 先生成路线（AI 或 mock）
  const plan = await api.generatePlan({
    出发地: departure.value,
    目的地: destination.value,
    游玩天数: days.value,
    精力状态: "正常",
    偏好: ["美食", "自然"],
  });
  planId.value = plan.plan_id;
  routes.value = plan.routes || [];
  const saved = prevIndex != null ? prevIndex : 0;
  selectedIndex.value = saved;
  // 保存到会话，供刷新恢复 + 地图页使用
  await session.savePlan(plan.plan_id, saved);
}

onMounted(async () => {
  // 1. 优先使用 URL query 的 from/to（Home 跳转时传入，最可靠，不依赖 session 读取）
  const q = router.currentRoute.value.query;
  let urlFrom = typeof q.from === "string" ? q.from : "";
  let urlTo = typeof q.to === "string" ? q.to : "";
  let urlDays = q.days ? Number(q.days) : NaN;
  let urlSid = typeof q.sid === "string" ? q.sid : "";

  // 2. 尝试从 session 读取（URL 有 sid 时优先用它）
  let state = null;
  if (urlSid) {
    localStorage.setItem("travel_session_id", urlSid);
    state = await api.getSession(urlSid).catch(() => null);
  }
  if (!state) {
    state = await session.getState().catch(() => null);
  }
  const input = state?.input || {};

  // 3. 合并：URL 的 from/to 优先级最高，其次 session 的 input
  departure.value = urlFrom || input.出发地 || "";
  destination.value = urlTo || input.目的地 || "";
  days.value = !isNaN(urlDays) && urlDays > 0 ? urlDays : (input.游玩天数 || 4);

  // 直达 /routes 但无出发地/目的地 → 显示空态引导，不强制跳回
  if (!departure.value || !destination.value) {
    loading.value = false;
    noInput.value = true;
    return;
  }

  // 把出发地/目的地/天数持久化到后端 session（刷新后即使 URL query 丢失也能恢复）
  if (urlSid || localStorage.getItem("travel_session_id")) {
    session
      .saveInput({ 出发地: departure.value, 目的地: destination.value, 游玩天数: days.value })
      .catch(() => {});
  }

  await loadCityFeatures();

  try {
    const sc = await api.getScenario(destination.value).catch(() => ({ 温度: 26 }));
    weather.value = sc.温度 ?? 26;
    weatherIcon.value = sc.图标 || "☀️";
  } catch (e) { /* 忽略 */ }

  try {
    await generateAndLoad(state?.selected_index ?? 0);
  } catch (e) {
    console.error("生成路线失败:", e);
    alert("路线生成失败，请重试");
  }

  loading.value = false;
});

function goMap() {
  const q = router.currentRoute.value.query;
  const sid = localStorage.getItem("travel_session_id") || q.sid;
  // 把出发地/目的地/天数一起带到 /map，保证导航页能读到（刷新也不丢）
  router.push({
    path: "/map",
    query: { sid, from: q.from || departure.value, to: q.to || destination.value, days: String(days.value) },
  });
}

// 返回首页：带上出发地/目的地，首页能恢复表单（数据不丢）
function goHome() {
  const q = router.currentRoute.value.query;
  const sid = localStorage.getItem("travel_session_id") || q.sid;
  router.push({
    path: "/",
    query: { sid, from: q.from || departure.value, to: q.to || destination.value, days: String(days.value) },
  });
}
</script>
