# 旅行计划生成 App

[![CI](https://github.com/Novant-Veyjey/travel-planning-app/actions/workflows/ci.yml/badge.svg)](https://github.com/Novant-Veyjey/travel-planning-app/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vue](https://img.shields.io/badge/Vue-3-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)

输入出发地、目的地、游玩天数与偏好，结合实时天气、城市特色、交通耗时和 AI，生成休闲、经典、特种兵三类路线，并在同一张立体卡通地图中完成路线浏览、GPS 定位、逐站导航和当地民族服饰换装。


## 功能

- 输入 1 至 7 天行程与美食、人文、自然、购物偏好，一次生成 3 条差异化路线
- 接入 Open-Meteo，展示实时天气、温度，以及晴、雨、雪场景和地图天气动画
- 综合真实城市间耗时、景点间道路距离和交通方式，推荐高铁、飞机、自驾、地铁、公交、骑行或步行
- 使用 SVG 与 Web Mercator 投影绘制单页立体卡通地图，不依赖第三方地图 SDK
- 按真实经纬度呈现河流、湖泊、道路、3D 建筑、山峰和植被，并展示当地建筑及民族特色
- 人物使用可换装 SVG 建模，会根据目的地民族元数据切换传统服饰、头饰和纹样
- GPS 定位成功时显示真实位置，失败时自动切换模拟定位；支持下一站指引、距离耗时和沿途附近景点推荐
- 地图与行程时间线展示每日打卡点、完整路线和天气，并按真实交通耗时动态推进时间
- 使用 SQLite 持久化输入、路线与会话，刷新页面后可继续规划
- 未配置 AI Key 时自动使用本地模拟路线，仍可完整体验主要流程

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 前端 | Vue 3、Vue Router、Vite |
| 后端 | Node.js、Express |
| 数据 | SQLite（sql.js） |
| 地图 | SVG + Web Mercator 投影，真实经纬度数据驱动 |
| AI | DeepSeek API，兼容 OpenAI Chat Completions 格式 |
| 天气 | Open-Meteo |
| 部署 | Render Blueprint |

## 项目结构

```text
travel-planning-app/
├── .github/                    # CI、Issue 与 PR 模板
├── docs/
│   ├── assets/                 # 截图与产品原型
│   ├── feature-breakdown.md    # 功能模块拆解
│   ├── product-requirements.md # 产品需求文档
│   └── README.md               # 文档索引
├── server/
│   ├── src/
│   │   ├── routes/             # weather / poi / plan / session / city / geo
│   │   ├── ai.js               # AI 路线生成
│   │   ├── cityFeature.js      # 城市特色数据
│   │   ├── db.js               # SQLite 初始化与持久化
│   │   ├── geo.js              # 真实地理、地标坐标与距离计算
│   │   ├── index.js            # Express 入口
│   │   └── transport.js        # 交通方式与耗时估算
│   └── package.json
├── web/
│   ├── src/
│   │   ├── api/                # 后端接口封装
│   │   ├── assets/             # 城市插画、图标、民族服饰与样式
│   │   ├── components/         # FigureAvatar 人物建模 / RealMap 立体地图
│   │   ├── router/             # Vue Router
│   │   └── views/              # Home / Routes / MapView
│   ├── vite.config.js
│   └── package.json
├── .env.example
├── .gitignore
├── render.yaml
└── README.md
```

## 页面流程

| 路径 | 页面 | 说明 |
| --- | --- | --- |
| `/` | 行程规划 | 填写出发地、目的地、天数和偏好 |
| `/routes` | 我的行程 | 生成并比较 3 条路线，查看交通、日程、特色和费用 |
| `/map` | 导航地图 | 单页立体卡通地图、人物建模、GPS、周边推荐和逐站导航 |
| `/walk` | 兼容入口 | 自动重定向到 `/map?view=real` |

## 本地运行

### 环境要求

- Node.js 18.18 或更高版本
- npm 9 或更高版本

### 安装依赖

```bash
git clone https://github.com/Novant-Veyjey/travel-planning-app.git
cd travel-planning-app

npm ci --prefix server
npm ci --prefix web
```

### 配置 AI Key（可选）

PowerShell：

```powershell
Copy-Item .env.example server\.env
```

macOS / Linux：

```bash
cp .env.example server/.env
```

在 `server/.env` 中配置：

```dotenv
DEEPSEEK_API_KEY=your_deepseek_api_key_here
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-v4-flash
```

`DEEPSEEK_API_KEY` 可以留空；`AI_BASE_URL` 和 `AI_MODEL` 也支持替换为其他兼容 OpenAI Chat Completions 的服务。未配置 Key 时，服务会自动使用本地模拟数据生成路线。

### 开发模式

分别打开两个终端：

```bash
npm --prefix server run dev
```

```bash
npm --prefix web run dev
```

前端地址为 `http://localhost:5173`，Vite 会把 `/api` 请求代理到后端。

### 生产模式

```bash
npm --prefix web run build
npm --prefix server run start
```

打开 `http://localhost:3000`。

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 服务与 AI Key 状态 |
| POST | `/api/plan/generate` | 生成 3 条路线 |
| POST | `/api/plan/select` | 选择 1 条路线 |
| GET | `/api/plan/:id` | 获取已保存路线 |
| GET | `/api/weather/:city` | 获取实时天气 |
| POST | `/api/weather/scenario` | 获取天气场景配置 |
| GET | `/api/poi/search?city=成都&keyword=熊猫` | 搜索打卡点 |
| GET | `/api/city/:name` | 获取城市特色 |
| GET | `/api/geo/:city` | 获取水系、道路和 3D 建筑数据 |
| GET | `/api/geo/coords` | 批量获取行程打卡点的真实坐标 |
| GET | `/api/geo/nearby` | 查询附近景点与步行耗时 |
| GET | `/api/geo/walk` | 计算两点步行距离与耗时 |
| POST | `/api/session/new` | 创建行程会话 |
| GET | `/api/session/:id` | 恢复行程会话 |
| POST | `/api/session/:id/input` | 保存用户行程输入 |
| POST | `/api/session/:id/plan` | 关联已选择路线 |

## 部署

仓库包含 [render.yaml](render.yaml)。在 Render 中创建 Blueprint 后，按提示配置 `DEEPSEEK_API_KEY` 即可部署。

## 文档

- [产品需求](docs/product-requirements.md)
- [功能模块拆解](docs/feature-breakdown.md)
- [文档索引](docs/README.md)

## 参与贡献

提交代码前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。请勿提交 `.env`、数据库文件、构建产物和其他本地运行数据。
