import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      // 开发环境代理到后端
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
