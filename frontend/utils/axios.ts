import axios from "axios";

const instance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL,
  // Don't set a global Content-Type. Some endpoints use FormData and need axios
  // to automatically set the correct multipart boundary.
  withCredentials: true, // Crucial: Sends HttpOnly cookies automatically
});

/** Base URL for S3-hosted assets (profile pictures, uploaded files, etc.) */
export const S3_BASE_URL = process.env.NEXT_PUBLIC_S3_BASE_URL ?? "";

/**
 * Resolve an S3 object key or relative path to a full image URL.
 * If the value is already a full URL it is returned unchanged.
 */
export function s3Url(keyOrUrl: string | null | undefined): string {
  if (!keyOrUrl) return "";
  if (keyOrUrl.startsWith("http://") || keyOrUrl.startsWith("https://")) {
    return keyOrUrl;
  }
  return `${S3_BASE_URL}/${keyOrUrl.replace(/^\//, "")}`;
}

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
type FailedQueueItem = {
  resolve: (value?: unknown) => void;
  reject: (error: unknown) => void;
};
let failedQueue: FailedQueueItem[] = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach((prom) => {
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
          // Retry original request (cookies are sent automatically)
          return instance(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Call refresh endpoint
        // Use the same axios instance so baseURL + cookie handling are consistent.
        // (The response interceptor already guards against infinite loops for /api/auth/refresh.)
        await instance.post("/api/auth/refresh", {});
        
        processQueue(null);
        return instance(originalRequest);
      } catch (err) {
        console.error("[AXIOS] Refresh failed or original request retry failed", err);
        processQueue(err);
        // If refresh fails, redirect to login
        if (typeof window !== "undefined") {
          localStorage.removeItem("userData");
          const path = window.location.pathname;
          console.warn("[AXIOS] Redirecting to home due to session expiration at path:", path);
          if (path.startsWith("/dashboard") || path.startsWith("/processing") || path.startsWith("/export") || path.startsWith("/billing")) {
            window.location.href = "/?error=session_expired";
          }
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
