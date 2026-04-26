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

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: ["/dashboard", "/dubbing", "/processing", "/export", "/login"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}

