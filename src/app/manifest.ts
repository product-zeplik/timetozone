import type { MetadataRoute } from "next";
import { SITE } from "@/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name} — Time Zone Converter`,
    short_name: SITE.name,
    description: SITE.descriptor,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#080808",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/brand/app-icon-light-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/app-icon-light-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
