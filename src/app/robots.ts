import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

// Guests' reservation links carry access tokens and the reserve flow is personal: keep both, and the owner's
// console, out of search engines.

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/reservation", "/reserve", "/api/"] }],
    sitemap: `${env.siteUrl}/sitemap.xml`,
    host: env.siteUrl,
  };
}
