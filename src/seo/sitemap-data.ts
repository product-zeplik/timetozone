import { SITE, abs } from "@/site";
import { ZONES } from "@/data/zones";
import { COUNTRIES, PLACES, REGIONS } from "@/engine/entities";
import { dstCountries, hourPairs, indexedPairs, multiZoneEntities } from "@/seo/gate";
import { hourLabel } from "@/engine/tz";
import { TOOL_LINKS } from "@/content/nav";
import meta from "@/data/generated/meta.json";

/** The five sitemap files, each well under the 50,000-URL limit. docs/08 §8.3. */
export const SITEMAP_IDS = [0, 1, 2, 3, 4] as const;

/**
 * Every sitemap lives at the site root -- /sitemap-0.xml, not /sitemap/0.xml.
 *
 * The sitemaps.org protocol scopes a sitemap by its own location: a file at
 * /sitemap/4.xml may only list URLs under /sitemap/. Ours listed root URLs
 * like /time/india from inside /sitemap/, and Search Console answered
 * "Sitemap could not be read" on all five while reading the root index fine.
 * At the root the whole site is in scope, so the question cannot arise.
 */
export const sitemapPath = (id: number) => `/sitemap-${id}.xml`;

/**
 * The date the content was last built, to the day.
 *
 * docs/08 §8.3 says `lastModified` = build/revalidate time, and that was a
 * `new Date()` at render. With a daily revalidate the file regenerates every
 * day, so all 7,695 pair URLs claimed to have changed seconds ago, every day,
 * on identical timestamps. Google's guidance is that lastmod must be when the
 * page last changed *meaningfully* and that a consistently inaccurate one is
 * ignored outright -- and "12,000 pages all changed this second" is a poor
 * look for a domain with no history. The build date is both stable and true:
 * these pages change when the data or the templates are rebuilt.
 */
export const BUILT = (meta as { builtAt: string }).builtAt.slice(0, 10);

export type SitemapEntry = {
  url: string;
  lastModified: string;
  changeFrequency: "daily";
  priority: number;
};

export function sitemapEntries(id: number): SitemapEntry[] {
  if (!SITE.isProduction) return [];

  const entry = (path: string, priority: number): SitemapEntry => ({
    url: abs(path),
    lastModified: BUILT,
    changeFrequency: "daily",
    priority,
  });

  switch (Number(id)) {
    case 0: {
      const out = [entry("/", 1)];
      for (const t of TOOL_LINKS) if (t.href !== "/") out.push(entry(t.href, 0.8));
      out.push(entry("/time-zone-map/usa", 0.8));
      out.push(entry("/about", 0.3), entry("/contact", 0.3), entry("/privacy", 0.3), entry("/terms", 0.3));
      for (const z of ZONES) out.push(entry(`/zones/${z.slug}`, 0.7));
      for (const c of dstCountries()) out.push(entry(`/daylight-saving-time/${c}`, 0.6));
      for (const e of multiZoneEntities()) out.push(entry(`/time-zone/${e.slug}`, 0.6));
      return out;
    }
    case 1:
      return [...indexedPairs()].sort().map((slug) => entry(`/${slug}`, 0.8));
    case 2: {
      const out: SitemapEntry[] = [];
      for (const pair of hourPairs()) {
        for (let h = 0; h < 24; h++) out.push(entry(`/${pair}/${hourLabel(h)}`, 0.6));
      }
      return out;
    }
    case 3: {
      const out: SitemapEntry[] = [];
      for (const c of COUNTRIES) out.push(entry(`/time/${c.slug}`, 0.7));
      for (const r of REGIONS) out.push(entry(`/time/${r.countrySlug}/${r.slug}`, 0.6));
      return out;
    }
    case 4:
      return PLACES.map((p) => entry(`/time/${p.countrySlug}/${p.slug}`, 0.5));
    default:
      return [];
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Serialise to the sitemaps.org 0.9 schema. */
export function sitemapXml(entries: SitemapEntry[]): string {
  const body = entries
    .map(
      (e) =>
        `  <url><loc>${esc(e.url)}</loc><lastmod>${e.lastModified}</lastmod>` +
        `<changefreq>${e.changeFrequency}</changefreq><priority>${e.priority}</priority></url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

/**
 * The same headers the root index has always answered with, which is the one
 * sitemap Google has ever read successfully. A shared-cache TTL so Cloudflare
 * serves them from the edge instead of revalidating against Railway on every
 * fetch, and an explicit Vary because the body is compressed at the edge.
 */
export const SITEMAP_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
  Vary: "Accept-Encoding",
} as const;

export function sitemapResponse(id: number): Response {
  return new Response(sitemapXml(sitemapEntries(id)), { headers: SITEMAP_HEADERS });
}
