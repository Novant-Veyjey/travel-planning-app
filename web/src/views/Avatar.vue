<template>
  <div class="phone">
    <div class="topbar">
      <button class="back" @click="$router.back()">←</button>
      <h1>形象自定义</h1>
      <span v-if="destination" class="weather">📍{{ destination }}</span>
    </div>

    <!-- 形象预览 -->
    <div class="preview" :style="previewStyle">
      <div class="avatar" :style="avatarStyle">🧍</div>
      <span class="you-tag">当前位置</span>
    </div>

    <!-- 当地服饰（M10） -->
    <div class="card">
      <h3>🧣 当地装扮 · {{ localInfo.民族 || "" }}</h3>
      <div class="outfits">
        <span v-for="o in localOutfits" :key="o" class="outfit"
              :class="{ active: form.当地服饰 === o }" @click="form.当地服饰 = o">
          🛍️ {{ o }}
        </span>
        <span v-if="localOutfits.length === 0" class="empty">（输入目的地后显示当地服饰）</span>
      </div>
    </div>

    <!-- 基础形象（M3） -->
    <div class="card">
      <h3>基础形象</h3>
      <div class="field">
        <label>性别</label>
        <select v-model="form.性别">
          <option value="女">女</option>
          <option value="男">男</option>
        </select>
      </div>
      <div class="field">
        <label>发型</label>
        <select v-model="form.发型">
          <option v-for="h in options.发型" :key="h" :value="h">{{ h }}</option>
        </select>
      </div>
      <div class="field">
        <label>基础服装</label>
        <select v-model="form.服装">
          <option v-for="o in options.服装" :key="o" :value="o">{{ o }}</option>
        </select>
      </div>
    </div>

    <div style="padding: 0 16px 24px;">
      <button class="btn btn-primary" @click="saveAndNext">保存并生成路线 →</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api/index.js";
import { session } from "../session.js";

const router = useRouter();
const form = reactive({ 性别: "女", 发型: "双马尾", 服装: "粉色连衣裙", 当地服饰: null });
const options = ref({ 发型: [], 服装: [], 性别: [] });
const localOutfits = ref([]);
const localInfo = ref({ 民族: "" });
const destination = ref("");

const previewStyle = computed(() => {
  // 根据目的地天气改变预览背景
  return { background: "linear-gradient(180deg,#aee3ff,#e8f6ff)" };
});
const avatarStyle = computed(() => ({
  color: form.性别 === "女" ? "#ff7ba9" : "#4aa3ff",
}));

onMounted(async () => {
  try {
    // 刷新后从后端恢复输入和形象
    const state = await session.getState();
    const input = state?.input || {};
    destination.value = input.目的地 || "";
    options.value = await api.getAvatarOptions();
    if (destination.value) {
      const local = await api.getLocalOutfits(destination.value);
      localOutfits.value = local.当地服饰;
      localInfo.value = { 民族: local.民族 };
      form.当地服饰 = local.当地服饰[0] || null;
    }
    // 恢复已保存的形象
    if (state?.avatar) {
      Object.assign(form, state.avatar);
    }
  } catch (e) {
    console.error(e);
  }
});

watch(destination, async (city) => {
  if (!city) return;
  const local = await api.getLocalOutfits(city).catch(() => ({ 当地服饰: [], 民族: "" }));
  localOutfits.value = local.当地服饰;
  localInfo.value = { 民族: local.民族 };
  form.当地服饰 = local.当地服饰[0] || null;
});

async function saveAndNext() {
  try {
    await api.saveAvatar({ ...form, 城市: destination.value });
    // 形象保存到会话（后端），供刷新恢复
    await session.saveAvatar({ ...form });
  } catch (e) { console.error(e); }
  router.push("/routes");
}
</script>

<style scoped>
.preview {
  height: 180px; margin: 12px 16px; border-radius: 16px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  position: relative;
}
.avatar { font-size: 60px; }
.you-tag {
  position: absolute; bottom: 16px; padding: 3px 12px;
  background: #fff; border-radius: 20px; font-size: 12px; color: var(--blue);
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}
.outfits { display: flex; flex-wrap: wrap; gap: 8px; }
.outfit {
  padding: 8px 12px; border-radius: 10px; border: 1.5px solid #e5e5e5;
  font-size: 13px; cursor: pointer; background: #fafbfc;
}
.outfit.active { border-color: var(--orange); background: #fff7e6; color: var(--orange); }
.empty { color: #aaa; font-size: 13px; }
</style>
