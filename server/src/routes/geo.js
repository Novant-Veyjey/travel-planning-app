/**
 * 真实地理接口（步行导航用）
 * GET /api/geo/:city         → 水系 / 道路 / 立体建筑（真实经纬度）
 * GET /api/geo/nearby        → 按真实坐标返回周边景点与步行耗时
 */
import { Router } from "express";
import { getCityGeo, getNearby, walkInfo } from "../geo.js";

const router = Router();

// GET /api/geo/nearby?city=成都&lat=30.66&lon=104.07&r=1.5
router.get("/nearby", (req, res) => {
  const city = req.query.city || "";
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const r = parseFloat(req.query.r) || 1.5;
  if (!city || !isFinite(lat) || !isFinite(lon)) {
    return res.status(400).json({ error: "缺少 city/lat/lon" });
  }
  res.json({
    城市: city,
    当前位置: { 纬度: lat, 经度: lon },
    周边: getNearby(city, lat, lon, r),
  });
});

// GET /api/geo/walk?lat=&lon=&tlat=&tlon= 步行耗时
router.get("/walk", (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const tlat = parseFloat(req.query.tlat);
  const tlon = parseFloat(req.query.tlon);
  if (![lat, lon, tlat, tlon].every(isFinite)) {
    return res.status(400).json({ error: "缺少 lat/lon/tlat/tlon" });
  }
  res.json(walkInfo(lat, lon, tlat, tlon));
});

// GET /api/geo/:city
router.get("/:city", (req, res) => {
  res.json(getCityGeo(req.params.city));
});

export default router;
