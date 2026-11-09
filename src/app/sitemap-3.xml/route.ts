import { sitemapResponse } from "@/seo/sitemap-data";

export const dynamic = "force-static";
export const revalidate = 86400;

/** Sitemap 3 of 5. Lives at the root so the whole site is in scope. */
export function GET() {
  return sitemapResponse(3);
}
