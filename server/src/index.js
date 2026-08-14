/**
 * 卡通地图旅游计划生成 App - 后端入口
 * Node.js + Express + SQLite
 */
import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import weatherRouter from "./routes/weather.js";
import poiRouter from "./routes/poi.js";
import planRouter from "./routes/plan.js";
import sessionRouter from "./routes/session.js";
import cityRouter from "./routes/city.js";
import { init } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 健康检查
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", api_key_configured: Boolean(process.env.DEEPSEEK_API_KEY) });
});

// 注册路由
app.use("/api/weather", weatherRouter);
app.use("/api/poi", poiRouter);
app.use("/api/plan", planRouter);
app.use("/api/session", sessionRouter);
app.use("/api/city", cityRouter);

// 托管前端构建产物（web/dist）
const distDir = path.join(__dirname, "../../web/dist");

// 为构建产物设置缓存：index.html 不缓存（保证拿最新版本），带 hash 的 assets 长期缓存
app.use((req, res, next) => {
  if (req.path === "/" || req.path.endsWith(".html")) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  } else if (/\.(js|css|png|jpg|svg|woff2?)$/.test(req.path)) {
    // 带 hash 的资源（/assets/xxx-hash.js）可以长期缓存
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }
  next();
}, express.static(distDir));

// SPA 路由回退：非 /api 路径都返回 index.html，让 Vue Router 接管
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(path.join(distDir, "index.html"));
});

// 先初始化 SQLite，再启动服务
init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ 后端已启动: http://localhost:${PORT}`);
      console.log(`   AI Key 已配置: ${Boolean(process.env.DEEPSEEK_API_KEY)}`);
    });
  })
  .catch((e) => {
    console.error("[startup] 数据库初始化失败:", e);
    process.exit(1);
  });
