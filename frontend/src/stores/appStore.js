import { create } from "zustand";

const useAppStore = create((set, get) => ({
  // 全局加载状态
  globalLoading: false,
  setGlobalLoading: (loading) => set({ globalLoading: loading }),

  // 侧边栏状态
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  // 主题设置
  theme: "light",
  setTheme: (theme) => set({ theme }),

  // 语言设置
  language: "zh-CN",
  setLanguage: (language) => set({ language }),

  // 通知消息
  notifications: [],
  addNotification: (notification) => {
    const id = Date.now().toString();
    const newNotification = { id, ...notification };
    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }));

    // 自动移除通知
    if (notification.duration !== 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, notification.duration || 4500);
    }

    return id;
  },
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },
  clearNotifications: () => set({ notifications: [] }),

  // 面包屑导航
  breadcrumbs: [],
  setBreadcrumbs: (breadcrumbs) => set({ breadcrumbs }),

  // 页面标题
  pageTitle: "",
  setPageTitle: (title) => set({ pageTitle: title }),

  // 搜索历史
  searchHistory: [],
  addSearchHistory: (query) => {
    const { searchHistory } = get();
    const newHistory = [
      query,
      ...searchHistory.filter((item) => item !== query),
    ].slice(0, 10);
    set({ searchHistory: newHistory });
  },
  clearSearchHistory: () => set({ searchHistory: [] }),

  // 用户偏好设置
  userPreferences: {
    pageSize: 10,
    defaultView: "list",
    autoRefresh: false,
    showTutorial: true,
  },
  updateUserPreferences: (preferences) => {
    set((state) => ({
      userPreferences: { ...state.userPreferences, ...preferences },
    }));
  },

  // 缓存数据
  cache: {},
  setCache: (key, data, ttl = 5 * 60 * 1000) => {
    const expiry = Date.now() + ttl;
    set((state) => ({
      cache: {
        ...state.cache,
        [key]: { data, expiry },
      },
    }));
  },
  getCache: (key) => {
    const { cache } = get();
    const item = cache[key];
    if (!item) return null;

    if (Date.now() > item.expiry) {
      set((state) => {
        const newCache = { ...state.cache };
        delete newCache[key];
        return { cache: newCache };
      });
      return null;
    }

    return item.data;
  },
  clearCache: () => set({ cache: {} }),

  // 错误处理
  errors: [],
  addError: (error) => {
    const id = Date.now().toString();
    const newError = { id, ...error, timestamp: new Date() };
    set((state) => ({
      errors: [...state.errors, newError],
    }));
    return id;
  },
  removeError: (id) => {
    set((state) => ({
      errors: state.errors.filter((e) => e.id !== id),
    }));
  },
  clearErrors: () => set({ errors: [] }),
}));

export default useAppStore;
