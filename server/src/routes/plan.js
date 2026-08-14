/**
 * 路线生成接口（对应 M2 路线生成 + M6 路线选择）
 * 调用 AI 生成 3 条路线，并支持选择 1 条后保存
 */
import { Router } from "express";
import { generateRoutes } from "../ai.js";
import { run, get } from "../db.js";

const router = Router();

// POST /api/plan/generate 生成3条路线
router.post("/generate", async (req, res) => {
  const { 出发地, 目的地, 游玩天数 = 3, 精力状态 = "正常", 偏好 = [] } = req.body || {};
  if (!出发地 || !目的地) {
    return res.status(400).json({ error: "出发地和目的地不能为空" });
  }
  try {
    const data = await generateRoutes({ 出发地, 目的地, 游玩天数, 精力状态, 偏好 });
    // 保存路线到数据库
    const result = run(
      "INSERT INTO routes (departure, destination, days, energy, routes_json) VALUES (?,?,?,?,?)",
      出发地, 目的地, 游玩天数, 精力状态, JSON.stringify(data.routes)
    );
    res.json({ plan_id: result.lastInsertRowid, routes: data.routes });
  } catch (e) {
    console.error("[plan] 生成失败:", e);
    res.status(500).json({ error: "路线生成失败" });
  }
});

// POST /api/plan/select 用户选定1条路线（M6）
router.post("/select", (req, res) => {
  const { plan_id, index } = req.body || {};
  if (plan_id == null || index == null) {
    return res.status(400).json({ error: "缺少 plan_id 或 index" });
  }
  run("UPDATE routes SET selected_index = ? WHERE id = ?", index, plan_id);
  res.json({ ok: true, selected_index: index });
});

// GET /api/plan/:id 获取已保存路线
router.get("/:id", (req, res) => {
  const row = get("SELECT * FROM routes WHERE id = ?", req.params.id);
  if (!row) return res.status(404).json({ error: "路线不存在" });
  res.json({
    plan_id: row.id,
    出发地: row.departure,
    目的地: row.destination,
    游玩天数: row.days,
    精力状态: row.energy,
    选定路线: row.selected_index,
    routes: JSON.parse(row.routes_json),
  });
});

export default router;
