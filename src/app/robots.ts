import type { MetadataRoute } from "next";
import { SITE } from "@/site";

export const revalidate = 86400;

const AI_AGENTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bingbot",
  "Amazonbot",
  "meta-externalagent",
];

export default function robots(): MetadataRoute.Robots {
  if (!SITE.isProduction) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/*?t=", "/*?d=", "/*?z="],
      },
      ...AI_AGENTS.map((userAgent) => ({ userAgent, allow: "/" })),
    ],
    sitemap: [`${SITE.url}/sitemap.xml`, ...[0, 1, 2, 3, 4].map((i) => `${SITE.url}/sitemap/${i}.xml`)],
    host: SITE.url,
  };
}
