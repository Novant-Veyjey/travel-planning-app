const pptxgen = require("pptxgenjs");

// ===== 配色方案：Ocean Travel（贴合旅游/地图主题）=====
const C = {
  primary: "065A82",      // 深青
  secondary: "1C7293",    // 青绿
  accent: "F96167",       // 珊瑚
  midnight: "21295C",     // 午夜蓝
  bg: "F5F7FA",           // 浅背景
  card: "FFFFFF",         // 卡片白
  text: "1F2937",         // 深灰文字
  muted: "6B7280",        // 次要文字
  line: "E5E7EB",         // 分隔线
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.3 x 7.5
pres.author = "软件工程技术2025级";
pres.title = "卡通地图旅游计划生成 App 实习报告";

const W = 13.3;
const H = 7.5;

// ===== 辅助函数 =====
function addHeader(slide, num, title) {
  // 顶部标题栏
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: W, h: 0.12, fill: { color: C.primary },
  });
  slide.addText(num, {
    x: 0.55, y: 0.5, w: 0.9, h: 0.7, fontSize: 22, bold: true,
    color: C.accent, align: "center", valign: "middle",
    margin: 0, charSpacing: 2,
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 1.35, y: 0.68, w: 0.04, h: 0.36, fill: { color: C.accent },
  });
  slide.addText(title, {
    x: 1.5, y: 0.5, w: 11, h: 0.6, fontSize: 26, bold: true,
    color: C.text, valign: "middle", margin: 0,
  });
}

// ===== 第 1 页：封面 =====
{
  const s = pres.addSlide();
  s.background = { color: C.primary };
  // 顶部装饰圆
  s.addShape(pres.shapes.OVAL, { x: -1.5, y: -1.8, w: 4, h: 4, fill: { color: C.secondary, transparency: 40 } });
  s.addShape(pres.shapes.OVAL, { x: 11.2, y: 4.8, w: 4, h: 4, fill: { color: C.midnight, transparency: 30 } });

  s.addText("软件工程技术专业 · 2025 级实习报告", {
    x: 1.5, y: 1.0, w: 10.3, h: 0.5, fontSize: 15, color: "CFE4F0", align: "center",
  });
  s.addText("卡通地图旅游计划\n生成 App", {
    x: 1.5, y: 2.0, w: 10.3, h: 2.2, fontSize: 48, bold: true,
    color: "FFFFFF", align: "center", valign: "middle", charSpacing: 3,
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.4, y: 4.35, w: 2.5, h: 0.06, fill: { color: C.accent },
  });
  s.addText("需求分析 · 后端开发 · 前端部署 · 云上上线", {
    x: 1.5, y: 4.7, w: 10.3, h: 0.5, fontSize: 15, color: "AED2E6", align: "center",
  });
  s.addText("Node.js · Express · SQLite · DeepSeek AI · Vue3 · Vite", {
    x: 1.5, y: 5.3, w: 10.3, h: 0.5, fontSize: 13, color: "7FB3D0", align: "center",
  });
  s.addText("学生：王怡健", {
    x: 1.5, y: 6.4, w: 10.3, h: 0.5, fontSize: 14, color: "AED2E6", align: "center",
  });
}

// ===== 第 2 页：自我介绍 =====
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addHeader(s, "1.1", "自我介绍");

  // 个人信息卡片
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.6, y: 1.5, w: 5.6, h: 4.9, fill: { color: C.card },
    rectRadius: 0.08, shadow: { type: "outer", blur: 6, offset: 2, angle: 135, color: "000000", opacity: 0.1 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 1.5, w: 0.1, h: 4.9, fill: { color: C.primary },
  });
  const bioText = [
    { text: "专业背景", options: { bold: true, color: C.primary, fontSize: 16, breakLine: true, paraSpaceAfter: 8 } },
    { text: "软件工程技术专业 2025 级学生，实训前只学过 C 语言、数据结构和 Java 基础以及 Web 前端基础，没有接触过后端开发，对 Vue.js、Node.js 等主流技术栈基本陌生。", options: { color: C.text, fontSize: 14, breakLine: true, paraSpaceAfter: 12 } },
    { text: "参加实训初衷", options: { bold: true, color: C.primary, fontSize: 16, breakLine: true, paraSpaceAfter: 8 } },
    { text: "希望体验一个真实项目的完整流程——从需求分析到开发再到部署上线，而不是停留在课本上的零散知识点。", options: { color: C.text, fontSize: 14, breakLine: true, paraSpaceAfter: 12 } },
    { text: "自我定位", options: { bold: true, color: C.primary, fontSize: 16, breakLine: true, paraSpaceAfter: 8 } },
    { text: "“会写一点代码、但没做过完整产品”的学习者，希望通过一个完整项目补齐“需求→设计→开发→部署”这条完整链路的能力。", options: { color: C.text, fontSize: 14 } },
  ];
  s.addText(bioText, {
    x: 0.95, y: 1.8, w: 5.0, h: 4.3, valign: "top", lineSpacingMultiple: 1.1,
  });

  // 右侧能力标签
  s.addText("技术基础", { x: 6.6, y: 1.6, w: 5.9, h: 0.5, fontSize: 18, bold: true, color: C.primary, margin: 0 });
  const skills = [
    { name: "C 语言 / 数据结构", lvl: 70 },
    { name: "Java 基础", lvl: 60 },
    { name: "Web 前端基础", lvl: 55 },
    { name: "Vue.js / Node.js", lvl: 25 },
    { name: "后端开发经验", lvl: 15 },
  ];
  let sy = 2.3;
  for (const sk of skills) {
    s.addText(sk.name, { x: 6.6, y: sy, w: 3.5, h: 0.4, fontSize: 13, color: C.text, valign: "middle", margin: 0 });
    s.addShape(pres.shapes.RECTANGLE, { x: 10.2, y: sy + 0.06, w: 2.3, h: 0.3, fill: { color: C.line } });
    s.addShape(pres.shapes.RECTANGLE, { x: 10.2, y: sy + 0.06, w: 2.3 * (sk.lvl / 100), h: 0.3, fill: { color: sk.lvl >= 60 ? C.secondary : C.accent } });
    sy += 0.62;
  }
  s.addText("实训目标", { x: 6.6, y: 5.3, w: 5.9, h: 0.5, fontSize: 16, bold: true, color: C.accent, margin: 0 });
  s.addText("补齐“需求→设计→开发→部署”完整链路能力", { x: 6.6, y: 5.9, w: 5.9, h: 0.5, fontSize: 14, color: C.text, margin: 0 });
}

// ===== 第 3 页：阶段一 需求分析与拆解 =====
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addHeader(s, "1.2", "阶段一：产品需求分析与拆解");

  const blocks = [
    { icon: "📋", title: "接触内容", desc: "产品需求分析方法论：四层需求分析、用户故事（User Story）、MoSCoW 优先级划分，据此撰写项目 PRD 和功能模块拆解表。" },
    { icon: "🧠", title: "学到的知识", desc: "第一次明白“写代码之前要先想清楚做什么”。学会把模糊想法拆成具体功能模块（M2 路线生成、M9 交通推荐等），标注依赖关系与验收标准。" },
    { icon: "🔧", title: "项目中的运用", desc: "PRD 确认 3 条路线（休闲/经典/特种兵）与“天气场景化呈现”两个核心决策，决定前后端数据结构设计；拆解表成为安排开发顺序的依据。" },
  ];
  let y = 1.55;
  blocks.forEach((b, i) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.6, y: y, w: 12.1, h: 1.25, fill: { color: C.card },
      rectRadius: 0.06, shadow: { type: "outer", blur: 5, offset: 1.5, angle: 135, color: "000000", opacity: 0.08 },
    });
    s.addText(b.icon, { x: 0.9, y: y + 0.12, w: 0.8, h: 0.8, fontSize: 30, align: "center", valign: "middle" });
    s.addText(b.title, { x: 1.85, y: y + 0.12, w: 2.2, h: 0.5, fontSize: 16, bold: true, color: C.primary, valign: "middle", margin: 0 });
    s.addText(b.desc, { x: 1.85, y: y + 0.55, w: 10.4, h: 0.62, fontSize: 13, color: C.text, valign: "middle", lineSpacingMultiple: 1.05, margin: 0 });
    y += 1.4;
  });

  // 难点解决卡片
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.6, y: y, w: 12.1, h: 0.85, fill: { color: "FFF3F3" },
    rectRadius: 0.06,
  });
  s.addText([
    { text: "💡 难点与解决：", options: { bold: true, color: C.accent, fontSize: 14 } },
    { text: "一开始不知道需求分析该写到什么程度，容易写成“功能列表”。通过反复问“这个功能给用户解决了什么问题”，把每个功能对应到用户故事上，才把 PRD 写得可执行。", options: { color: C.text, fontSize: 13 } },
  ], { x: 0.9, y: y + 0.08, w: 11.5, h: 0.7, valign: "middle", lineSpacingMultiple: 1.05, margin: 0 });
}

// ===== 第 4 页：阶段二 后端开发 =====
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addHeader(s, "1.2", "阶段二：后端开发（Node.js + Express + SQLite + DeepSeek AI）");

  // 技术栈
  s.addText("技术栈", { x: 0.6, y: 1.5, w: 12.1, h: 0.5, fontSize: 16, bold: true, color: C.primary, margin: 0 });
  const techs = ["Express 后端", "REST API", "SQLite 持久化", "DeepSeek 大模型"];
  let tx = 0.6;
  techs.forEach((t) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: tx, y: 2.05, w: 2.8, h: 0.5, fill: { color: C.secondary }, rectRadius: 0.25 });
    s.addText(t, { x: tx, y: 2.05, w: 2.8, h: 0.5, fontSize: 13, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    tx += 3.0;
  });

  const blocks = [
    { title: "学到的知识点", desc: "API 设计（路由拆分、请求/响应结构约定、健康检查接口）；数据持久化（刷新不丢数据）；调用大模型（构造 system/user 提示词，约束 AI 只输出 JSON）；降级容错（AI 失败时用模拟数据兜底）。" },
    { title: "项目中的运用", desc: "AI 生成路线必须符合前端字段结构，在提示词里写死 JSON 格式，并用“截取首尾大括号再 JSON.parse”的方式解析，避免 AI 输出多余文字导致解析失败。" },
  ];
  let y = 2.85;
  blocks.forEach((b) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.6, y: y, w: 12.1, h: 1.4, fill: { color: C.card },
      rectRadius: 0.06, shadow: { type: "outer", blur: 5, offset: 1.5, angle: 135, color: "000000", opacity: 0.08 },
    });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: y, w: 0.1, h: 1.4, fill: { color: C.secondary } });
    s.addText(b.title, { x: 0.9, y: y + 0.12, w: 11.4, h: 0.5, fontSize: 15, bold: true, color: C.primary, valign: "middle", margin: 0 });
    s.addText(b.desc, { x: 0.9, y: y + 0.6, w: 11.4, h: 0.7, fontSize: 13, color: C.text, valign: "top", lineSpacingMultiple: 1.1, margin: 0 });
    y += 1.55;
  });

  // 难点解决
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.6, y: y, w: 12.1, h: 1.0, fill: { color: "FFF3F3" }, rectRadius: 0.06,
  });
  s.addText([
    { text: "💡 最大难点：", options: { bold: true, color: C.accent, fontSize: 14 } },
    { text: "AI 返回内容不稳定——偶尔输出带说明文字的 JSON，导致解析报错、页面一直 loading。通过“Promise.race 强制 6 秒超时 + 解析失败自动降级为模拟数据”解决：宁可返回模拟路线，也不让用户卡在空白页。", options: { color: C.text, fontSize: 13 } },
  ], { x: 0.9, y: y + 0.1, w: 11.5, h: 0.8, valign: "middle", lineSpacingMultiple: 1.05, margin: 0 });
}

// ===== 第 5 页：阶段三 前端与部署 =====
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addHeader(s, "1.2", "阶段三：前端开发与部署上线（Vue3 + 卡通地图 + 云部署）");

  const items = [
    { t: "Vue3 + Vite", d: "首页输入、路线选择、卡通地图三页，组件化开发" },
    { t: "Vue Router", d: "页面路由 + 前后端通过 fetch/axios 联调" },
    { t: "SPA 部署", d: "后端托管 web/dist，SPA 路由回退，刷新任意页面不 404" },
    { t: "缓存策略", d: "HTML 不缓存、带 hash 的静态资源长期缓存" },
    { t: "环境变量", d: "API Key 等敏感信息放 .env，不进版本库" },
  ];
  let y = 1.55;
  items.forEach((it, i) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.6, y: y, w: 12.1, h: 0.78, fill: { color: C.card },
      rectRadius: 0.05, shadow: { type: "outer", blur: 4, offset: 1, angle: 135, color: "000000", opacity: 0.06 },
    });
    s.addShape(pres.shapes.OVAL, { x: 0.85, y: y + 0.15, w: 0.48, h: 0.48, fill: { color: C.secondary } });
    s.addText(String(i + 1), { x: 0.85, y: y + 0.15, w: 0.48, h: 0.48, fontSize: 15, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    s.addText(it.t, { x: 1.55, y: y + 0.08, w: 2.3, h: 0.5, fontSize: 14, bold: true, color: C.primary, valign: "middle", margin: 0 });
    s.addText(it.d, { x: 3.95, y: y + 0.08, w: 8.4, h: 0.5, fontSize: 13, color: C.text, valign: "middle", margin: 0 });
    y += 0.92;
  });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.6, y: y, w: 12.1, h: 0.85, fill: { color: "FFF3F3" }, rectRadius: 0.06,
  });
  s.addText([
    { text: "💡 部署难点：", options: { bold: true, color: C.accent, fontSize: 14 } },
    { text: "如何给别人一个点开就能用的链接。尝试云沙箱与 Render 等平台，遇到上传体积超限、平台要求绑定信用卡等阻碍，最终通过精简部署目录、调整 render.yaml 一键构建解决。", options: { color: C.text, fontSize: 13 } },
  ], { x: 0.9, y: y + 0.08, w: 11.5, h: 0.7, valign: "middle", lineSpacingMultiple: 1.05, margin: 0 });
}

// ===== 第 6 页：学习方法分享 =====
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addHeader(s, "1.3", "学习方法分享");

  const blocks = [
    { icon: "📚", title: "最有效渠道", desc: "官方文档 + 实际报错信息。先查官方文档确认用法，再写最小示例验证；遇到报错优先看日志定位，而非凭感觉改代码。" },
    { icon: "🔍", title: "排查路径", desc: "打印后端日志定位问题。例如 AI 返回解析失败，通过日志发现是 AI 输出带了额外文字，从而针对性加容错处理。" },
    { icon: "📝", title: "笔记方式", desc: "按“问题→原因→解决”记录，卡了很久的坑单独记下方便复盘。" },
    { icon: "🤝", title: "团队协作", desc: "阶段性成果整理成简短说明同步给同伴，遇到分歧用“可运行的演示”说话，比口头争论更高效。" },
  ];
  let bx = 0.6, by = 1.55;
  blocks.forEach((b, i) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: bx, y: by, w: 5.95, h: 1.9, fill: { color: C.card },
      rectRadius: 0.06, shadow: { type: "outer", blur: 5, offset: 1.5, angle: 135, color: "000000", opacity: 0.08 },
    });
    s.addShape(pres.shapes.OVAL, { x: bx + 0.25, y: by + 0.25, w: 0.7, h: 0.7, fill: { color: C.primary } });
    s.addText(b.icon, { x: bx + 0.25, y: by + 0.25, w: 0.7, h: 0.7, fontSize: 26, align: "center", valign: "middle" });
    s.addText(b.title, { x: bx + 1.1, y: by + 0.22, w: 4.6, h: 0.5, fontSize: 16, bold: true, color: C.primary, valign: "middle", margin: 0 });
    s.addText(b.desc, { x: bx + 1.1, y: by + 0.7, w: 4.6, h: 1.05, fontSize: 12.5, color: C.text, valign: "top", lineSpacingMultiple: 1.1, margin: 0 });
    if (i % 2 === 0) { bx = 6.7; } else { bx = 0.6; by += 2.1; }
  });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.6, y: by, w: 12.1, h: 1.0, fill: { color: "EAF3FB" }, rectRadius: 0.06,
  });
  s.addText([
    { text: "📉 放弃的方法：", options: { bold: true, color: C.primary, fontSize: 14 } },
    { text: "曾尝试看长视频教程，但信息密度低、容易走神，后来改为“需要什么查什么”的按需学习，效率明显更高。", options: { color: C.text, fontSize: 13 } },
  ], { x: 0.9, y: by + 0.12, w: 11.5, h: 0.75, valign: "middle", lineSpacingMultiple: 1.05, margin: 0 });
}

// ===== 第 7 页：实习收获与感受 =====
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addHeader(s, "1.4", "实习收获与感受");

  const blocks = [
    { tag: "专业 / 知识", color: C.primary, points: [
      "实训前以为开发就是“把界面写出来”，实际才明白一个可用产品背后是需求分析、数据结构设计、接口约定、容错降级、部署运维一整套工作。",
      "“真实项目”的想象从“写代码”扩展为“解决用户问题”。",
      "AI 路线生成让我第一次真切体会到“大模型如何嵌入业务”——要设计提示词、约定输出格式、做超时与降级处理，比想象中复杂得多。",
    ]},
    { tag: "职业素养", color: C.secondary, points: [
      "最深的体会是“让应用一直可用”的责任意识。",
      "具体小事：AI 接口偶尔不稳定，直接报错用户看到的就是空白页。花了不少时间做超时和降级方案，那一刻意识到开发不能只保证“正常路径能跑”，还要考虑“异常路径用户会看到什么”。",
    ]},
    { tag: "自我认知", color: C.accent, points: [
      "优势：动手能力强、遇到问题愿意钻研。",
      "短板：前期容易直接动手写代码，需求理解不透就开工，返工较多。",
      "计划：每周阅读一篇技术/产品文章，刻意练习“先写清需求再动手”，并继续完善本项目作为作品集。",
    ]},
  ];
  let y = 1.5;
  blocks.forEach((b) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.6, y: y, w: 12.1, h: 1.6, fill: { color: C.card },
      rectRadius: 0.06, shadow: { type: "outer", blur: 5, offset: 1.5, angle: 135, color: "000000", opacity: 0.08 },
    });
    s.addShape(pres.shapes.OVAL, { x: 0.85, y: y + 0.2, w: 0.85, h: 0.85, fill: { color: b.color } });
    s.addText(b.tag.split("/")[0], { x: 0.85, y: y + 0.2, w: 0.85, h: 0.42, fontSize: 12, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    s.addText(b.tag.split("/")[1], { x: 0.85, y: y + 0.62, w: 0.85, h: 0.42, fontSize: 12, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    const bullets = b.points.map((p, i) => ({ text: p, options: { bullet: true, color: C.text, fontSize: 12.5, breakLine: i < b.points.length - 1, paraSpaceAfter: 4, indentLevel: 0 } }));
    s.addText(bullets, { x: 1.95, y: y + 0.12, w: 10.5, h: 1.36, valign: "middle", lineSpacingMultiple: 1.05, margin: 0 });
    y += 1.75;
  });
}

// ===== 第 8 页：反馈与建议 =====
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addHeader(s, "1.5", "项目实习反馈与建议");

  s.addText("整体评价", { x: 0.6, y: 1.5, w: 12.1, h: 0.5, fontSize: 17, bold: true, color: C.primary, margin: 0 });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.6, y: 2.05, w: 12.1, h: 1.1, fill: { color: C.card },
    rectRadius: 0.06, shadow: { type: "outer", blur: 5, offset: 1.5, angle: 135, color: "000000", opacity: 0.08 },
  });
  s.addText("本次实训项目难度适中偏挑战，业务场景真实（旅游规划是常见需求），从需求分析到上线的完整流程让我收获很大。", {
    x: 0.9, y: 2.15, w: 11.5, h: 0.9, fontSize: 15, color: C.text, valign: "middle", lineSpacingMultiple: 1.1, margin: 0,
  });

  s.addText("建设性建议", { x: 0.6, y: 3.35, w: 12.1, h: 0.5, fontSize: 17, bold: true, color: C.primary, margin: 0 });
  const sug = [
    { t: "① 脚手架 + 报错清单", d: "提前提供“项目脚手架 + 常见报错排查清单”，减少前期环境搭建的挫败感。" },
    { t: "② 明确小组分工", d: "小组分工可以更明确，避免部分模块多人重复做、部分模块没人管。" },
    { t: "③ 部署方案对比", d: "部署环节受外部平台限制较多（如绑定信用卡），建议提前给出可选的免费部署方案对比。" },
  ];
  let y = 3.9;
  sug.forEach((s2) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.6, y: y, w: 12.1, h: 0.85, fill: { color: C.card },
      rectRadius: 0.05, shadow: { type: "outer", blur: 4, offset: 1, angle: 135, color: "000000", opacity: 0.06 },
    });
    s.addText(s2.t, { x: 0.9, y: y + 0.1, w: 3.3, h: 0.5, fontSize: 14, bold: true, color: C.accent, valign: "middle", margin: 0 });
    s.addText(s2.d, { x: 4.3, y: y + 0.1, w: 8.1, h: 0.5, fontSize: 12.5, color: C.text, valign: "middle", lineSpacingMultiple: 1.0, margin: 0 });
    y += 0.95;
  });

  // 给下一期同学的建议
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.6, y: y + 0.05, w: 12.1, h: 0.85, fill: { color: "EAF3FB" }, rectRadius: 0.06,
  });
  s.addText([
    { text: "💬 给下一期同学：", options: { bold: true, color: C.primary, fontSize: 14 } },
    { text: "不要等“准备充分”再动手，先跑通一个最小可用的版本，再逐步完善，你会发现大部分问题都是在运行中暴露出来的。", options: { color: C.text, fontSize: 13 } },
  ], { x: 0.9, y: y + 0.1, w: 11.5, h: 0.7, valign: "middle", lineSpacingMultiple: 1.05, margin: 0 });
}

// ===== 第 9 页：附录 - 项目成果截图 =====
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addHeader(s, "1.6", "附录：项目成果展示");

  const shots = [
    { path: "screenshots/home.png", cap: "① 首页输入", x: 0.6, y: 1.55 },
    { path: "screenshots/routes.png", cap: "② 路线选择", x: 4.75, y: 1.55 },
    { path: "screenshots/map.png", cap: "③ 卡通地图导航", x: 8.9, y: 1.55 },
  ];
  shots.forEach((im) => {
    s.addImage({ path: im.path, x: im.x, y: im.y, w: 3.95, h: 2.97, sizing: { type: "contain", w: 3.95, h: 2.97 } });
    s.addText(im.cap, { x: im.x, y: im.y + 3.0, w: 3.95, h: 0.4, fontSize: 13, bold: true, color: C.primary, align: "center", valign: "middle", margin: 0 });
  });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.6, y: 5.0, w: 12.1, h: 1.7, fill: { color: C.card },
    rectRadius: 0.06, shadow: { type: "outer", blur: 5, offset: 1.5, angle: 135, color: "000000", opacity: 0.08 },
  });
  const links = [
    { t: "项目代码仓库", v: "https://github.com/Novant-Veyjey/travel-planning-app" },
    { t: "文档资料", v: "README / PRD / 功能模块拆解表见仓库 docs 目录" },
    { t: "在线部署链接", v: "CloudStudio 预览沙箱（可重新部署生成）" },
  ];
  let ly = 5.15;
  links.forEach((lk) => {
    s.addText(lk.t, { x: 0.9, y: ly, w: 2.2, h: 0.42, fontSize: 13, bold: true, color: C.primary, valign: "middle", margin: 0 });
    s.addText(lk.v, { x: 3.2, y: ly, w: 9.2, h: 0.42, fontSize: 12.5, color: C.text, valign: "middle", margin: 0 });
    ly += 0.48;
  });
}

pres.writeFile({ fileName: "travel_planner_report.pptx" }).then(() => {
  console.log("PPT 生成完成");
}).catch((e) => console.error("PPT 生成失败:", e));
