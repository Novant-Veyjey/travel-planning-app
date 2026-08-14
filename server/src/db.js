/**
 * SQLite 数据库模块（sql.js - 纯WASM，无需编译）
 * 注意：sql.js 的数据库在内存中，通过 initSqlJs 异步初始化。
 * 为简化小项目，这里采用内存库 + 建表。
 */
import initSqlJs from "sql.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, "../data/travel.db");

let db = null;

/** 同步执行 SQL，返回 lastInsertRowid 和 changes */
function run(sql, ...params) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
  const lastRow = db.exec("SELECT last_insert_rowid() AS id")[0];
  const changes = db.getRowsModified();
  // 写操作后立即持久化，保证重启后端数据不丢失（会话/形象/路线）
  persist();
  return {
    lastInsertRowid: lastRow?.values?.[0]?.[0] ?? null,
    changes,
  };
}

/** 查询单行（第一条） */
function get(sql, ...params) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  return row || null;
}

/** 查询多行 */
function all(sql, ...params) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/** 持久化数据库到文件（可选） */
function persist() {
  try {
    fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
  } catch (e) {
    console.error("[db] 持久化失败:", e.message);
  }
}

/** 初始化数据库 */
async function init() {
  const SQL = await initSqlJs();
  const dataDir = path.dirname(DB_FILE);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  if (fs.existsSync(DB_FILE)) {
    db = new SQL.Database(fs.readFileSync(DB_FILE));
  } else {
    db = new SQL.Database();
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      departure TEXT,
      destination TEXT,
      days INTEGER,
      energy TEXT,
      routes_json TEXT,
      selected_index INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER,
      poi_name TEXT,
      checked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      input_json TEXT,
      plan_id INTEGER,
      selected_index INTEGER,
      destination TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  persist();
  console.log("[db] SQLite 初始化完成");
}

export { init, run, get, all, persist, DB_FILE };
