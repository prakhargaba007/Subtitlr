import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/utils/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: ["/dashboard", "/dubbing", "/processing", "/export", "/login"],
      },
    ],
    sitemap: getSiteUrl("/sitemap.xml"),
  };
}

