<template>
  <!-- 人物建模：站在 (x, y) 地面点上的卡通人偶，服饰随当地民族传统服饰变化 -->
  <g :transform="`translate(${x},${y}) scale(${scale})`">
    <defs>
      <clipPath :id="clipId">
        <path :d="robePath" />
        <path v-if="isSkirt" :d="skirtPath" />
      </clipPath>
    </defs>

    <!-- 接地阴影 -->
    <ellipse cx="0" cy="0" rx="10.5" ry="3.6" class="fig-shadow" />

    <g class="fig-bob">
      <!-- 腿 -->
      <line x1="-3" y1="-9.4" x2="-3.4" y2="-1" :stroke="c.下装" stroke-width="3.4" stroke-linecap="round" />
      <line x1="3" y1="-9.4" x2="3.4" y2="-1" :stroke="c.下装" stroke-width="3.4" stroke-linecap="round" />
      <ellipse cx="-3.5" cy="-0.6" rx="2.7" ry="1.5" fill="#5b4632" />
      <ellipse cx="3.5" cy="-0.6" rx="2.7" ry="1.5" fill="#5b4632" />

      <!-- 手臂 + 袖口 + 手 -->
      <path d="M-6,-24.6 q-3.6,5.2 -3.2,10.2" :stroke="c.主色" stroke-width="3.9" fill="none" stroke-linecap="round" />
      <path d="M6,-24.6 q3.6,5.2 3.2,10.2" :stroke="c.主色" stroke-width="3.9" fill="none" stroke-linecap="round" />
      <circle cx="-9.2" cy="-14.4" r="2.2" :fill="c.边色" />
      <circle cx="9.2" cy="-14.4" r="2.2" :fill="c.边色" />
      <circle cx="-9.2" cy="-12.2" r="1.7" fill="#f9dcc0" />
      <circle cx="9.2" cy="-12.2" r="1.7" fill="#f9dcc0" />

      <!-- 下装/裙（短衣长裙款式） -->
      <path v-if="isSkirt" :d="skirtPath" :fill="c.下装" :stroke="c.边色" stroke-width="0.8" />

      <!-- 袍身 -->
      <path :d="robePath" :fill="c.主色" :stroke="c.边色" stroke-width="0.9" />

      <!-- 衣襟 / 斜襟（民族服饰的交领、大襟走向） -->
      <path :d="lapelPath" fill="none" :stroke="c.边色" stroke-width="1.1" stroke-linecap="round" />

      <!-- 民族纹样：织锦格纹 / 银饰 / 蜡染等 -->
      <g :clip-path="`url(#${clipId})`">
        <template v-for="(s, i) in patternShapes" :key="i">
          <line v-if="s.kind === 'line'" :x1="s.x1" :y1="s.y1" :x2="s.x2" :y2="s.y2"
                :stroke="s.c" :stroke-width="s.w" />
          <circle v-else-if="s.kind === 'circle'" :cx="s.cx" :cy="s.cy" :r="s.r"
                  :fill="s.c" :stroke="s.c" :stroke-width="s.w || 0" />
          <polyline v-else-if="s.kind === 'poly'" :points="s.points" fill="none"
                    :stroke="s.c" :stroke-width="s.w" />
          <path v-else :d="s.d" fill="none" :stroke="s.c" :stroke-width="s.w" stroke-linecap="round" />
        </template>
      </g>

      <!-- 腰带 -->
      <rect x="-7.4" :y="beltY" width="14.8" height="3" rx="1.3" :fill="c.腰带" />

      <!-- 脖子 -->
      <rect x="-2.1" y="-28" width="4.2" height="3.4" rx="1" fill="#e8c3a0" />

      <!-- 头发（后侧） -->
      <ellipse cx="0" cy="-30.6" rx="8.6" ry="9.2" :fill="c.头饰色" v-if="isBun" />
      <ellipse v-else cx="0" cy="-30.6" rx="8.6" ry="9.2" fill="#2b2622" />

      <!-- 头 -->
      <circle cx="0" cy="-31" r="7.4" fill="#f9dcc0" stroke="#e6bd9a" stroke-width="0.7" />

      <!-- 刘海 -->
      <path :d="fringePath" :fill="isBun ? c.头饰色 : '#2b2622'" />

      <!-- 五官 -->
      <circle cx="-2.6" cy="-31.7" r="1" fill="#3d3226" />
      <circle cx="2.6" cy="-31.7" r="1" fill="#3d3226" />
      <circle cx="-5" cy="-29.4" r="1.5" fill="#f2b8a8" opacity="0.55" />
      <circle cx="5" cy="-29.4" r="1.5" fill="#f2b8a8" opacity="0.55" />
      <path d="M-1.8,-28.8 q1.8,1.6 3.6,0" fill="none" stroke="#c9825f" stroke-width="0.8" stroke-linecap="round" />

      <!-- 头饰：按当地民族传统头饰变化 -->
      <g v-if="head === 'fur'">
        <path d="M-7.6,-36.4 q7.6,-4.6 15.2,0 q-7.6,2.6 -15.2,0 z" :fill="c.头饰色" />
        <path d="M-6.4,-36.6 q6.4,-6.4 12.8,0 z" :fill="c.边色" />
      </g>
      <g v-else-if="head === 'point-hat'">
        <path d="M-8.2,-34.6 q8.2,-9.6 16.4,0 z" :fill="c.头饰色" />
        <rect x="-8.6" y="-35.6" width="17.2" height="2.2" rx="1.1" :fill="c.边色" />
        <circle cx="0" cy="-42.6" r="1.4" :fill="c.腰带" />
      </g>
      <g v-else-if="head === 'flower-cap'">
        <path d="M-7.8,-34 a7.8,6.6 0 0 1 15.6,0 z" :fill="c.头饰色" />
        <rect x="-8.2" y="-34.8" width="16.4" height="2.4" rx="1.2" :fill="c.边色" />
        <circle cx="-4" cy="-36.4" r="0.95" fill="#fff" opacity="0.85" />
        <circle cx="0" cy="-37.4" r="0.95" fill="#fff" opacity="0.85" />
        <circle cx="4" cy="-36.4" r="0.95" fill="#fff" opacity="0.85" />
      </g>
      <g v-else-if="head === 'crown'">
        <rect x="-8" y="-37.2" width="16" height="3" rx="1.5" :fill="c.头饰色" stroke="#c3cede" stroke-width="0.5" />
        <path d="M-6.2,-37 l1.2,-3.2 l1.2,3.2 z M-1.2,-37.4 l1.2,-3.6 l1.2,3.6 z M3.8,-37 l1.2,-3.2 l1.2,3.2 z"
              :fill="c.头饰色" stroke="#c3cede" stroke-width="0.4" />
        <circle cx="-5" cy="-38.6" r="0.9" :fill="c.腰带" />
        <circle cx="0" cy="-39.4" r="1" :fill="c.腰带" />
        <circle cx="5" cy="-38.6" r="0.9" :fill="c.腰带" />
        <circle cx="-7.7" cy="-33.4" r="1.1" :fill="c.头饰色" stroke="#c3cede" stroke-width="0.4" />
        <circle cx="7.7" cy="-33.4" r="1.1" :fill="c.头饰色" stroke="#c3cede" stroke-width="0.4" />
      </g>
      <g v-else-if="head === 'kerchief'">
        <path d="M-8.2,-36.6 q8.2,-5.2 16.4,0 l0,3 q-8.2,-4.6 -16.4,0 z" :fill="c.头饰色" stroke="rgba(0,0,0,.08)" stroke-width="0.4" />
        <path d="M7.6,-34.4 l4.6,7.2 l-3.8,1.2 z" :fill="c.头饰色" opacity="0.92" />
      </g>
      <g v-else-if="head === 'cap'">
        <path d="M-7.6,-34.4 a7.6,6.4 0 0 1 15.2,0 z" :fill="c.头饰色" stroke="#d8e2ea" stroke-width="0.5" />
        <path d="M-7.6,-34.4 q7.6,2.2 15.2,0" fill="none" stroke="#cfdae4" stroke-width="0.6" />
      </g>
      <g v-else-if="head === 'hood'">
        <path d="M-7.8,-34.4 a7.8,7.2 0 0 1 15.6,0 z" :fill="c.头饰色" />
        <rect x="-9.8" y="-33.8" width="2.8" height="6.6" rx="1.4" :fill="c.头饰色" />
        <rect x="7" y="-33.8" width="2.8" height="6.6" rx="1.4" :fill="c.头饰色" />
        <rect x="-8.4" y="-35.6" width="16.8" height="2.2" rx="1.1" :fill="c.边色" opacity="0.85" />
      </g>
      <g v-else-if="head === 'band'">
        <path d="M-8,-35.8 q8,-3.4 16,0 l0,2.8 q-8,-3 -16,0 z" :fill="c.头饰色" />
        <circle cx="7.4" cy="-33.6" r="1.9" :fill="c.腰带" />
        <path d="M8,-32.6 l3.8,5.2 l-3.4,0.9 z" :fill="c.头饰色" opacity="0.9" />
      </g>
      <g v-else-if="head === 'flower'">
        <path d="M-7.8,-35.4 q7.8,-3.4 15.6,0 l0,2.4 q-7.8,-3 -15.6,0 z" :fill="c.头饰色" />
        <g transform="translate(6.6,-36.6)">
          <circle r="1.3" :fill="c.腰带" />
          <circle cx="-2.3" r="1.25" fill="#f4a0bb" />
          <circle cx="2.3" r="1.25" fill="#f4a0bb" />
          <circle cy="-2.3" r="1.25" fill="#f4a0bb" />
          <circle cy="2.3" r="1.25" fill="#f4a0bb" />
        </g>
      </g>
      <g v-else>
        <circle cx="0" cy="-41" r="3.4" :fill="c.头饰色" />
        <ellipse cx="0" cy="-38.6" rx="4.8" ry="2.3" :fill="c.头饰色" />
        <line x1="-4.2" y1="-41" x2="4.4" y2="-42.2" :stroke="c.腰带" stroke-width="1.2" stroke-linecap="round" />
      </g>
    </g>
  </g>
</template>

<script setup>
import { computed, getCurrentInstance } from "vue";
import { DEFAULT_COSTUME } from "../assets/ethnicCostume.js";

const props = defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  scale: { type: Number, default: 1 },
  costume: { type: Object, default: () => ({}) },
});

const uid = `fig${getCurrentInstance()?.uid ?? 0}`;
const clipId = `${uid}-clip`;

// 服饰参数兜底（未传或字段缺失时用汉族交领汉服）
const c = computed(() => ({ ...DEFAULT_COSTUME, ...props.costume }));
const style = computed(() => c.value.款式 || "robe");
const head = computed(() => c.value.头饰 || "bun");
const isSkirt = computed(() => style.value === "skirt");
// 发髻类头饰用发色画头发，其余用深色
const isBun = computed(() => head.value === "bun");

/* 袍身：长袍下摆宽、旗袍收腰、短衣到腰 */
const robePath = computed(() => {
  if (style.value === "qipao") return "M-5.8,-26 L-6.9,-7.4 L6.9,-7.4 L5.8,-26 Z";
  if (isSkirt.value) return "M-6.2,-26 L-7.4,-16.6 L7.4,-16.6 L6.2,-26 Z";
  return "M-6.4,-26 L-8.4,-7.4 L8.4,-7.4 L6.4,-26 Z";
});
const skirtPath = computed(() => "M-7.6,-17.2 L-9.4,-6.8 L9.4,-6.8 L7.6,-17.2 Z");
const beltY = computed(() => (isSkirt.value ? -17.8 : -16.4));

/* 衣襟：交领右衽（汉服/藏袍）或立领斜襟（旗袍/大襟衫） */
const lapelPath = computed(() => {
  if (style.value === "qipao") return "M3,-26 L-1.8,-25.2 L-4.8,-19.6 L-4.8,-8.8";
  if (isSkirt.value) return "M3,-26 L0,-21 L-3,-26";
  return "M3.2,-26 L0,-21 L-3.2,-26 M0,-21 L-4.6,-20 L-4.6,-9";
});

/* 刘海 */
const fringePath = computed(
  () => "M-7.5,-32.6 q2.6,-4.6 7.5,-4.6 q4.9,0 7.5,4.6 q-3.7,-1.8 -7.5,-1.8 q-3.8,0 -7.5,1.8 z"
);

/* 民族纹样：织锦格纹 / 银饰 / 蜡染 / 绣花 */
const patternShapes = computed(() => {
  const t = c.value.图案 || "plain";
  const col = c.value.纹样 || "#fff";
  const out = [];
  if (t === "stripe") {
    [-22.8, -20.4, -18].forEach((y) => out.push({ kind: "line", x1: -11, y1: y, x2: 11, y2: y, c: col, w: 1.1 }));
    out.push({ kind: "line", x1: -11, y1: -10.6, x2: 11, y2: -10.6, c: col, w: 0.8 });
  } else if (t === "plaid") {
    [-23, -20, -17.4].forEach((y) => out.push({ kind: "line", x1: -11, y1: y, x2: 11, y2: y, c: col, w: 0.8 }));
    [-4, 0, 4].forEach((x) => out.push({ kind: "line", x1: x, y1: -26, x2: x, y2: -6, c: col, w: 0.7 }));
  } else if (t === "dot") {
    [[-4.2, -22.6], [0, -20], [4.2, -22.6], [-2.6, -12.4], [2.6, -12.4], [-5.8, -9.6], [5.8, -9.6]]
      .forEach(([x, y]) => out.push({ kind: "circle", cx: x, cy: y, r: 0.9, c: col }));
  } else if (t === "silver") {
    [-5, -2.5, 0, 2.5, 5].forEach((x) => out.push({ kind: "circle", cx: x, cy: -21, r: 0.95, c: col }));
    [[-5.6, -9.8], [-2.8, -8.8], [0, -8.4], [2.8, -8.8], [5.6, -9.8]]
      .forEach(([x, y]) => out.push({ kind: "circle", cx: x, cy: y, r: 1.15, c: col, w: 0.4 }));
  } else if (t === "zigzag") {
    let pts = "";
    for (let i = 0; i <= 10; i++) pts += `${-8 + i * 1.6},${-11.4 + (i % 2 ? -1.1 : 1.1)} `;
    out.push({ kind: "poly", points: pts.trim(), c: col, w: 1 });
  } else if (t === "embroidery") {
    out.push({
      kind: "path",
      d: "M-7.6,-10.8 q1.6,-2.1 3.2,0 q1.6,2.1 3.2,0 q1.6,-2.1 3.2,0 q1.6,2.1 3.2,0",
      c: col, w: 1,
    });
  }
  return out;
});
</script>

<style scoped>
.fig-shadow { fill: rgba(45, 66, 32, 0.3); }
.fig-bob { animation: figBob 2.8s ease-in-out infinite; }
@keyframes figBob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-1.4px); }
}
</style>
