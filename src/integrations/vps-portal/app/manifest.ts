import type { MetadataRoute } from "next";
import { siteConfig } from "@vps/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.description,
    start_url: "/vps",
    display: "standalone",
    id: "/vps",
    lang: "vi",
    orientation: "portrait",
    background_color: "#08111d",
    theme_color: "#1f4ed8",
    categories: ["technology", "business", "hosting"],
    icons: [
      {
        src: siteConfig.icon192Path,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: siteConfig.icon512Path,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: siteConfig.maskableIconPath,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
