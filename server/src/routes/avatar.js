/**
 * 形象接口（对应 M3 自定义形象 + M10 当地装扮）
 * 根据目的地动态返回当地民族服饰库
 */
import { Router } from "express";
import { run } from "../db.js";

const router = Router();

// 目的地 -> 当地民族服饰库（M10 当地装扮）
const LOCAL_OUTFITS = {
  成都: { 服饰: ["川西羌族绣花裙", "成都都市连衣裙", "川剧变脸服"], 民族: "羌族" },
  拉萨: { 服饰: ["藏式藏袍", "藏红裙", "氆氇坎肩"], 民族: "藏族" },
  北京: { 服饰: ["京绣旗袍", "汉服", "唐装"], 民族: "汉族" },
  上海: { 服饰: ["海派旗袍", "摩登西装", "老上海洋装"], 民族: "汉族" },
  贵阳: { 服饰: ["苗族银饰盛装", "侗族百褶裙", "布依族蓝染裙"], 民族: "苗族" },
  昆明: { 服饰: ["彝族刺绣裙", "白族扎染", "傣族筒裙"], 民族: "彝族" },
};

const BASE_OPTIONS = {
  发型: ["长发", "短发", "双马尾", "卷发", "寸头"],
  服装: ["连衣裙", "T恤", "卫衣", "夹克", "汉服"],
  性别: ["男", "女"],
};

// GET /api/avatar/options 基础选项
router.get("/options", (req, res) => {
  res.json(BASE_OPTIONS);
});

// GET /api/avatar/local/:city 当地民族服饰库
router.get("/local/:city", (req, res) => {
  const info = LOCAL_OUTFITS[req.params.city] || { 服饰: [], 民族: "汉族" };
  res.json({ 目的地: req.params.city, 民族: info.民族, 当地服饰: info.服饰 });
});

// POST /api/avatar/save 保存形象到数据库
router.post("/save", (req, res) => {
  const { 性别 = "女", 发型 = "双马尾", 服装 = "粉色连衣裙", 当地服饰 = null, 城市 = "" } = req.body || {};
  const result = run(
    "INSERT INTO avatars (gender, hair, outfit, local_outfit, city) VALUES (?,?,?,?,?)",
    性别, 发型, 服装, 当地服饰, 城市
  );
  res.json({ id: result.lastInsertRowid, 形象: { 性别, 发型, 服装, 当地服饰 } });
});

export default router;
