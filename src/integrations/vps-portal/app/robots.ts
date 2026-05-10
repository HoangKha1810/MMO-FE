import type { MetadataRoute } from "next";
import { getAbsoluteUrl } from "@vps/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/vps",
      disallow: ["/api/", "/admin"],
    },
    sitemap: getAbsoluteUrl("/sitemap.xml"),
    host: getAbsoluteUrl(),
  };
}
