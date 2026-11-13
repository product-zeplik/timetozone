import { SITE } from "@/site";
import { SITEMAP_HEADERS, SITEMAP_IDS, sitemapFileLastmod, sitemapPath } from "@/seo/sitemap-data";

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
export async function GET() {
  // Each file's lastmod is its newest URL's content date (seo/content-dates.json,
  // or the hub's dateModified for hub pages), never the build or request clock.
  const lastmods = await Promise.all(SITEMAP_IDS.map((i) => sitemapFileLastmod(i)));
  const entry = (i: number) => {
    const lastmod = lastmods[i];
    return `  <sitemap><loc>${SITE.url}${sitemapPath(i)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</sitemap>`;
  };
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SITEMAP_IDS.map(entry).join("\n")}
</sitemapindex>
`;
  return new Response(body, { headers: SITEMAP_HEADERS });
}
