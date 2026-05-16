import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/utils/siteUrl";

const PUBLIC_ROUTES = ["/", "/pricing", "/product", "/use-cases", "/docs", "/help", "/feedback", "/terms", "/privacy"];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_ROUTES.map((path) => ({
    url: getSiteUrl(path),
    lastModified,
  }));
}

