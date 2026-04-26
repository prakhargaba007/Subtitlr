import type { MetadataRoute } from "next";

function getSiteOrigin() {
  const fallback = "https://www.kililabs.io";
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "";

  try {
    const url = new URL(raw || fallback);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return fallback;
    return url.origin;
  } catch {
    return fallback;
  }
}

const PUBLIC_ROUTES = ["/", "/pricing", "/product", "/use-cases", "/docs", "/help", "/feedback", "/terms", "/privacy"];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getSiteOrigin();
  const lastModified = new Date();

  return PUBLIC_ROUTES.map((path) => ({
    url: `${origin}${path}`,
    lastModified,
  }));
}

