import { createRouter, createWebHistory } from "vue-router";
import Home from "../views/Home.vue";
import Routes from "../views/Routes.vue";
import MapView from "../views/MapView.vue";

const routes = [
  { path: "/", name: "home", component: Home, meta: { title: "行程规划" } },
  { path: "/routes", name: "routes", component: Routes, meta: { title: "选择路线" } },
  { path: "/map", name: "map", component: MapView, meta: { title: "卡通地图" } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
