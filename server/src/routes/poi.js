/**
 * POI 接口（对应 M5 第三方 POI）
 * 优先使用第三方 POI 演示库；未收录的城市由 cityFeature 生成真实当地打卡点，
 * 交通耗时统一用真实景点经纬度 + 市内交通速度模型计算（不返回编造值）。
 */
import { Router } from "express";
import { getCityFeature, buildCityPoiPool } from "../cityFeature.js";
import { planCityTraffic, resolveCity } from "../transport.js";

const router = Router();

const POI_DB = {
  成都: [
    { 名称: "大熊猫基地", 类型: "网红纪念馆", 推荐时间: "08:00-10:00", 注意事项: "需提前预约，周一闭馆", 经度: 104.09, 纬度: 30.7 },
    { 名称: "宽窄巷子", 类型: "老街", 推荐时间: "15:00-17:00", 经度: 104.05, 纬度: 30.66 },
    { 名称: "锦里古街", 类型: "网红景点", 推荐时间: "18:00-20:00", 经度: 104.05, 纬度: 30.64 },
  ],
  北京: [
    { 名称: "故宫", 类型: "网红纪念馆", 推荐时间: "09:00-11:30", 注意事项: "周一闭馆，需预约", 经度: 116.39, 纬度: 39.92 },
    { 名称: "天安门广场", 类型: "地标", 推荐时间: "11:30-13:00", 经度: 116.39, 纬度: 39.9 },
  ],
};

// 打卡点序号 → 推荐时间段（上午/午后/傍晚/夜晚，约 2 小时一个点）
function slotTime(index, strength = "经典") {
  const startHour = strength === "特种兵" ? 7 : 9;
  const h = startHour + index * 2.5;
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const end = hh + 2;
  const p = (n) => String(n).padStart(2, "0");
  return `${p(hh)}:${p(mm)}-${p(end % 24)}:00`;
}

/** 给打卡点补齐交通：按真实经纬度与速度模型计算，并写清里程与备选方式 */
function fillTraffic(list, city) {
  return list.map((poi, i) => {
    const from = i === 0 ? `${city}市中心酒店` : list[i - 1].名称;
    const plan = planCityTraffic(city, from, poi.名称, poi.交通?.推荐方式);
    if (!plan) return poi;
    return {
      ...poi,
      推荐时间: poi.推荐时间 || slotTime(i),
      交通: {
        ...(poi.交通 || {}),
        推荐方式: plan.方式,
        替代方式: plan.替代方式,
        耗时: `约${plan.mins}分钟`,
        里程: `${plan.km}公里`,
        推荐理由:
          plan.方式 === poi.交通?.推荐方式
            ? `${poi.交通?.推荐理由 || "便捷直达"}，全程约${plan.km}公里`
            : `两地实际路程约${plan.km}公里，${plan.方式}最快，约${plan.mins}分钟`,
      },
    };
  });
}

/** 城市未收录在 POI_DB 时，用当地特色生成打卡点 */
function buildFromFeature(rawCity) {
  const city = resolveCity(rawCity);
  const pool = buildCityPoiPool(city).slice(0, 6);
  return pool.map((p, i) => ({ 名称: p.名称, 类型: p.类型, 推荐时间: slotTime(i) }));
}

// GET /api/poi/search?city=成都&keyword=熊猫
router.get("/search", (req, res) => {
  const rawCity = req.query.city || "";
  const keyword = req.query.keyword || "";
  const city = resolveCity(rawCity) || rawCity;

  // 第三方库命中就用库里的；否则按当地特色生成，避免地图页空行程
  let pois = POI_DB[city] || POI_DB[rawCity] || buildFromFeature(city);
  if (keyword) {
    pois = pois.filter((p) => p.名称.includes(keyword) || p.类型.includes(keyword));
  }
  res.json(fillTraffic(pois, city));
});

// GET /api/poi/:city/hot 热门打卡点（网红优先）
router.get("/:city/hot", (req, res) => {
  const rawCity = req.params.city;
  const city = resolveCity(rawCity) || rawCity;
  const pois = POI_DB[city] || POI_DB[rawCity] || buildFromFeature(city);
  const sorted = [...pois].sort(
    (a, b) => (a.类型.includes("网红") ? 0 : 1) - (b.类型.includes("网红") ? 0 : 1)
  );
  res.json(fillTraffic(sorted, city));
});

export default router;
