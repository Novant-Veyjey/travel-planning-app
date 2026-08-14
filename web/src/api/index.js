/**
 * 后端 API 封装
 */
const BASE = "/api";

async function request(url, options = {}) {
  const resp = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `请求失败 ${resp.status}`);
  }
  return resp.json();
}

export const api = {
  // 生成路线（M2）
  generatePlan(data) {
    return request("/plan/generate", { method: "POST", body: JSON.stringify(data) });
  },
  // 选择路线（M6）
  selectPlan(plan_id, index) {
    return request("/plan/select", { method: "POST", body: JSON.stringify({ plan_id, index }) });
  },
  // 获取路线
  getPlan(id) {
    return request(`/plan/${id}`);
  },
  // 天气
  getWeather(city) {
    return request(`/weather/${city}`);
  },
  getScenario(city) {
    return request("/weather/scenario", { method: "POST", body: JSON.stringify({ city }) });
  },
  // POI
  searchPoi(city, keyword = "") {
    return request(`/poi/search?city=${city}&keyword=${keyword}`);
  },
  // 城市特色（出发地/目的地当地建筑、地形、特色）
  getCityFeature(city) {
    return request(`/city/${encodeURIComponent(city)}`);
  },
  // 会话（前后端互通 + 刷新恢复）
  newSession() {
    return request("/session/new", { method: "POST", body: "{}" });
  },
  getSession(id) {
    return request(`/session/${id}`);
  },
  saveSessionInput(id, input) {
    return request(`/session/${id}/input`, { method: "POST", body: JSON.stringify({ input }) });
  },
  saveSessionPlan(id, plan_id, selected_index) {
    return request(`/session/${id}/plan`, {
      method: "POST",
      body: JSON.stringify({ plan_id, selected_index }),
    });
  },
};
