/**
 * POI 接口（对应 M5 第三方 POI）
 * 对接第三方 POI 服务获取真实打卡点；当前为演示数据
 */
import { Router } from "express";

const router = Router();

const POI_DB = {
  成都: [
    { 名称: "大熊猫基地", 类型: "网红纪念馆", 推荐时间: "08:00-10:00", 交通: { 推荐方式: "地铁3号线", 替代方式: ["打车"], 耗时: "40min", 推荐理由: "早到避开人流" }, 注意事项: "需提前预约，周一闭馆", 经度: 104.09, 纬度: 30.7 },
    { 名称: "宽窄巷子", 类型: "老街", 推荐时间: "15:00-17:00", 交通: { 推荐方式: "步行", 替代方式: ["公交"], 耗时: "10min", 推荐理由: "距离近，适合漫步" }, 经度: 104.05, 纬度: 30.66 },
    { 名称: "锦里古街", 类型: "网红景点", 推荐时间: "18:00-20:00", 交通: { 推荐方式: "公交", 替代方式: ["打车"], 耗时: "15min", 推荐理由: "夜游锦里景色好" }, 经度: 104.05, 纬度: 30.64 },
  ],
  北京: [
    { 名称: "故宫", 类型: "网红纪念馆", 推荐时间: "09:00-11:30", 交通: { 推荐方式: "地铁1号线", 替代方式: ["打车", "公交"], 耗时: "25min", 推荐理由: "地铁直达避堵" }, 注意事项: "周一闭馆，需预约", 经度: 116.39, 纬度: 39.92 },
    { 名称: "天安门广场", 类型: "地标", 推荐时间: "11:30-13:00", 交通: { 推荐方式: "步行", 替代方式: [], 耗时: "5min", 推荐理由: "紧邻故宫" }, 经度: 116.39, 纬度: 39.9 },
  ],
};

// GET /api/poi/search?city=成都&keyword=熊猫
router.get("/search", (req, res) => {
  const city = req.query.city || "";
  const keyword = req.query.keyword || "";
  let pois = POI_DB[city] || [];
  if (keyword) {
    pois = pois.filter((p) => p.名称.includes(keyword) || p.类型.includes(keyword));
  }
  res.json(pois);
});

// GET /api/poi/:city/hot 热门打卡点（网红优先）
router.get("/:city/hot", (req, res) => {
  const pois = POI_DB[req.params.city] || [];
  const sorted = [...pois].sort(
    (a, b) => (a.类型.includes("网红") ? 0 : 1) - (b.类型.includes("网红") ? 0 : 1)
  );
  res.json(sorted);
});

export default router;
