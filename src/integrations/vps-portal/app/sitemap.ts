import type { MetadataRoute } from "next";
import { getAbsoluteUrl } from "@vps/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: getAbsoluteUrl("/vps"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: getAbsoluteUrl("/vps/auth"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: getAbsoluteUrl("/vps/gioi-thieu"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
  ];
}
