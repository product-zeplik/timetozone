import { SITE, abs } from "@/site";
import { ZONES } from "@/data/zones";
import { COUNTRIES, PLACES, REGIONS } from "@/engine/entities";
import { dstCountries, hourPairs, indexedPairs, multiZoneEntities } from "@/seo/gate";
import { hourLabel } from "@/engine/tz";
import { TOOL_LINKS } from "@/content/nav";
import { contentDate, type ContentFamily } from "@/seo/content-dates";
import { siteControls } from "@/seo/page-controls";

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
 * lastmod is the day the page's content last changed, from git history
 * (seo/content-dates.json via src/seo/content-dates.ts), per page family.
 *
 * It used to be the data build date on every URL, which re-dated all 12,000
 * URLs on every deploy whether or not anything a reader sees had changed.
 * Google ignores a lastmod that is consistently inaccurate (manual 8.2,
 * GR-36), so it now moves only when a family's template, content builder,
 * engine or data does. The same date is the page's JSON-LD dateModified and
 * its visible "Updated" line.
 */
/** TOOL_LINKS hrefs are "/<family>", except the DST hub. */
function toolFamily(href: string): ContentFamily {
  const name = href === "/daylight-saving-time" ? "dst-hub" : href.slice(1);
  return name as ContentFamily;
}

/** The newest lastmod in one sitemap file, for its <sitemap> entry in the index. */
export function sitemapLastmod(id: number): string | undefined {
  return sitemapEntries(id).map((e) => e.lastModified).sort().at(-1);
}

export type SitemapEntry = {
  url: string;
  lastModified: string;
  changeFrequency: "daily";
  priority: number;
};

export function sitemapEntries(id: number): SitemapEntry[] {
  if (!SITE.isProduction) return [];

  const entry = (path: string, priority: number, family: ContentFamily): SitemapEntry => ({
    url: abs(path),
    lastModified: contentDate(family),
    changeFrequency: "daily",
    priority,
  });

  switch (Number(id)) {
    case 0: {
      const out = [entry("/", 1, "home")];
      for (const t of TOOL_LINKS) if (t.href !== "/") out.push(entry(t.href, 0.8, toolFamily(t.href)));
      out.push(entry("/time-zone-map/usa", 0.8, "time-zone-map"));
      out.push(entry("/about", 0.3, "about"), entry("/contact", 0.3, "contact"), entry("/privacy", 0.3, "privacy"), entry("/terms", 0.3, "terms"));
      for (const z of ZONES) out.push(entry(`/zones/${z.slug}`, 0.7, "zone"));
      for (const c of dstCountries()) out.push(entry(`/daylight-saving-time/${c}`, 0.6, "dst-country"));
      for (const e of multiZoneEntities()) out.push(entry(`/time-zone/${e.slug}`, 0.6, "multi-zone"));
      return out;
    }
    case 1:
      return [...indexedPairs()].sort().map((slug) => entry(`/${slug}`, 0.8, "pair"));
    case 2: {
      const out: SitemapEntry[] = [];
      for (const pair of hourPairs()) {
        for (let h = 0; h < 24; h++) out.push(entry(`/${pair}/${hourLabel(h)}`, 0.6, "hour"));
      }
      return out;
    }
    case 3: {
      const out: SitemapEntry[] = [];
      for (const c of COUNTRIES) out.push(entry(`/time/${c.slug}`, 0.7, "place"));
      for (const r of REGIONS) out.push(entry(`/time/${r.countrySlug}/${r.slug}`, 0.6, "place"));
      return out;
    }
    case 4:
      return PLACES.map((p) => entry(`/time/${p.countrySlug}/${p.slug}`, 0.5, "place"));
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

/**
 * The final step before a sitemap file is written: hub page controls
 * (src/seo/page-controls.ts) drop every 410, 301 source, noindex and exclude
 * URL. Returns the rows unchanged unless ZEPLIK_PAGE_CONTROLS=on, so the
 * Docker build and CI always write the code's own sitemap. Do not remove.
 */
export async function sitemapResponse(id: number): Promise<Response> {
  const rows = await siteControls.filterRows(sitemapEntries(id));
  return new Response(sitemapXml(rows), { headers: SITEMAP_HEADERS });
}

/**
 * What a hub webhook must also revalidate so a page control (or any change
 * carrying URLs) reaches the force-static sitemaps at once instead of after
 * their 24 h revalidate: every sitemap file, the index, and each same-site URL
 * in the payload. Empty for any other event, so nothing extra runs for it.
 */
export function controlRevalidatePaths(p: { event: string; urls?: readonly string[] }): string[] {
  const urls = p.urls ?? [];
  if (p.event !== "redirect" && urls.length === 0) return [];
  const out = new Set<string>(["/sitemap.xml", ...SITEMAP_IDS.map(sitemapPath)]);
  const origin = new URL(SITE.url).origin;
  for (const u of urls) {
    try {
      const x = new URL(u, origin);
      if (x.origin === origin && x.pathname.startsWith("/")) out.add(x.pathname);
    } catch {
      /* not a URL: skip */
    }
  }
  return [...out];
}
