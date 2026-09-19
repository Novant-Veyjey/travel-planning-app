/**
 * 特征建筑（地标）形制建模
 *
 * 目标：地标按"真实建筑的样子"画，而不是统一的方块 + emoji。
 * 做法：
 *   1) buildingShapeOf(名称) 按名称归类到 ~17 种形制；自然景观（山/湖/江/岛/滩…）返回 null，
 *      这些交给地图上的山峰与地形标注呈现，不再画成楼房。
 *   2) buildBuildingShape(形制, x, y, w, h) 生成该形制的 SVG 路径与"夜灯"点位。
 *
 * 约定：局部坐标用 width 的比例 lx ∈ [-0.5, 0.5]、高度比例 ly ∈ [0, 1]（0 在地面、1 在顶），
 * 由 frame() 换算成绝对坐标，因此同一形制能适配任意楼宽楼高。
 */

/* ============ 名称 → 形制 ============
 * 顺序即优先级：越具体的形制越靠前（"纪念塔"必须先于"塔"，"骑楼老街"必须先于"楼"）。
 * null 表示不是建筑，不建模。 */
const RULES = [
  // —— 特例：名字里有"滩"但其实是万国建筑群 ——
  [/外滩/, "street"],

  // —— 自然景观：不建楼（山/湖/江/岛/滩…，交给山峰与地形标注） ——
  [/山$|岭$|湖$|江$|河$|海$|湾$|岛$|屿$|滩$|沙$|洲$|溪$|池$|湿地|瀑布|黄果树|石林|天坑|草原|滑雪场|索道|公园$|大熊猫|熊猫|纳木错|天涯海角|长隆|乐园/, null],

  // —— 特殊形体 ——
  [/大佛|石窟|造像|卧佛|菩萨/, "buddha"],
  [/白塔|舍利|三塔|喇嘛|覆钵/, "stupa"],
  [/教堂|天主|圣母|清真寺|礼拜寺|索菲亚/, "dome"],
  [/电视塔|明珠|小蛮腰|广州塔|观光塔/, "tvtower"],
  [/体育场|体育馆|球场|鸟巢|土楼|围屋|围龙屋/, "stadium"],
  [/天坛|祭坛|圜丘/, "altar"],
  [/大桥|桥$|断桥|堰$/, "bridge"],
  [/城墙|城门|关$|长城|钟楼|鼓楼|朝天门|门楼|牌坊|金马碧鸡坊/, "gate"],
  [/故宫|布达拉宫|宫殿|大殿|天安门|颐和园|圆明园|园$|林卡|恭王府|总统府|明孝陵|中山陵|陵$|迪士尼|城堡|冰雪/, "palace"],
  [/博物馆|博物院|美术馆|大剧院|纪念馆|展览馆|遗址|俑$|三星堆|书院|大学|馆$/, "museum"],
  [/纪念塔|纪念碑|解放碑|广场$/, "monument"],

  // —— 食肆（必须先于"商业街"，否则"三坊七巷·美食""沙茶面"会被当成街） ——
  [/火锅|烤鸭|米线|沙茶面|小吃|美食|盖碗茶|文和友/, "shop"],

  // —— 商业街区（必须先于"楼"，否则"骑楼老街"会被当成楼阁） ——
  [/大街|巷|街$|路$|道$|里$|镇$|面$|井$|洋房|胡同|不夜城|宋城|洪崖洞|磁器口|上下九|华强北|记忆|文创|坊$|垵$/, "street"],

  // —— 中式塔 / 楼阁 ——
  [/塔/, "pagoda"],
  [/楼|阁|亭|轩|祠|寺|庙|观$|宫$|堂$|院$/, "pavilion"],

  // —— 现代高层 ——
  [/大厦|中心|大楼|国际|金融|世界之窗/, "skyscraper"],
];

/* 形制 → 相对基准尺寸的宽高系数（宫殿宽而矮、塔楼窄而高、商业街扁平…） */
export const SHAPE_SIZE = {
  pagoda: { w: 0.72, h: 1.05 },
  pavilion: { w: 0.95, h: 1.0 },
  palace: { w: 1.5, h: 0.82 },
  dome: { w: 0.9, h: 1.0 },
  tvtower: { w: 0.62, h: 1.2 },
  skyscraper: { w: 0.95, h: 1.15 },
  buddha: { w: 1.15, h: 0.95 },
  bridge: { w: 1.85, h: 0.55 },
  museum: { w: 1.5, h: 0.62 },
  gate: { w: 1.3, h: 0.78 },
  stupa: { w: 0.8, h: 0.95 },
  stadium: { w: 1.5, h: 0.55 },
  altar: { w: 1.15, h: 0.9 },
  monument: { w: 0.72, h: 0.9 },
  street: { w: 1.7, h: 0.5 },
  shop: { w: 1.0, h: 0.45 },
  generic: { w: 1, h: 1 },
};

/** 名称 → 形制 key；null 表示不是建筑（自然景观） */
export function buildingShapeOf(name) {
  const s = String(name || "");
  for (const [re, shape] of RULES) if (re.test(s)) return shape;
  return "generic";
}

/* ============ 绘图工具 ============ */
function frame(x, y, w, h) {
  const px = (lx) => +(x + lx * w).toFixed(1);
  const py = (ly) => +(y - ly * h).toFixed(1);
  return { px, py };
}
const poly = (...pts) => "M" + pts.map(([a, b]) => `${a},${b}`).join(" L") + " Z";
const rect = (x1, y1, x2, y2) => poly([x1, y1], [x2, y1], [x2, y2], [x1, y2]);
/** 起翘的屋面：两侧檐角上扬的中式屋顶 */
const eave = (px, py, ly, ew, drop = 0.06, up = 0.05) =>
  `M${px(-ew)},${py(ly)} Q${px(0)},${py(ly + drop)} ${px(ew)},${py(ly)} ` +
  `L${px(ew * 0.8)},${py(ly - up)} L${px(-ew * 0.8)},${py(ly - up)} Z`;

/* ============ 各形制绘制 ============ */
const BUILDERS = {
  /** 塔：多层飞檐 + 塔刹 */
  pagoda(x, y, w, h) {
    const { px, py } = frame(x, y, w, h);
    const tiers = Math.max(3, Math.min(7, Math.round(h / 14) + 2));
    const parts = [
      { d: rect(px(-0.32), py(0), px(0.32), py(0.06)), fill: "#ddd3c2", stroke: "#bfb3a0" },
      { d: poly([px(-0.24), py(0.06)], [px(0.24), py(0.06)], [px(0.1), py(0.8)], [px(-0.1), py(0.8)]), fill: "#efe3cb", stroke: "#cbb994" },
    ];
    for (let i = 0; i < tiers; i++) {
      const t = i / (tiers - 1);
      parts.push({
        d: eave(px, py, 0.12 + t * 0.64, 0.46 * (1 - t * 0.5), 0.055, 0.045),
        fill: i % 2 ? "#c0503c" : "#b8493a",
        stroke: "#96382c",
      });
    }
    parts.push({ d: poly([px(-0.04), py(0.78)], [px(0.04), py(0.78)], [px(0.014), py(1)], [px(-0.014), py(1)]), fill: "#e3b64a" });
    const lights = [];
    for (let i = 0; i < tiers; i++) lights.push({ x: px(0), y: py(0.16 + (i / (tiers - 1)) * 0.62), r: 1.5 });
    return { parts, lights };
  },

  /** 楼阁：台基 + 楼身 + 三层重檐 */
  pavilion(x, y, w, h) {
    const { px, py } = frame(x, y, w, h);
    const parts = [
      { d: rect(px(-0.46), py(0), px(0.46), py(0.09)), fill: "#e8e0d2", stroke: "#c9bfae" },
      { d: rect(px(-0.31), py(0.09), px(0.31), py(0.52)), fill: "#b4453a", stroke: "#8d3129" },
      { d: rect(px(-0.2), py(0.52), px(0.2), py(0.72)), fill: "#b4453a", stroke: "#8d3129" },
      { d: eave(px, py, 0.52, 0.5, 0.07, 0.05), fill: "#4c5c72" },
      { d: eave(px, py, 0.72, 0.4, 0.06, 0.04), fill: "#43536b" },
      { d: eave(px, py, 0.9, 0.3, 0.05, 0.04), fill: "#3c4a60" },
      { d: poly([px(-0.035), py(0.92)], [px(0.035), py(0.92)], [px(0), py(1)]), fill: "#e3b64a" },
    ];
    const lights = [0.2, 0.36, 0.62].map((ly) => ({ x: px(0), y: py(ly), r: 1.8 }));
    return { parts, lights };
  },

  /** 宫殿/大殿：白玉台基 + 重檐庑殿顶 */
  palace(x, y, w, h) {
    const { px, py } = frame(x, y, w, h);
    const parts = [
      { d: rect(px(-0.5), py(0), px(0.5), py(0.14)), fill: "#eee7d8", stroke: "#cfc6b4" },
      { d: rect(px(-0.38), py(0.14), px(0.38), py(0.5)), fill: "#a8402f", stroke: "#862f22" },
      { d: eave(px, py, 0.5, 0.46, 0.08, 0.06), fill: "#e0b23c", stroke: "#c39528" },
      { d: rect(px(-0.28), py(0.62), px(0.28), py(0.72)), fill: "#a8402f", stroke: "#862f22" },
      { d: eave(px, py, 0.72, 0.34, 0.07, 0.06), fill: "#e8bd46", stroke: "#c39528" },
      { d: rect(px(-0.34), py(0.84), px(0.34), py(0.87)), fill: "#c99a24" },
    ];
    const lights = [-0.22, 0, 0.22].map((lx) => ({ x: px(lx), y: py(0.32), r: 1.9 }));
    return { parts, lights };
  },

  /** 教堂 / 清真寺：穹顶 + 尖顶 */
  dome(x, y, w, h) {
    const { px, py } = frame(x, y, w, h);
    const parts = [
      { d: rect(px(-0.42), py(0), px(0.42), py(0.42)), fill: "#efe9dd", stroke: "#d0c7b7" },
      { d: rect(px(-0.09), py(0), px(0.09), py(0.16)), fill: "#8b6b4a" },
      { d: rect(px(-0.28), py(0.42), px(0.28), py(0.5)), fill: "#e2dbcd" },
      { d: `M${px(-0.26)},${py(0.5)} A${(0.26 * w).toFixed(1)},${(0.28 * h).toFixed(1)} 0 0 1 ${px(0.26)},${py(0.5)} Z`, fill: "#7fb2a8", stroke: "#639288" },
      { d: rect(px(-0.03), py(0.78), px(0.03), py(0.9)), fill: "#e8e2d6" },
      { d: rect(px(-0.1), py(0.9), px(0.1), py(0.93)), fill: "#c9a13c" },
      { d: rect(px(-0.012), py(0.93), px(0.012), py(1)), fill: "#c9a13c" },
      { d: rect(px(-0.06), py(0.955), px(0.06), py(0.98)), fill: "#c9a13c" },
    ];
    const lights = [{ x: px(0), y: py(0.62), r: 2.2 }];
    return { parts, lights };
  },

  /** 电视塔：细杆 + 球体（东方明珠、广州塔一类） */
  tvtower(x, y, w, h) {
    const { px, py } = frame(x, y, w, h);
    const parts = [
      { d: poly([px(-0.34), py(0)], [px(0.34), py(0)], [px(0.1), py(0.34)], [px(-0.1), py(0.34)]), fill: "#dbe4ee", stroke: "#b9c6d6" },
      { d: rect(px(-0.1), py(0.3), px(0.1), py(0.94)), fill: "#cfdae8", stroke: "#b2c1d3" },
      { d: `M${px(-0.3)},${py(0.52)} A${(0.3 * w).toFixed(1)},${(0.11 * h).toFixed(1)} 0 1 1 ${px(0.3)},${py(0.52)} Z`, fill: "#e085a8", stroke: "#c06a8d" },
      { d: `M${px(-0.21)},${py(0.76)} A${(0.21 * w).toFixed(1)},${(0.085 * h).toFixed(1)} 0 1 1 ${px(0.21)},${py(0.76)} Z`, fill: "#e79ab8", stroke: "#c06a8d" },
      { d: poly([px(-0.022), py(0.94)], [px(0.022), py(0.94)], [px(0), py(1)]), fill: "#9fb0c4" },
    ];
    const lights = [
      { x: px(0), y: py(0.52), r: 2.4 },
      { x: px(0), y: py(0.76), r: 1.8 },
    ];
    return { parts, lights };
  },

  /** 摩天楼：收分玻璃塔 + 顶冠 */
  skyscraper(x, y, w, h) {
    const { px, py } = frame(x, y, w, h);
    const parts = [
      { d: poly([px(-0.42), py(0)], [px(0.42), py(0)], [px(0.3), py(0.8)], [px(-0.3), py(0.8)]), fill: "#8fb6dd", stroke: "#6d97c1" },
      { d: poly([px(-0.3), py(0.8)], [px(0.3), py(0.8)], [px(0.16), py(0.92)], [px(-0.16), py(0.92)]), fill: "#b3cfe9", stroke: "#8fb0d0" },
      { d: rect(px(-0.05), py(0.92), px(0.05), py(1)), fill: "#cdd9e6" },
      { d: rect(px(-0.42), py(0), px(-0.34), py(0.8)), fill: "rgba(255,255,255,0.22)" },
      { d: rect(px(0.3), py(0), px(0.4), py(0.8)), fill: "rgba(30,60,95,0.18)" },
    ];
    const lights = [];
    for (let ly = 0.12; ly < 0.78; ly += 0.16) {
      lights.push({ x: px(-0.18), y: py(ly), r: 1.2 }, { x: px(0.16), y: py(ly), r: 1.2 });
    }
    return { parts, lights };
  },

  /** 大佛：坐像剪影 + 莲座 */
  buddha(x, y, w, h) {
    const { px, py } = frame(x, y, w, h);
    const parts = [
      { d: rect(px(-0.44), py(0), px(0.44), py(0.12)), fill: "#d9c9a6", stroke: "#bfae8b" },
      { d: poly([px(-0.34), py(0.12)], [px(0.34), py(0.12)], [px(0.22), py(0.36)], [px(-0.22), py(0.36)]), fill: "#c9b489", stroke: "#ac9a72" },
      { d: poly([px(-0.22), py(0.36)], [px(0.22), py(0.36)], [px(0.17), py(0.6)], [px(-0.17), py(0.6)]), fill: "#bd9f6f", stroke: "#a2895f" },
      { d: `M${px(-0.15)},${py(0.62)} A${(0.15 * w).toFixed(1)},${(0.14 * h).toFixed(1)} 0 0 1 ${px(0.15)},${py(0.62)} Z`, fill: "#e2c79a", stroke: "#c4a97e" },
      { d: poly([px(-0.1), py(0.9)], [px(0.1), py(0.9)], [px(0.05), py(1)], [px(-0.05), py(1)]), fill: "#d8b96a" },
    ];
    return { parts, lights: [] };
  },

  /** 桥：桥面 + 拱 + 桥墩 */
  bridge(x, y, w, h) {
    const { px, py } = frame(x, y, w, h);
    const parts = [
      { d: rect(px(-0.5), py(0.42), px(0.5), py(0.5)), fill: "#c9ccd2", stroke: "#a6aab2" },
      { d: `M${px(-0.36)},${py(0)} A${(0.36 * w).toFixed(1)},${(0.34 * h).toFixed(1)} 0 0 1 ${px(0.36)},${py(0)} Z`, fill: "#b9bdc4", stroke: "#9aa0a8" },
      { d: rect(px(-0.4), py(0), px(-0.32), py(0.42)), fill: "#9fa4ac" },
      { d: rect(px(0.32), py(0), px(0.4), py(0.42)), fill: "#9fa4ac" },
      { d: rect(px(-0.5), py(0.5), px(0.5), py(0.56)), fill: "#dfe3e8" },
    ];
    const lights = [-0.4, -0.14, 0.14, 0.4].map((lx) => ({ x: px(lx), y: py(0.58), r: 1.3 }));
    return { parts, lights };
  },

  /** 博物馆：低矮横向 + 柱廊挑檐 */
  museum(x, y, w, h) {
    const { px, py } = frame(x, y, w, h);
    const parts = [
      { d: rect(px(-0.5), py(0), px(0.5), py(0.14)), fill: "#e9e4d9", stroke: "#cac4b6" },
      { d: rect(px(-0.42), py(0.14), px(0.42), py(0.62)), fill: "#dfd6c4", stroke: "#bdb29c" },
      { d: rect(px(-0.5), py(0.62), px(0.5), py(0.72)), fill: "#cdc3ae", stroke: "#b1a691" },
      { d: eave(px, py, 0.8, 0.46, 0.05, 0.04), fill: "#b9ad96" },
    ];
    const lights = [];
    for (let lx = -0.34; lx <= 0.35; lx += 0.17) lights.push({ x: px(lx), y: py(0.34), r: 1.7 });
    return { parts, lights };
  },

  /** 城楼 / 牌坊：城墙 + 券门 + 楼阁 */
  gate(x, y, w, h) {
    const { px, py } = frame(x, y, w, h);
    const parts = [
      { d: rect(px(-0.5), py(0), px(0.5), py(0.46)), fill: "#b9b3a6", stroke: "#9d9789" },
      { d: `M${px(-0.13)},${py(0)} L${px(-0.13)},${py(0.2)} A${(0.13 * w).toFixed(1)},${(0.13 * h).toFixed(1)} 0 0 1 ${px(0.13)},${py(0.2)} L${px(0.13)},${py(0)} Z`, fill: "#4a4237" },
      { d: rect(px(-0.3), py(0.46), px(0.3), py(0.74)), fill: "#a8402f", stroke: "#862f22" },
      { d: eave(px, py, 0.74, 0.42, 0.07, 0.05), fill: "#e0b23c", stroke: "#c39528" },
      { d: rect(px(-0.24), py(0.88), px(0.24), py(0.92)), fill: "#c99a24" },
    ];
    const lights = [
      { x: px(0), y: py(0.16), r: 2 },
      { x: px(-0.15), y: py(0.6), r: 1.5 },
      { x: px(0.15), y: py(0.6), r: 1.5 },
    ];
    return { parts, lights };
  },

  /** 白塔：覆钵塔 + 相轮 */
  stupa(x, y, w, h) {
    const { px, py } = frame(x, y, w, h);
    const parts = [
      { d: rect(px(-0.42), py(0), px(0.42), py(0.16)), fill: "#efece4", stroke: "#d2cec3" },
      { d: rect(px(-0.3), py(0.16), px(0.3), py(0.3)), fill: "#f4f1ea", stroke: "#d2cec3" },
      { d: `M${px(-0.28)},${py(0.3)} A${(0.28 * w).toFixed(1)},${(0.26 * h).toFixed(1)} 0 0 1 ${px(0.28)},${py(0.3)} Z`, fill: "#fbf9f3", stroke: "#d8d3c6" },
      { d: poly([px(-0.13), py(0.56)], [px(0.13), py(0.56)], [px(0.06), py(0.82)], [px(-0.06), py(0.82)]), fill: "#eae5d8", stroke: "#cfc9b8" },
      { d: rect(px(-0.05), py(0.82), px(0.05), py(0.9)), fill: "#c9a13c" },
      { d: rect(px(-0.14), py(0.9), px(0.14), py(0.94)), fill: "#d8b24a" },
      { d: rect(px(-0.02), py(0.94), px(0.02), py(1)), fill: "#c9a13c" },
    ];
    const lights = [{ x: px(0), y: py(0.62), r: 1.6 }];
    return { parts, lights };
  },

  /** 体育场（鸟巢一类）：环形看台 + 外露钢结构 */
  stadium(x, y, w, h) {
    const { px, py } = frame(x, y, w, h);
    const parts = [
      { d: `M${px(-0.5)},${py(0)} A${(0.5 * w).toFixed(1)},${(0.5 * h).toFixed(1)} 0 0 1 ${px(0.5)},${py(0)} Z`, fill: "#cfd3d8", stroke: "#aeb3ba" },
      { d: `M${px(-0.36)},${py(0)} A${(0.36 * w).toFixed(1)},${(0.36 * h).toFixed(1)} 0 0 1 ${px(0.36)},${py(0)} Z`, fill: "#8f959d" },
      { d: `M${px(-0.24)},${py(0)} A${(0.24 * w).toFixed(1)},${(0.24 * h).toFixed(1)} 0 0 1 ${px(0.24)},${py(0)} Z`, fill: "#7fa86f" },
      { d: `M${px(-0.5)},${py(0)} A${(0.5 * w).toFixed(1)},${(0.5 * h).toFixed(1)} 0 0 1 ${px(0.5)},${py(0)}`, fill: "none", stroke: "#9aa0a8", sw: 1.4 },
    ];
    const lights = [-0.4, -0.14, 0.14, 0.4].map((lx) => ({ x: px(lx), y: py(0.16), r: 1.2 }));
    return { parts, lights };
  },

  /** 天坛：圆形三重檐 + 攒尖顶 */
  altar(x, y, w, h) {
    const { px, py } = frame(x, y, w, h);
    const parts = [
      { d: rect(px(-0.42), py(0), px(0.42), py(0.16)), fill: "#eae4d6", stroke: "#cbc4b4" },
      { d: rect(px(-0.26), py(0.16), px(0.26), py(0.42)), fill: "#a8402f", stroke: "#862f22" },
      { d: eave(px, py, 0.42, 0.42, 0.05, 0.04), fill: "#2f6fa8", stroke: "#255a8a" },
      { d: rect(px(-0.17), py(0.56), px(0.17), py(0.72)), fill: "#a8402f", stroke: "#862f22" },
      { d: eave(px, py, 0.72, 0.3, 0.05, 0.04), fill: "#2f6fa8", stroke: "#255a8a" },
      { d: poly([px(-0.18), py(0.86)], [px(0.18), py(0.86)], [px(0), py(1)]), fill: "#2b6394", stroke: "#255a8a" },
      { d: rect(px(-0.02), py(0.98), px(0.02), py(1)), fill: "#d8b24a" },
    ];
    const lights = [{ x: px(0), y: py(0.3), r: 1.8 }, { x: px(0), y: py(0.64), r: 1.5 }];
    return { parts, lights };
  },

  /** 纪念碑：基座 + 高柱 + 顶饰 */
  monument(x, y, w, h) {
    const { px, py } = frame(x, y, w, h);
    const parts = [
      { d: rect(px(-0.5), py(0), px(0.5), py(0.1)), fill: "#e2e5e8", stroke: "#c4c8cd" },
      { d: rect(px(-0.34), py(0.1), px(0.34), py(0.2)), fill: "#d6dade", stroke: "#bcc1c7" },
      { d: poly([px(-0.2), py(0.2)], [px(0.2), py(0.2)], [px(0.1), py(0.9)], [px(-0.1), py(0.9)]), fill: "#c9ced4", stroke: "#aeb4bb" },
      { d: poly([px(-0.12), py(0.9)], [px(0.12), py(0.9)], [px(0), py(1)]), fill: "#e6c25c" },
    ];
    const lights = [{ x: px(0), y: py(0.5), r: 1.4 }];
    return { parts, lights };
  },

  /** 商业街区：连排低层 + 雨棚 */
  street(x, y, w, h) {
    const { px, py } = frame(x, y, w, h);
    const parts = [
      { d: rect(px(-0.5), py(0.45), px(0.5), py(0.52)), fill: "#cfcec8", stroke: "#b4b3ad" },
      { d: rect(px(-0.48), py(0.05), px(-0.18), py(0.45)), fill: "#d8c8ac", stroke: "#bda98a" },
      { d: rect(px(-0.14), py(0.16), px(0.16), py(0.45)), fill: "#c8b39a", stroke: "#ac9880" },
      { d: rect(px(0.2), py(0), px(0.48), py(0.45)), fill: "#d5c3a4", stroke: "#bda98a" },
      { d: rect(px(-0.48), py(0.52), px(-0.18), py(0.6)), fill: "#b2464a" },
      { d: rect(px(-0.14), py(0.52), px(0.16), py(0.6)), fill: "#3f7a6a" },
      { d: rect(px(0.2), py(0.52), px(0.48), py(0.6)), fill: "#b7873a" },
    ];
    const lights = [-0.33, 0.01, 0.34].map((lx) => ({ x: px(lx), y: py(0.24), r: 1.6 }));
    return { parts, lights };
  },

  /** 食肆：单层小铺 + 招牌 + 灯笼 */
  shop(x, y, w, h) {
    const { px, py } = frame(x, y, w, h);
    const parts = [
      { d: rect(px(-0.5), py(0.34), px(0.5), py(0.4)), fill: "#8d5a3c", stroke: "#6f4530" },
      { d: rect(px(-0.42), py(0), px(0.42), py(0.34)), fill: "#e0cba6", stroke: "#c2aa84" },
      { d: rect(px(-0.5), py(0.4), px(0.5), py(0.52)), fill: "#c25a3a", stroke: "#a0472c" },
      { d: rect(px(-0.14), py(0.5), px(0.14), py(0.72)), fill: "#f4e6c8", stroke: "#cbb58c" },
      { d: rect(px(-0.44), py(0.56), px(-0.3), py(0.8)), fill: "#d8433a" },
      { d: rect(px(0.3), py(0.56), px(0.44), py(0.8)), fill: "#d8433a" },
    ];
    const lights = [
      { x: px(0), y: py(0.14), r: 2 },
      { x: px(-0.37), y: py(0.64), r: 1.8 },
      { x: px(0.37), y: py(0.64), r: 1.8 },
    ];
    return { parts, lights };
  },

  /** 通用：保底的三面体方块（保留原来的立体感） */
  generic(x, y, w, h) {
    const d = w * 0.45;
    const parts = [
      { d: poly([x - w / 2, y], [x + w / 2, y], [x + w / 2, y - h], [x - w / 2, y - h]), fill: "#a9c3de", stroke: "#87a4c4" },
      { d: poly([x + w / 2, y], [x + w / 2 + d, y - d * 0.6], [x + w / 2 + d, y - h - d * 0.6], [x + w / 2, y - h]), fill: "#5d86bd", stroke: "#4a6f9f" },
      { d: poly([x - w / 2, y - h], [x + w / 2, y - h], [x + w / 2 + d, y - h - d * 0.6], [x - w / 2 + d, y - h - d * 0.6]), fill: "#c3dcf7", stroke: "#93b6e0" },
    ];
    const lights = [];
    const rows = Math.max(1, Math.min(4, Math.floor(h / 12)));
    for (let r = 0; r < rows; r++) {
      const ly = y - 6 - (r * (h - 10)) / rows;
      lights.push({ x: x - w * 0.22, y: ly, r: 1.7 }, { x: x + w * 0.22, y: ly, r: 1.7 });
    }
    return { parts, lights };
  },
};

/**
 * 生成某个形制的绘制数据
 * @returns {{ parts: {d:string, fill:string, stroke?:string, sw?:number}[], lights: {x:number,y:number,r:number}[] }}
 */
export function buildBuildingShape(shape, x, y, w, h) {
  const fn = BUILDERS[shape] || BUILDERS.generic;
  return fn(x, y, w, h);
}

export const SHAPE_NAMES = {
  pagoda: "塔", pavilion: "楼阁", palace: "宫殿", dome: "穹顶", tvtower: "电视塔",
  skyscraper: "摩天楼", buddha: "大佛", bridge: "桥", museum: "博物馆", gate: "城楼",
  stupa: "白塔", stadium: "体育场", altar: "祭坛", monument: "纪念碑",
  street: "商业街", shop: "食肆", generic: "建筑",
};
