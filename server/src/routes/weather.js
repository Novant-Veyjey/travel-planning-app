/**
 * 天气接口（对应 M1 天气场景化）
 * 返回目的地天气，前端据此切换场景（晴/雨/雪）
 */
import { Router } from "express";

const router = Router();

// 演示天气数据（接入真实天气API时替换）
const MOCK = {
  成都: { 城市: "成都", 天气: "晴", 温度: 26 },
  北京: { 城市: "北京", 天气: "晴", 温度: 25 },
  上海: { 城市: "上海", 天气: "雨", 温度: 24 },
  拉萨: { 城市: "拉萨", 天气: "晴", 温度: 15 },
  贵阳: { 城市: "贵阳", 天气: "阴", 温度: 20 },
};

// GET /api/weather/:city
router.get("/:city", (req, res) => {
  const city = req.params.city;
  const w = MOCK[city] || { 城市: city, 天气: "晴", 温度: 22 };
  res.json(w);
});

// POST /api/weather/scenario 返回场景配置驱动前端动画
router.post("/scenario", (req, res) => {
  const city = req.body?.city || "";
  const w = MOCK[city] || { 天气: "晴", 温度: 22 };
  const scenarioMap = {
    晴: { 场景: "sunny", 太阳: true, 雨滴: 0, 雪花: 0, 配饰: "墨镜" },
    雨: { 场景: "rainy", 太阳: false, 雨滴: 80, 雪花: 0, 配饰: "打伞" },
    雪: { 场景: "snowy", 太阳: false, 雨滴: 0, 雪花: 60, 配饰: "围巾帽子" },
    阴: { 场景: "cloudy", 太阳: false, 雨滴: 0, 雪花: 0, 配饰: "无" },
  };
  res.json({ 城市: city, ...(scenarioMap[w.天气] || scenarioMap["晴"]), 温度: w.温度 });
});

export default router;
