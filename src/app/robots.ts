import type { MetadataRoute } from "next";
import { SITEMAP_IDS, sitemapPath } from "@/seo/sitemap-data";
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

/**
 * Paths no crawler should take. A robots.txt group is not inherited: a crawler
 * obeys the single most specific group that names it and ignores every other,
 * so the per-agent groups below MUST repeat these. Without them `User-Agent:
 * GPTBot` + `Allow: /` told exactly the AI crawlers we most want on the site
 * that `/api/` and the `?t=` / `?d=` / `?z=` state parameters were fair game --
 * an unbounded set of URLs that render the same page at a different clock.
 */
const DISALLOW = ["/api/", "/*?t=", "/*?d=", "/*?z="];

export default function robots(): MetadataRoute.Robots {
  if (!SITE.isProduction) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW,
      },
      ...AI_AGENTS.map((userAgent) => ({ userAgent, allow: "/", disallow: DISALLOW })),
    ],
    sitemap: [`${SITE.url}/sitemap.xml`, ...SITEMAP_IDS.map((i) => `${SITE.url}${sitemapPath(i)}`)],
    host: SITE.url,
  };
}
