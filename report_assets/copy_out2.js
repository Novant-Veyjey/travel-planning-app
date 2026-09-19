const fs = require("fs");
const path = require("path");

const srcDir = "C:/Users/Voyager/CodeBuddy/Claw/report_assets";
const desktop = "D:/Users/Voyager/Desktop";

const files = [
  { from: "travel_planner_report.pdf", to: "实习报告_卡通地图旅游计划生成App.pdf" },
  { from: "travel_planner_report.pptx", to: "实习报告_卡通地图旅游计划生成App.pptx" },
];

for (const f of files) {
  const src = path.join(srcDir, f.from);
  const dst = path.join(desktop, f.to);
  // 先尝试删除目标（可能被占用）
  try {
    if (fs.existsSync(dst)) fs.unlinkSync(dst);
    console.log("DELETED old:", f.to);
  } catch (e) {
    console.log("DELETE failed (may be in use):", f.to, "-", e.code);
  }
  // 重新复制
  try {
    fs.copyFileSync(src, dst);
    console.log("COPIED:", f.to, "size:", fs.statSync(dst).size);
  } catch (e) {
    console.log("COPY failed:", f.to, "-", e.code);
  }
}
