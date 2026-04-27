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
  console.log(`[AXIOS] Processing queue. Error:`, error ? "Yes" : "No", "Queue size:", failedQueue.length);
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
    const status = error.response?.status;
    const url = originalRequest?.url || "unknown";

    if (status === 401) {
      console.log(`[AXIOS] 401 Unauthorized for ${url}. isRefreshing: ${isRefreshing}`);
    }

    // Handle 401 Unauthorized errors
    if (status === 401 && !originalRequest._retry) {
      // Prevent infinite loops on the refresh endpoint itself
      if (url.includes("/api/auth/refresh")) {
        console.warn("[AXIOS] Refresh token itself failed with 401. Clearing session.");
        if (typeof window !== "undefined") {
          localStorage.removeItem("userData");
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        console.log(`[AXIOS] Already refreshing. Queuing request for ${url}`);
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            console.log(`[AXIOS] Retrying queued request for ${url}`);
            return instance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;
      console.log(`[AXIOS] Starting token refresh for ${url}`);

      try {
        // Call refresh endpoint
        // Use plain axios to avoid interceptor recursion
        await axios.post(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );
        console.log("[AXIOS] Token refresh successful");

        // IMPORTANT: Set isRefreshing to false BEFORE processing queue
        // so that retried requests don't get stuck in the "if (isRefreshing)" block again.
        isRefreshing = false;
        processQueue(null);

        return instance(originalRequest);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";
        console.error("[AXIOS] Token refresh failed:", message);
        isRefreshing = false; // Ensure it's reset on failure too
        processQueue(err);

        // If refresh fails, redirect to login for protected pages
        if (typeof window !== "undefined") {
          localStorage.removeItem("userData");
          const path = window.location.pathname;
          console.warn("[AXIOS] Redirecting due to session expiration at path:", path);
          
          if (
            path.startsWith("/dashboard") ||
            path.startsWith("/processing") ||
            path.startsWith("/export") ||
            path.startsWith("/billing")
          ) {
            window.location.href = "/?error=session_expired";
          }
        }
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);

export default instance;
