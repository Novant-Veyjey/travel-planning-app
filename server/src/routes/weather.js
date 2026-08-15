/**
 * 天气接口（对应 M1 天气场景化）
 * 优先从 Open-Meteo（免 Key 免费 API）获取真实温度/天气，失败时回退演示数据
 * - GET  /:city         → { 城市, 天气, 温度, 图标 }
 * - POST /scenario      → 场景配置驱动前端动画（晴/雨/雪/阴）
 */
import { Router } from "express";
import { CITY_COORDS } from "../transport.js";

const router = Router();

// 演示天气数据兜底（仅当真实天气 API 不可用时使用）
const MOCK = {
  成都: { 城市: "成都", 天气: "晴", 温度: 26, 图标: "☀️" },
  北京: { 城市: "北京", 天气: "晴", 温度: 25, 图标: "☀️" },
  上海: { 城市: "上海", 天气: "雨", 温度: 24, 图标: "🌧️" },
  拉萨: { 城市: "拉萨", 天气: "晴", 温度: 15, 图标: "☀️" },
  贵阳: { 城市: "贵阳", 天气: "阴", 温度: 20, 图标: "☁️" },
};

// WMO 天气码 → 中文天气 + 图标（open-meteo 使用的标准码）
const WMO_MAP = {
  0: { 天气: "晴", 图标: "☀️" },
  1: { 天气: "晴", 图标: "☀️" },
  2: { 天气: "多云", 图标: "⛅" },
  3: { 天气: "阴", 图标: "☁️" },
  45: { 天气: "雾", 图标: "🌫️" },
  48: { 天气: "雾", 图标: "🌫️" },
  51: { 天气: "小雨", 图标: "🌦️" },
  53: { 天气: "小雨", 图标: "🌦️" },
  55: { 天气: "小雨", 图标: "🌦️" },
  56: { 天气: "冻雨", 图标: "🌧️" },
  57: { 天气: "冻雨", 图标: "🌧️" },
  61: { 天气: "小雨", 图标: "🌦️" },
  63: { 天气: "中雨", 图标: "🌧️" },
  65: { 天气: "大雨", 图标: "🌧️" },
  66: { 天气: "冻雨", 图标: "🌧️" },
  67: { 天气: "冻雨", 图标: "🌧️" },
  71: { 天气: "小雪", 图标: "🌨️" },
  73: { 天气: "中雪", 图标: "❄️" },
  75: { 天气: "大雪", 图标: "❄️" },
  77: { 天气: "雪", 图标: "❄️" },
  80: { 天气: "阵雨", 图标: "🌦️" },
  81: { 天气: "阵雨", 图标: "🌧️" },
  82: { 天气: "强阵雨", 图标: "⛈️" },
  85: { 天气: "阵雪", 图标: "🌨️" },
  86: { 天气: "阵雪", 图标: "❄️" },
  95: { 天气: "雷雨", 图标: "⛈️" },
  96: { 天气: "雷雨", 图标: "⛈️" },
  99: { 天气: "雷雨", 图标: "⛈️" },
};

// 城市名 → 经纬度：优先本地坐标表（内置常用城市），未知城市走 Open-Meteo 地理编码
async function resolveCoords(city) {
  if (CITY_COORDS[city]) return CITY_COORDS[city];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const resp = await fetch(url, { signal: ctrl.signal });
    if (!resp.ok) return null;
    const data = await resp.json();
    const hit = data.results?.[0];
    return hit ? [hit.latitude, hit.longitude] : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// 从 Open-Meteo 获取真实天气（当前温度 + WMO 天气码）
async function fetchRealWeather(city) {
  const coords = await resolveCoords(city);
  if (!coords) return null;
  const [lat, lon] = coords;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const resp = await fetch(url, { signal: ctrl.signal });
    if (!resp.ok) return null;
    const data = await resp.json();
    const cur = data.current;
    if (!cur) return null;
    const info = WMO_MAP[cur.weather_code] || { 天气: "未知", 图标: "🌤️" };
    return {
      城市: city,
      天气: info.天气,
      温度: Math.round(cur.temperature_2m),
      图标: info.图标,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// 简单内存缓存（5 分钟），避免高频请求打爆免费 API
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getWeather(city) {
  const now = Date.now();
  const hit = cache.get(city);
  if (hit && now - hit.t < CACHE_TTL_MS) return hit.data;
  const data = await fetchRealWeather(city);
  if (data) cache.set(city, { t: now, data });
  return data;
}

// GET /api/weather/:city
router.get("/:city", async (req, res) => {
  const city = req.params.city;
  const real = await getWeather(city);
  res.json(real || MOCK[city] || { 城市: city, 天气: "晴", 温度: 22, 图标: "☀️" });
});

// POST /api/weather/scenario 返回场景配置驱动前端动画
router.post("/scenario", async (req, res) => {
  const city = req.body?.city || "";
  const real = await getWeather(city);
  const w = real || MOCK[city] || { 天气: "晴", 温度: 22 };
  const scenarioMap = {
    晴: { 场景: "sunny", 太阳: true, 雨滴: 0, 雪花: 0, 配饰: "墨镜" },
    多云: { 场景: "sunny", 太阳: true, 雨滴: 0, 雪花: 0, 配饰: "墨镜" },
    阴: { 场景: "cloudy", 太阳: false, 雨滴: 0, 雪花: 0, 配饰: "无" },
    雾: { 场景: "cloudy", 太阳: false, 雨滴: 0, 雪花: 0, 配饰: "无" },
    小雨: { 场景: "rainy", 太阳: false, 雨滴: 40, 雪花: 0, 配饰: "带伞" },
    中雨: { 场景: "rainy", 太阳: false, 雨滴: 80, 雪花: 0, 配饰: "打伞" },
    大雨: { 场景: "rainy", 太阳: false, 雨滴: 120, 雪花: 0, 配饰: "打伞" },
    冻雨: { 场景: "rainy", 太阳: false, 雨滴: 80, 雪花: 0, 配饰: "打伞" },
    阵雨: { 场景: "rainy", 太阳: false, 雨滴: 60, 雪花: 0, 配饰: "带伞" },
    强阵雨: { 场景: "rainy", 太阳: false, 雨滴: 120, 雪花: 0, 配饰: "打伞" },
    雷雨: { 场景: "rainy", 太阳: false, 雨滴: 120, 雪花: 0, 配饰: "打伞" },
    雪: { 场景: "snowy", 太阳: false, 雨滴: 0, 雪花: 60, 配饰: "围巾帽子" },
    小雪: { 场景: "snowy", 太阳: false, 雨滴: 0, 雪花: 30, 配饰: "围巾帽子" },
    中雪: { 场景: "snowy", 太阳: false, 雨滴: 0, 雪花: 60, 配饰: "围巾帽子" },
    大雪: { 场景: "snowy", 太阳: false, 雨滴: 0, 雪花: 80, 配饰: "围巾帽子" },
    阵雪: { 场景: "snowy", 太阳: false, 雨滴: 0, 雪花: 50, 配饰: "围巾帽子" },
    未知: { 场景: "sunny", 太阳: true, 雨滴: 0, 雪花: 0, 配饰: "墨镜" },
  };
  res.json({ 城市: city, ...(scenarioMap[w.天气] || scenarioMap["晴"]), 温度: w.温度, 图标: w.图标 || "☀️" });
});

export default router;
