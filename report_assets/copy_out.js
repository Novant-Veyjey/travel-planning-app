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
  fs.copyFileSync(src, dst);
  console.log("COPIED:", f.to, "size:", fs.statSync(dst).size);
}
