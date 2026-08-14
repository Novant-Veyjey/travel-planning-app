/**
 * 城市特色接口
 * 前端横幅根据出发地/目的地动态展示当地建筑、地形、特色元素
 */
import { Router } from "express";
import { getCityFeature } from "../cityFeature.js";

const router = Router();

// GET /api/city/:name 获取城市特色
router.get("/:name", (req, res) => {
  res.json(getCityFeature(req.params.name));
});

export default router;
