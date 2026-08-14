<template>
  <div class="phone">
    <div class="topbar">
      <h1>✈️ 行程规划</h1>
      <span class="weather">☀️ 晴 26°</span>
    </div>

    <div class="card">
      <h3>基本信息</h3>
      <div class="field">
        <label>出发地</label>
        <input v-model="form.出发地" placeholder="如：南昌" />
      </div>
      <div class="field">
        <label>目的地</label>
        <input v-model="form.目的地" placeholder="如：成都" />
      </div>
      <div class="field">
        <label>游玩天数</label>
        <select v-model.number="form.游玩天数">
          <option v-for="d in [1,2,3,4,5,6,7]" :key="d" :value="d">{{ d }} 天</option>
        </select>
      </div>
      <div class="field">
        <label>精力状态</label>
        <select v-model="form.精力状态">
          <option value="轻松">😌 轻松</option>
          <option value="正常">🙂 正常</option>
          <option value="特种兵">💪 特种兵</option>
        </select>
      </div>
      <div class="field">
        <label>偏好（可多选）</label>
        <div class="chips">
          <span v-for="p in ['美食','人文','自然','购物']" :key="p"
                class="chip" :class="{ active: form.偏好.includes(p) }"
                @click="togglePreference(p)">{{ p }}</span>
        </div>
      </div>
    </div>

    <div style="padding: 0 16px 24px;">
      <button class="btn btn-primary" @click="goNext">下一步：生成路线 →</button>
    </div>
  </div>
</template>

<script setup>
import { reactive, onMounted } from "vue";
import { useRouter } from "vue-router";
import { session } from "../session.js";

const router = useRouter();
const form = reactive({
  出发地: "",
  目的地: "",
  游玩天数: 3,
  精力状态: "正常",
  偏好: ["美食"],
});

function togglePreference(p) {
  const i = form.偏好.indexOf(p);
  if (i >= 0) form.偏好.splice(i, 1);
  else form.偏好.push(p);
}

onMounted(async () => {
  // 1. 优先从 URL query 恢复（从 Routes/Map 返回时带的参数，数据不丢）
  const q = router.currentRoute.value.query;
  if (typeof q.from === "string" && q.from) form.出发地 = q.from;
  if (typeof q.to === "string" && q.to) form.目的地 = q.to;
  if (q.days) {
    const d = Number(q.days);
    if (!isNaN(d) && d > 0) form.游玩天数 = d;
  }
  // 2. 从后端 session 恢复（刷新兜底）
  try {
    const state = await session.getState();
    if (state && state.input) {
      Object.assign(form, state.input);
    }
  } catch (e) {
    console.error("恢复会话失败:", e);
  }
});

async function goNext() {
  // 同时从 DOM 读取输入值作为兜底（防止某些浏览器 v-model 事件未同步）
  const inputs = document.querySelectorAll("input");
  if (inputs[0]?.value) form.出发地 = inputs[0].value.trim();
  if (inputs[1]?.value) form.目的地 = inputs[1].value.trim();

  if (!form.出发地 || !form.目的地) {
    alert("请填写出发地和目的地");
    return;
  }
  // 输入保存到后端，供前后端互通 + 刷新恢复
  let sid;
  try {
    const saved = await session.saveInput({ ...form });
    sid = saved.id;
  } catch (e) {
    console.error("保存行程失败:", e);
    alert("保存失败，请检查网络后重试：" + (e.message || ""));
    return;
  }
  // 保存形象默认值（不阻塞跳转）
  session.saveAvatar({ 性别: "女", 发型: "双马尾", 服装: "", 当地服饰: false }).catch(() => {});
  // 通过 URL 传 session_id 和出发地/目的地，彻底保证数据互通（不依赖 localStorage/session 读取）
  router.push({
    path: "/routes",
    query: { sid, from: form.出发地, to: form.目的地, days: String(form.游玩天数) },
  });
}
</script>

<style scoped>
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  padding: 8px 14px; border-radius: 20px; border: 1.5px solid #e5e5e5;
  font-size: 14px; cursor: pointer; background: #fafbfc;
}
.chip.active { border-color: var(--primary); background: #e8f3ff; color: var(--primary); }
</style>
