/**
 * 行程会话接口
 * 用于前后端数据互通 + 刷新恢复（session 存 SQLite）
 */
import { Router } from "express";
import crypto from "crypto";
import { run, get } from "../db.js";

const router = Router();

// 生成新的 session_id
function newSessionId() {
  return crypto.randomUUID();
}

// POST /api/session/new 创建新会话
router.post("/new", (req, res) => {
  const session_id = newSessionId();
  run("INSERT INTO sessions (session_id) VALUES (?)", session_id);
  res.json({ session_id });
});

// GET /api/session/:id 获取会话完整状态
router.get("/:id", (req, res) => {
  const row = get("SELECT * FROM sessions WHERE session_id = ?", req.params.id);
  if (!row) return res.status(404).json({ error: "会话不存在" });

  const result = {
    session_id: row.session_id,
    input: row.input_json ? JSON.parse(row.input_json) : null,
    plan_id: row.plan_id,
    selected_index: row.selected_index,
    destination: row.destination,
  };

  // 若有关联路线，一并返回
  if (row.plan_id) {
    const plan = get("SELECT * FROM routes WHERE id = ?", row.plan_id);
    if (plan) {
      result.routes = JSON.parse(plan.routes_json);
      result.selected_route = result.selected_index != null ? result.routes[result.selected_index] : null;
    }
  }
  res.json(result);
});

// POST /api/session/:id/input 保存用户输入
router.post("/:id/input", (req, res) => {
  const { input } = req.body || {};
  if (!input) return res.status(400).json({ error: "缺少 input" });
  const dest = input.目的地 || "";
  run(
    "UPDATE sessions SET input_json = ?, destination = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?",
    JSON.stringify(input), dest, req.params.id
  );
  res.json({ ok: true });
});

// POST /api/session/:id/plan 关联路线 + 选择
router.post("/:id/plan", (req, res) => {
  const { plan_id, selected_index } = req.body || {};
  if (plan_id == null) return res.status(400).json({ error: "缺少 plan_id" });
  run(
    "UPDATE sessions SET plan_id = ?, selected_index = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?",
    plan_id, selected_index ?? null, req.params.id
  );
  res.json({ ok: true });
});

export default router;
