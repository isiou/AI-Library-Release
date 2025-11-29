import axios from "axios";
import CryptoJS from "crypto-js";

const api = axios.create({
  baseURL: "/api",
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    if (config.headers && config.headers.Authorization) {
      delete config.headers.Authorization;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (
      error.response?.status === 401 &&
      !["/auth/login", "/auth/session", "/auth/register"].includes(
        error.config.url,
      )
    ) {
      try {
        sessionStorage.removeItem("auth-storage");
      } catch (storageError) {
        console.warn("清理会话存储失败\n", storageError);
      }
      localStorage.removeItem("user");
      // 如果当前已在登录页则不再重定向
      if (window.location.pathname !== "/auth/login") {
        window.location.replace("/auth/login");
      }
    }
    return Promise.reject(error.response?.data || error.message);
  },
);

export const authAPI = {
  login: (credentials) => api.post("/auth/login", credentials),
  register: (userData) => api.post("/auth/register", userData),
  logout: () => api.post("/auth/logout"),
  getCurrentUser: () => api.get("/auth/session"),
};

export const userAPI = {
  getProfile: () => api.get("/account"),
  updateProfile: (data) => api.put("/account", data),
  changePassword: (data) => {
    const hashedData = { ...data };
    if (hashedData.currentPassword) {
      hashedData.currentPassword = CryptoJS.SHA256(
        hashedData.currentPassword,
      ).toString();
    }
    if (hashedData.newPassword) {
      hashedData.newPassword = CryptoJS.SHA256(
        hashedData.newPassword,
      ).toString();
    }
    return api.put("/account/password", hashedData);
  },
  getStats: () => api.get("/account/stats"),
};

export const bookAPI = {
  search: (params) => api.get("/books/search", { params }),
  getDetail: (id) => api.get(`/books/${id}`),
  getPopular: (params) => api.get("/books/popular/list", { params }),
  getCategories: () => api.get("/books/categories"),
  getLanguages: () => api.get("/books/languages"),
  getAuthors: () => api.get("/books/authors"),
  getRelated: (id) => api.get(`/books/${id}/related`),
  getAll: (params) => api.get("/books/all", { params }),
  create: (data) => api.post("/books", data),
  update: (id, data) => api.put(`/books/${id}`, data),
  delete: (id) => api.delete(`/books/${id}`),
  batchDelete: (ids) => api.post("/books/batch", { ids }),
  import: (formData) =>
    api.post("/books/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

export const borrowAPI = {
  getRecords: (params) => api.get("/borrows", { params }),
  getRecordById: (id) => api.get(`/borrows/${id}`),
  getStats: () => api.get("/account/stats"),
  getAdminRecords: (params) => api.get("/admin/borrows", { params }),
  getAdminStats: () => api.get("/admin/borrows/stats"),
};

export const recommendationAPI = {
  list: (params = {}) =>
    api.get("/recommendations", {
      params: { timeoutMs: params.timeoutMs ?? 60000, ...params },
    }),
  getHistory: (params = {}) => api.get("/recommendations/history", { params }),
  updateHistoryStatus: (id, data) =>
    api.put(`/recommendations/history/${id}`, data),
  get: (params = {}) => recommendationAPI.list(params),
};

export const adminAPI = {
  getInfo: () => api.get("/admin/info"),
  getStudents: (params) => api.get("/admin/students", { params }),
  getStudent: (id) => api.get(`/admin/students/${id}`),
  createStudent: (data) => api.post("/admin/students", data),
  updateStudent: (id, data) => api.put(`/admin/students/${id}`, data),
  deleteStudent: (id) => api.delete(`/admin/students/${id}`),
  resetPassword: (id, data) =>
    api.post(`/admin/students/${id}/reset-password`, data),
  importStudents: (formData) =>
    api.post("/admin/students/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  downloadTemplate: () =>
    api.get("/admin/students/csv-template", { responseType: "blob" }),
  downloadStudentTemplate: () =>
    api.get("/admin/students/csv-template", { responseType: "blob" }),
  getAdmins: () => api.get("/admin/admins"),
  getStats: () => api.get("/admin/stats"),
  toggleAdmin: (id, data) => api.post(`/admin/admins/${id}`, data),
  getImportHistory: () => api.get("/admin/import/history"),
  previewImport: (formData) =>
    api.post("/admin/import/preview", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  importData: (formData) =>
    api.post("/admin/import/data", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getDepartments: () => api.get("/admin/departments"),
  getOverviewStats: (params) => api.get("/admin/stats/overview", { params }),
  getBorrowTrends: (params) => api.get("/admin/stats/trends", { params }),
  getCategoryStats: (params) => api.get("/admin/stats/categories", { params }),
  getUserActivity: (params) => api.get("/admin/stats/activity", { params }),
  getPopularBooks: (params) =>
    api.get("/admin/stats/popular-books", { params }),
  getRecentActivity: (params) =>
    api.get("/admin/stats/recent-activity", { params }),
  exportStatistics: (params) =>
    api.get("/admin/stats/export", {
      params,
      responseType: "blob",
    }),
};

export const aiAssistantAPI = {
  // 会话管理
  getSessions: () => api.get("/ai-assistant/sessions"),
  createSession: (sessionData) =>
    api.post("/ai-assistant/sessions", sessionData),
  updateSession: (sessionId, sessionData) =>
    api.patch(`/ai-assistant/sessions/${sessionId}`, sessionData),
  deleteSession: (sessionId) =>
    api.delete(`/ai-assistant/sessions/${sessionId}`),

  // 消息管理
  getMessages: (sessionId, params = {}) =>
    api.get(`/ai-assistant/sessions/${sessionId}/messages`, { params }),
  sendMessage: (sessionId, messageData) =>
    api.post(`/ai-assistant/sessions/${sessionId}/messages`, messageData),
  saveSystemMessage: (sessionId, messageData) =>
    api.post(
      `/ai-assistant/sessions/${sessionId}/system-messages`,
      messageData,
    ),

  // 模型管理
  getModels: () => api.get("/ai-assistant/models"),

  // 反馈
  submitFeedback: (feedbackData) =>
    api.post("/ai-assistant/feedback", feedbackData),

  // 用户统计
  getUserStats: () => api.get("/ai-assistant/stats"),
};

export const aiAdminAPI = {
  // 模型管理
  getModels: () => api.get("/ai-admin/models"),
  createModel: (modelData) => api.post("/ai-admin/models", modelData),
  updateModel: (modelId, modelData) =>
    api.patch(`/ai-admin/models/${modelId}`, modelData),
  deleteModel: (modelId) => api.delete(`/ai-admin/models/${modelId}`),
  testModel: (modelId, testData) =>
    api.post(`/ai-admin/models/${modelId}/test`, testData),

  // Ollama 管理
  getOllamaHealth: () => api.get("/ai-admin/ollama/health"),
  getOllamaModels: () => api.get("/ai-admin/ollama/models"),
  deleteOllamaModel: (modelName) =>
    api.delete(`/ai-admin/ollama/models/${modelName}`),
  syncOllamaModels: () => api.post("/ai-admin/ollama/sync"),

  // 统计数据
  getStats: (params = {}) => api.get("/ai-admin/stats", { params }),
};

export const announcementAPI = {
  getActive: () => api.get("/announcements/active"),
  getAll: () => api.get("/announcements"),
  create: (data) => api.post("/announcements", data),
  update: (id, data) => api.put(`/announcements/${id}`, data),
  delete: (id) => api.delete(`/announcements/${id}`),
};

export default api;
