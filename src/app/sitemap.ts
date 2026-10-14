import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { APARTMENT_CONTENT } from "@/lib/site";

// Public pages only. Reservation, reserve-flow, availability-result and admin routes are never listed.

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.siteUrl;
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    ...Object.keys(APARTMENT_CONTENT).map((slug) => ({
      url: `${base}/apartments/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    { url: `${base}/house-rules`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
