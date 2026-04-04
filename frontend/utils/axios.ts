import axios from "axios";

const instance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL,
  headers: {
    "Content-Type": "application/json",
  },
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

// Request interceptor
instance.interceptors.request.use(
  (config) => {
    // Get token from localStorage on client side only
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// JWT errors that indicate the token is invalid - should log out user
const JWT_INVALID_MESSAGES = [
  "invalid signature",
  "jwt expired",
  "jwt malformed",
  "invalid token",
  "not authenticated",
];

function shouldLogOut(error: {
  response?: { status?: number; data?: { message?: string } };
}) {
  if (error.response?.status === 401) return true;
  const msg = error.response?.data?.message?.toLowerCase() ?? "";
  return JWT_INVALID_MESSAGES.some((m) => msg.includes(m));
}

// Response interceptor
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined" && shouldLogOut(error)) {
      localStorage.removeItem("token");
      localStorage.removeItem("userRole");
      localStorage.removeItem("userData");
      window.location.href = "/?error=session_expired";
    }
    return Promise.reject(error);
  },
);

export default instance;
