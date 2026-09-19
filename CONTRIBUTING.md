# 贡献指南

## 提交前准备

1. 从 `main` 新建分支，分支名使用 `feat/`、`fix/`、`docs/` 或 `chore/` 前缀。
2. 安装依赖：

   ```bash
   npm ci --prefix server
   npm ci --prefix web
   ```

3. 本地开发时分别启动后端和前端：

   ```bash
   npm --prefix server run dev
   npm --prefix web run dev
   ```

## 代码规范

- 保持修改范围聚焦，不混入无关重构。
- 前端组件和样式遵循现有命名及目录结构。
- 新增接口时同步更新 README 的 API 表格。
- 提交信息使用 Conventional Commits，例如：

  ```text
  feat(map): 增加步行导航缩放
  fix(weather): 处理天气接口超时
  docs: 更新本地运行说明
  chore: 调整忽略规则
  ```

## 验证

至少完成以下检查：

```bash
node --check server/src/index.js
npm --prefix web run build
```

涉及后端或地图交互时，请再启动本地服务验证主要流程。

## Pull Request

- 说明问题、方案和验证结果。
- 界面修改请附桌面端和移动端截图。
- 不要提交 `.env`、`server/data/`、`web/dist/`、日志或本地测试文件。
- 保持 CI 通过后再请求合并。
