# 🗺️ 卡通地图旅游计划生成 App

> 前端 Vue 3 + 后端 Node.js (Express) + SQLite 的全栈小项目。
> 输入出发地/目的地/天数，结合天气地形与 AI，生成 3 条游玩路线（休闲/经典/特种兵），并在卡通地图中实时导航。

## 功能（对应 PRD 模块）
| 模块 | 说明 |
|------|------|
| M2 路线生成 | 调用 DeepSeek AI 生成 3 条路线（有 Key 时真实生成，无 Key 时降级模拟数据） |
| M1 天气场景化 | 天气直接体现在地图页（晴=太阳、雨=下雨+打伞、雪=飘雪） |
| M5 第三方 POI | 打卡点数据接口（演示数据，可换高德/百度） |
| M6 路线选择 | 3 条路线选 1 条后进入地图 |
| M9 交通推荐 | 每段行程推荐交通方式 + 耗时（基于真实城市对耗时估算） |
| SQLite 存储 | 保存路线、选择记录、会话 |
| 会话持久化 | 用户输入/路线选择存后端 SQLite，刷新页面数据不丢失，前后端数据互通 |

## 项目结构
```
Claw/
├── server/              # Node.js 后端 (Express + SQLite)
│   ├── src/
│   │   ├── index.js     # 入口
│   │   ├── db.js        # SQLite 数据库
│   │   ├── ai.js        # AI 路线生成
│   │   └── routes/      # weather/poi/plan 路由
│   ├── .env             # API Key 配置
│   └── package.json
├── web/                 # Vue 3 前端 (Vite)
│   ├── src/
│   │   ├── views/       # Home / Routes / MapView
│   │   └── api/
│   ├── vite.config.js   # 含 /api 代理
│   └── package.json
└── README.md
```

## 快速启动

### 1. 安装依赖
```bash
# 后端
cd server
npm install

# 前端
cd ../web
npm install
```

### 2. 配置 API Key
1. 复制项目根 `.env.example` 为 `server/.env`：
   ```bash
   cp .env.example server/.env
   ```
2. 编辑 `server/.env`，填入你的 DeepSeek API Key：
   ```
   DEEPSEEK_API_KEY=你的Key
   ```
> 无 Key 时应用仍可运行（AI 返回模拟路线）。⚠️ **不要把真实 Key 提交到 GitHub。**

### 3. 启动后端
```bash
cd server
npm run dev    # 后端运行在 http://localhost:3000
```

### 4. 启动前端（开发）
```bash
cd web
npm run dev    # 前端 http://localhost:5173 （已配置 /api 代理到 3000）
```

浏览器打开 http://localhost:5173 即可使用。

### 生产部署
```bash
# 构建前端
cd web
npm run build   # 生成 web/dist

# 后端已托管 dist，直接访问 http://localhost:3000
cd ../server
npm start
```

## 主要 API
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/plan/generate | 生成 3 条路线 |
| POST | /api/plan/select | 选择 1 条路线 |
| GET | /api/plan/:id | 获取路线 |
| GET | /api/weather/:city | 获取天气 |
| POST | /api/weather/scenario | 天气场景配置（雨/雪/晴） |
| GET | /api/poi/search | 搜索打卡点 |
| POST | /api/session/new | 创建行程会话 |
| GET | /api/session/:id | 获取会话状态（刷新恢复） |
| POST | /api/session/:id/input | 保存用户输入 |
| POST | /api/session/:id/plan | 关联路线+选择 |

## 待接入（PRD 开放问题）
- [ ] 真实天气 API（和风天气）
- [ ] 真实 POI（高德/百度）
- [ ] 地图实时定位跟随（高德 SDK / wx.getLocation）
