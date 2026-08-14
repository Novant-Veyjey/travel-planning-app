/**
 * 行程会话管理
 * session_id 存 localStorage（仅标识，不含业务数据）
 * 业务数据（输入/形象/路线/选择）全部存后端 SQLite，实现前后端互通 + 刷新恢复
 */
import { api } from "./api/index.js";

const SESSION_KEY = "travel_session_id";

export const session = {
  /** 获取当前 session_id，无则创建新会话 */
  async getOrCreate() {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      try {
        const res = await api.newSession();
        id = res.session_id;
        localStorage.setItem(SESSION_KEY, id);
      } catch (e) {
        console.error("创建会话失败:", e);
      }
    }
    return id;
  },

  /** 获取会话完整状态（刷新后恢复）。若 localStorage 里的 id 已失效/为空，自动重建新会话 */
  async getState() {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      return this.getOrCreate().then((nid) => api.getSession(nid));
    }
    try {
      const state = await api.getSession(id);
      if (state && state.session_id) {
        return state;
      }
      // session 不存在/无效 → 删除旧 id，重建
      localStorage.removeItem(SESSION_KEY);
      const nid = await this.getOrCreate();
      return api.getSession(nid);
    } catch (e) {
      // 网络异常时保留原 id，避免反复创建
      console.error("读取会话失败:", e);
      return api.getSession(id).catch(() => null);
    }
  },

  /** 保存用户输入，返回 { id, ok } */
  async saveInput(input) {
    const id = await this.getOrCreate();
    const res = await api.saveSessionInput(id, input);
    return { id, ...(res || {}) };
  },  /** 关联路线 + 选择 */
  async savePlan(plan_id, selected_index) {
    const id = await this.getOrCreate();
    return api.saveSessionPlan(id, plan_id, selected_index);
  },

  /** 清除会话（重新开始） */
  clear() {
    localStorage.removeItem(SESSION_KEY);
  },
};
