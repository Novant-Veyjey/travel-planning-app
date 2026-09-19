/**
 * AI 服务模块
 * 调用 DeepSeek 大模型，根据输入+天气+POI 生成 3 条路线（对应 M2）
 */
import "dotenv/config";
import { getCityFeature, buildCityPoiPool } from "./cityFeature.js";
import { getTransportOptions, planCityTraffic } from "./transport.js";

const API_KEY = process.env.DEEPSEEK_API_KEY || "";
const BASE_URL = process.env.AI_BASE_URL || "https://api.deepseek.com";
const MODEL = process.env.AI_MODEL || "deepseek-v4-flash";

/**
 * 生成 3 条路线
 * @param {Object} input 用户输入 {出发地,目的地,游玩天数,精力状态,偏好}
 * @returns {Promise<Object>} { routes: [...] }
 */
export async function generateRoutes(input) {
  // 城际真实耗时：与路线生成并行发起（总耗时取两者较大值，不叠加）
  const aiTimesPromise = queryTransportTimes(input.出发地, input.目的地);

  if (!API_KEY) {
    // 无 Key 时返回模拟数据，保证框架可运行（同样走真实距离校准，不再用固定公式）
    const mocked = normalizeTraffic(mockRoutes(input), input.目的地);
    return applyIntercityTransport(mocked, input.出发地, input.目的地, await aiTimesPromise);
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
      normalizeTraffic(data, input.目的地);
      return applyIntercityTransport(data, input.出发地, input.目的地, await aiTimesPromise);
    }
  } catch (e) {
    console.error("[AI] 生成失败，降级为模拟数据:", e.message);
  }
  const mocked = normalizeTraffic(mockRoutes(input), input.目的地);
  return applyIntercityTransport(mocked, input.出发地, input.目的地, await aiTimesPromise);
}

/**
 * 交通耗时真实化校准：
 * 用著名景点真实经纬度计算每段实际路程，再套市内交通速度模型
 * （步行 4.5km/h、骑行 13、公交 16+8min、地铁 35+14min 进出站、打车 28+5min）
 * 重算耗时；AI/模板编造的方式若不适用或明显偏慢，按真实距离改推。
 */
function normalizeTraffic(data, city) {
  const base = city || "目的地";
  data.routes?.forEach((r) =>
    r.每日行程?.forEach((day) => {
      const pois = day.打卡点 || [];
      pois.forEach((p, i) => {
        if (!p.交通) p.交通 = {};
        // 首站从市中心酒店出发（取城市中心坐标），其余从上一个打卡点出发
        const from = i === 0 ? `${base}市中心酒店` : pois[i - 1].名称;
        const plan = planCityTraffic(base, from, p.名称, p.交通.推荐方式);
        if (!plan) {
          // 该城市无坐标数据：至少保证字段可用，不做编造
          if (!p.交通.推荐方式) p.交通.推荐方式 = "打车";
          if (!p.交通.耗时) p.交通.耗时 = "约20分钟";
          return;
        }
        const changed = plan.方式 !== p.交通.推荐方式;
        p.交通.推荐方式 = plan.方式;
        p.交通.耗时 = `约${plan.mins}分钟`;
        p.交通.里程 = `${plan.km}公里`;
        p.交通.推荐理由 = changed
          ? `两地实际路程约${plan.km}公里，${plan.方式}最快，约${plan.mins}分钟`
          : `${p.交通.推荐理由 || "便捷直达"}，全程约${plan.km}公里`;
        if (!Array.isArray(p.交通.替代方式) || !p.交通.替代方式.length) {
          p.交通.替代方式 = plan.替代方式;
        }
      });
    })
  );
  return data;
}

/** 给 Promise 加超时（Promise.race 实现，兼容任意异步源） */
function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

const AI_TIMEOUT_MS = 6000; // 路线生成超时，超时快速降级为模拟数据
const AI_QUERY_TIMEOUT_MS = 8000; // 交通耗时查询超时，超时回落本地真实时刻表

const ROUTE_SYSTEM =
  "你是资深旅游规划师。根据用户输入生成3条游玩路线：休闲/经典/特种兵。只输出JSON，格式：" +
  '{"routes":[{"路线名":"","适合人群":"","强度":"休闲|经典|特种兵","亮点":"",' +
  '"每日行程":[{"第几天":1,"天气":"","地形":"","民族特色":{"民族":"","特色建筑":[],"民族元素":[]},' +
  '"当地建筑":[],"打卡点":[{"名称":"","类型":"","推荐时间":"","交通":{"推荐方式":"","替代方式":[],"耗时":"","推荐理由":""},"注意事项":""}]}]}]}';

async function chat(prompt, { system = ROUTE_SYSTEM, temperature = 0.8, timeoutMs = AI_TIMEOUT_MS, maxTokens = null } = {}) {
  const url = `${BASE_URL}/chat/completions`;
  // 用 Promise.race 强制超时，兼容各 Node 版本，避免 AI 接口挂起导致页面长时间卡 loading
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const doFetch = fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature,
      stream: false,
      // 仅交通耗时这类结构化小查询才限制输出长度，加快响应
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    }),
    signal: controller.signal,
  });
  // 超时后强制结束等待
  const timeoutPromise = new Promise((_, rej) =>
    setTimeout(() => rej(new Error("AI请求超时")), timeoutMs)
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

/* ============ 城际交通真实耗时：接入 AI 查询，失败回落本地时刻表 ============ */
const transportCache = new Map(); // 同城对复用，避免每次生成都消耗一次 AI 请求

async function queryTransportTimes(from, to) {
  if (!API_KEY || !from || !to || from === to) return null;
  const key = `${from}-${to}`;
  if (transportCache.has(key)) return transportCache.get(key);

  const prompt =
    `请给出从【${from}】到【${to}】的实际出行耗时（含进出站/候机/机场往返等真实开销）。\n` +
    `只输出JSON，单位为小时的数字，没有或不推荐的交通方式填 null：\n` +
    `{"高铁":1.5,"飞机":null,"自驾":3.5}`;
  const system =
    "你是交通信息助手，只依据真实的高铁/航班/公路里程与运行时长作答，不要编造。只输出JSON。";

  let result = null;
  try {
    const content = await withTimeout(
      chat(prompt, { system, temperature: 0, timeoutMs: AI_QUERY_TIMEOUT_MS, maxTokens: 300 }),
      AI_QUERY_TIMEOUT_MS + 500,
      "交通耗时查询超时"
    );
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}") + 1;
    if (start >= 0 && end > start) {
      const obj = JSON.parse(content.slice(start, end));
      const picked = {};
      for (const mode of ["高铁", "飞机", "自驾"]) {
        const v = obj?.[mode];
        picked[mode] =
          typeof v === "number" && isFinite(v) && v > 0 && v <= 30 ? Math.round(v * 10) / 10 : null;
      }
      if (Object.values(picked).some((v) => v !== null)) {
        result = picked;
      } else {
        console.warn("[AI] 交通耗时返回无可用量，回落本地时刻表");
      }
    } else {
      console.warn("[AI] 交通耗时返回非JSON，回落本地时刻表");
    }
  } catch (e) {
    console.error("[AI] 交通耗时查询失败，回落本地时刻表:", e.message);
  }
  // 只缓存成功结果：失败（超时/解析不出）下次仍可重试
  if (result) transportCache.set(key, result);
  return result;
}

// 用 AI 实时耗时（或本地真实时刻表）重建每条路线的城际交通方案
function applyIntercityTransport(data, from, to, aiTimes) {
  const options = getTransportOptions(from, to, aiTimes);
  const 来源 = options[0]?.来源 || "真实时刻表·距离估算";
  data.routes = (data.routes || []).map((r) => ({ ...r, 全程交通: options, 全程交通来源: 来源 }));
  return data;
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

  // 不重复的景点池：与 POI 接口共用同一份生成逻辑（当地建筑/地形/特色）
  const pool = buildCityPoiPool(base).map((p) => ({ name: p.名称, type: p.类型 }));

  // 每条路线根据强度生成不同的日程（观景点/节奏/强度都不同）
  const STYLE_CONF = {
    休闲: {
      路线名: `${base}·休闲路线`,
      适合人群: "亲子/老人",
      亮点: "节奏轻松、慢游为主，每天只去精挑的2-3个点，留足休息时间",
      每日打卡点: [2, 3, 2, 3], // 每天打卡点数量（按天循环）
      地形: ["平原", "湖畔", "园林", "古镇"],
      强度词: "宽松",
    },
    经典: {
      路线名: `${base}·经典路线`,
      适合人群: "大多数游客",
      亮点: "覆盖核心景点与当地特色，节奏适中",
      每日打卡点: [3, 4, 3, 4],
      地形: ["城区", "名胜", "街区", "自然"],
      强度词: "适中",
    },
    特种兵: {
      路线名: `${base}·特种兵路线`,
      适合人群: "体力好的人",
      亮点: "全天高效暴走，每天塞满6个打卡点，打卡密度拉满",
      每日打卡点: [5, 6, 5, 6],
      地形: ["都市", "山野", "江河", "环城"],
      强度词: "高",
    },
  };

  const makeDaily = (strength) => {
    const conf = STYLE_CONF[strength] || STYLE_CONF["经典"];
    const daily = [];
    let cursor = 0; // 每条路线独立的景点游标，保证本路线不重复
    for (let d = 1; d <= days; d++) {
      const pois = [];
      const slots = conf.每日打卡点[(d - 1) % conf.每日打卡点.length] || 3;
      // 休闲路线结束早（18点前），特种兵到晚上（22点）
      const startHour = strength === "特种兵" ? 7 : 9;
      for (let k = 0; k < slots; k++) {
        const p = pool[cursor % pool.length];
        cursor++;
        const h = startHour + k * 2.5;
        const hh = Math.floor(h);
        const mm = Math.round((h - hh) * 60);
        pois.push({
          名称: p.name,
          类型: p.type,
          推荐时间: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}-${String(hh + 2).padStart(2, "0")}:00`,
          // 交通字段留空，由 normalizeTraffic 按真实景点坐标+速度模型填充
          交通: {
            推荐方式: "",
            替代方式: [],
            耗时: "",
            推荐理由: "避开高峰，直达便捷",
          },
          注意事项: strength === "特种兵" ? "需预留排队时间" : "建议提前线上预约",
        });
      }
      daily.push({
        第几天: d,
        天气: "晴 " + (22 + d % 5) + "°C",
        地形: conf.地形[(d - 1) % conf.地形.length],
        民族特色: { 民族: "当地民族", 特色建筑: 建筑.slice(0, 2), 民族元素: 元素.slice(0, 2) },
        当地建筑: 建筑.slice(0, 3) || [],
        打卡点: pois,
      });
    }
    return daily;
  };

  const styles = ["休闲", "经典", "特种兵"];
  // 全程交通耗时：根据出发地→目的地查真实城市对耗时表
  const 全程交通 = getTransportOptions(input.出发地, base);
  return {
    routes: styles.map((strength) => ({
      ...STYLE_CONF[strength],
      强度: strength,
      全程交通,
      每日行程: makeDaily(strength),
    })),
  };
}
