/**
 * AI 服务模块
 * 调用 DeepSeek 大模型，根据输入+天气+POI 生成 3 条路线（对应 M2）
 */
import "dotenv/config";
import { getCityFeature } from "./cityFeature.js";
import { getTransportOptions } from "./transport.js";

const API_KEY = process.env.DEEPSEEK_API_KEY || "";
const BASE_URL = process.env.AI_BASE_URL || "https://api.deepseek.com";
const MODEL = process.env.AI_MODEL || "deepseek-v4-flash";

/**
 * 生成 3 条路线
 * @param {Object} input 用户输入 {出发地,目的地,游玩天数,精力状态,偏好}
 * @returns {Promise<Object>} { routes: [...] }
 */
export async function generateRoutes(input) {
  if (!API_KEY) {
    // 无 Key 时返回模拟数据，保证框架可运行
    return mockRoutes(input);
  }

  const prompt = buildPrompt(input);
  try {
    // 外层 Promise.race 强制整体超时，确保 AI 慢/挂起时快速降级
    const content = await withTimeout(
      chat(prompt),
      AI_TIMEOUT_MS,
      "AI请求超时"
    );
    const data = parseRoutes(content);
    if (data.routes && data.routes.length > 0) {
      return data;
    }
  } catch (e) {
    console.error("[AI] 生成失败，降级为模拟数据:", e.message);
  }
  return mockRoutes(input);
}

/** 给 Promise 加超时（Promise.race 实现，兼容任意异步源） */
function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

const AI_TIMEOUT_MS = 6000; // AI 请求超时，超时快速降级为模拟数据

async function chat(prompt) {
  const url = `${BASE_URL}/chat/completions`;
  // 用 Promise.race 强制超时，兼容各 Node 版本，避免 AI 接口挂起导致页面长时间卡 loading
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  const doFetch = fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "你是资深旅游规划师。根据用户输入生成3条游玩路线：休闲/经典/特种兵。只输出JSON，格式：" +
            '{"routes":[{"路线名":"","适合人群":"","强度":"休闲|经典|特种兵","亮点":"",' +
            '"每日行程":[{"第几天":1,"天气":"","地形":"","民族特色":{"民族":"","特色建筑":[],"民族元素":[]},' +
            '"当地建筑":[],"打卡点":[{"名称":"","类型":"","推荐时间":"","交通":{"推荐方式":"","替代方式":[],"耗时":"","推荐理由":""},"注意事项":""}]}]}]}',
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      stream: false,
    }),
    signal: controller.signal,
  });
  // 超时后强制结束等待
  const timeoutPromise = new Promise((_, rej) =>
    setTimeout(() => rej(new Error("AI请求超时")), AI_TIMEOUT_MS)
  );
  const resp = await Promise.race([doFetch, timeoutPromise]).catch((e) => {
    clearTimeout(timer);
    throw new Error(e.message || "AI请求失败");
  });
  clearTimeout(timer);
  if (!resp.ok) {
    throw new Error(`AI请求失败: ${resp.status}`);
  }
  const data = await resp.json();
  return data.choices[0].message.content;
}

function buildPrompt(input) {
  return (
    `用户从【${input.出发地}】前往【${input.目的地}】，游玩${input.游玩天数}天，` +
    `精力状态：${input.精力状态}，偏好：${(input.偏好 || []).join("、")}。\n` +
    `请生成3条适合【${input.目的地}】的完整游玩路线，每条包含每日天气、地形、` +
    `当地民族特色、当地建筑，以及3-5个打卡点（含网红纪念馆、当地美食店、标志性景点），` +
    `每个打卡点给出推荐时间、推荐交通方式及理由。`
  );
}

function parseRoutes(content) {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}") + 1;
  if (start < 0 || end <= 0) throw new Error("无法解析AI返回");
  return JSON.parse(content.slice(start, end));
}

function mockRoutes(input) {
  const base = input.目的地 || "目的地";
  const days = Math.max(1, input.游玩天数 || 3);
  const feat = getCityFeature(base);

  // 生成足够多且不重复的打卡点池（用城市特色拼出真实感）
  const 建筑 = feat.特色建筑?.length ? feat.特色建筑 : [base + "地标"];
  const 地形 = feat.地形?.length ? feat.地形 : [base + "山水"];
  const 元素 = feat.特色元素?.length ? feat.特色元素 : [base + "美食街"];

  const TYPE_OF = {
    "标志性景点": "🏯",
    "自然风光": "⛰️",
    "美食打卡": "🍜",
    "人文历史": "🏛️",
    "休闲街区": "🛍️",
    "夜游": "🌙",
  };

  // 构造不重复的景点池（优先用真实特色，不足用派生景点补齐）
  const pool = [];
  const seen = new Set();
  const pushPoi = (name, type) => {
    if (!name || seen.has(name)) return;
    seen.add(name);
    pool.push({ name, type });
  };
  建筑.forEach((n) => pushPoi(n, "标志性景点"));
  地形.forEach((n) => pushPoi(n, "自然风光"));
  元素.forEach((n) => pushPoi(n, "美食打卡"));
  // 派生景点（保证天数多时也能凑够且不重复）
  ["人文博物馆", "老街", "夜市", "古城墙", "滨江公园", "艺术街区", "主题公园"].forEach((s, i) =>
    pushPoi(`${base}·${s}`, ["人文历史", "休闲街区", "夜游", "人文历史", "自然风光", "休闲街区", "标志性景点"][i])
  );

  // 按天分配，保证全行程不重复
  const daily = [];
  let cursor = 0;
  for (let d = 1; d <= days; d++) {
    const pois = [];
    const slots = d % 2 === 0 ? 3 : 4;
    for (let k = 0; k < slots; k++) {
      const p = pool[cursor % pool.length];
      cursor++;
      const hour = 9 + k * 3;
      pois.push({
        名称: p.name,
        类型: p.type,
        推荐时间: `${String(hour).padStart(2, "0")}:00-${String(hour + 2).padStart(2, "0")}:00`,
        交通: {
          推荐方式: k === 0 ? "地铁" : "打车",
          替代方式: ["公交", "步行"],
          耗时: `${15 + k * 10}min`,
          推荐理由: "避开高峰，直达便捷",
        },
        注意事项: "建议提前线上预约",
      });
    }
    daily.push({
      第几天: d,
      天气: "晴 " + (22 + d % 5) + "°C",
      地形: d === 1 ? "平原" : (d % 2 === 0 ? "山地" : "水乡"),
      民族特色: { 民族: "当地民族", 特色建筑: 建筑.slice(0, 2), 民族元素: 元素.slice(0, 2) },
      当地建筑: 建筑.slice(0, 3) || [],
      打卡点: pois,
    });
  }

  const styles = [
    { 路线名: `${base}·休闲路线`, 适合人群: "亲子/老人", 强度: "休闲", 亮点: "节奏轻松，慢游为主" },
    { 路线名: `${base}·经典路线`, 适合人群: "大多数游客", 强度: "经典", 亮点: "覆盖核心景点" },
    { 路线名: `${base}·特种兵路线`, 适合人群: "体力好的人", 强度: "特种兵", 亮点: "高效打卡，全天暴走" },
  ];
  // 全程交通耗时：根据出发地→目的地查真实城市对耗时表
  const 全程交通 = getTransportOptions(input.出发地, base);
  return {
    routes: styles.map((s) => ({
      ...s,
      全程交通,
      每日行程: daily.map((d) => ({ ...d, 打卡点: d.打卡点.map((p) => ({ ...p })) })),
    })),
  };
}
