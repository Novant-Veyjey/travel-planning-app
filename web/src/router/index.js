import { createRouter, createWebHistory } from "vue-router";
import Home from "../views/Home.vue";
import Routes from "../views/Routes.vue";
import MapView from "../views/MapView.vue";

const routes = [
  { path: "/", name: "home", component: Home, meta: { title: "行程规划" } },
  { path: "/routes", name: "routes", component: Routes, meta: { title: "选择路线" } },
  // 卡通地图与实景 GPS 已合并到同一页，用 ?view=real 切换视图
  { path: "/map", name: "map", component: MapView, meta: { title: "导航地图" } },
  {
    path: "/walk",
    redirect: (to) => ({ path: "/map", query: { ...to.query, view: "real" } }),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
