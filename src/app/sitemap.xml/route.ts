import { SITE } from "@/site";

export const dynamic = "force-static";
export const revalidate = 86400;

/**
 * A sitemap index pointing at the five sitemap files.
 *
 * `generateSitemaps` produces /sitemap/0.xml … /sitemap/4.xml but no index, so
 * every engine has to be told about each file separately. An index at the
 * conventional /sitemap.xml means one URL to submit, and crawlers that look
 * for it by convention find the whole set.
 */
export function GET() {
  const lastmod = new Date().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[0, 1, 2, 3, 4]
  .map((i) => `  <sitemap><loc>${SITE.url}/sitemap/${i}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`)
  .join("\n")}
</sitemapindex>
`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
