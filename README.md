# 卡通地图旅游计划生成 App

输入出发地/目的地/天数，结合天气地形与 AI，生成 3 条游玩路线（休闲/经典/特种兵），并在卡通地图中实时导航。

## 功能

- **路线生成**：3 条路线（休闲/经典/特种兵），AI 按目的地特色生成，观景点与日程差异化
- **天气场景化**：地图页直接呈现天气（晴/雨/雪）
- **交通推荐**：每段行程推荐交通方式 + 耗时（基于真实城市对耗时）
- **路线选择**：3 选 1 进入地图
- **卡通导航**：地图随打卡点切换，人物沿路线实时跟随
- **数据持久化**：用户输入与路线存后端 SQLite，刷新不丢
- **前后端互通**：URL 携带数据参数 + session_id

## 项目结构

```
Claw/
├── server/              # Node.js 后端 (Express + SQLite)
│   ├── src/
│   │   ├── index.js     # 入口，托管前端 dist
│   │   ├── db.js        # SQLite 数据库
│   │   ├── ai.js        # AI 路线生成（含真实城市间耗时表）
│   │   ├── cityFeature.js  # 省份特色数据
│   │   ├── transport.js    # 交通耗时估算
│   │   └── routes/      # weather/poi/plan/session 路由
│   ├── .env             # API Key 配置（不上传 GitHub）
│   └── package.json
├── web/                 # Vue 3 前端
│   ├── src/
│   │   ├── views/       # Home / Routes / MapView
│   │   ├── api/         # API 封装
│   │   ├── assets/      # 卡通插画等静态资源
│   │   └── router/      # Vue Router
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## 快速启动

### 1. 安装依赖
```bash
cd server && npm install
cd ../web && npm install
```

### 2. 配置 API Key（可选）
复制 `.env.example` 为 `server/.env`，填入 DeepSeek Key：
```
DEEPSEEK_API_KEY=你的Key
```
无 Key 也能跑，会用模拟数据生成路线。

### 3. 启动
```bash
# 启动后端（同时托管前端构建产物）
cd server
node src/index.js
```
构建前端后访问 `http://localhost:3000` 即可使用：
```bash
cd web && npm run build
```

## 主要 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/plan/generate | 生成 3 条路线 |
| POST | /api/plan/select | 选择 1 条路线 |
| GET | /api/plan/:id | 获取路线 |
| GET | /api/city/:name | 城市特色 + 图片键 |
| POST | /api/weather/scenario | 天气场景配置 |
| GET | /api/poi/search | 搜索打卡点 |
| POST | /api/session/new | 创建行程会话 |
| GET | /api/session/:id | 获取会话（刷新恢复） |
| POST | /api/session/:id/input | 保存用户输入 |
| POST | /api/session/:id/plan | 关联路线+选择 |

