import { sitemapResponse } from "@/seo/sitemap-data";

// Read at request time: this file holds the hub's pages, so a page the hub
// published before a deploy is listed on the first request, never only after
// a 24 h regeneration (seo-kit 0.1.12, request-time sitemaps). The other four
// files hold no hub rows and stay force-static.
export const dynamic = "force-dynamic";

/** Sitemap 0 of 5. Lives at the root so the whole site is in scope. */
export function GET() {
  return sitemapResponse(0);
}
