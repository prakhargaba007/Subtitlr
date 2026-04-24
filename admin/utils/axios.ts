import axios from "axios";

const instance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Crucial: Sends HttpOnly cookies automatically
});

// Helper to read non-HttpOnly CSRF cookie
const getCsrfToken = () => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(^|;)\s*csrfToken\s*=\s*([^;]+)/);
  return match ? match[2] : null;
};

// Request interceptor
instance.interceptors.request.use((config) => {
  if (config.method && ['post', 'put', 'delete', 'patch'].includes(config.method.toLowerCase())) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return config;
});

// Response Interceptor: Auto-refresh on 401
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else prom.resolve();
  });
  failedQueue = [];
};

instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Prevent infinite loops on the refresh endpoint itself
    if (originalRequest.url?.includes("/api/auth/refresh")) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          return instance(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/refresh`, {}, { withCredentials: true });
        
        processQueue(null);
        return instance(originalRequest);
      } catch (err) {
        processQueue(err);
        if (typeof window !== "undefined") {
          localStorage.removeItem("userRole");
          localStorage.removeItem("userData");
          window.location.href = "/";
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default instance;