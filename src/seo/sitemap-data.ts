import { SITE, abs } from "@/site";
import { ZONES } from "@/data/zones";
import { COUNTRIES, PLACES, REGIONS } from "@/engine/entities";
import { dstCountries, hourPairs, indexedPairs, multiZoneEntities } from "@/seo/gate";
import { hourLabel } from "@/engine/tz";
import { TOOL_LINKS } from "@/content/nav";
import { contentDate, type ContentFamily } from "@/seo/content-dates";
import { siteControls } from "@/seo/page-controls";
import { HUB_SECTIONS, sectionOf } from "@/seo/hub-sections";
import { hubDaily, hubKit } from "@/seo/hub";
import { createHubClient, isNextInternalError } from "@zeplik/seo-kit/hub";
import { createContentRoute, SITEMAP_ROUTE_CACHE_CONTROL, SITEMAP_SOURCE_HEADER } from "@zeplik/seo-kit/server";
import type { SitemapEntry as HubSitemapEntry } from "@zeplik/core";

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

/** The last hub sitemap list this process read, for a request-time hub outage. */
let lastGoodHub: HubSitemapEntry[] | null = null;

/**
 * The sections' route objects as the sitemap sees them: same base path, page
 * type and index flag as src/seo/content-routes.ts, but on the page-control
 * kit (src/seo/hub.ts), so a bad unrelated setting in src/seo.config.ts can
 * never take a sitemap down. Used only for indexStaticRoutes(): a section
 * index is listed only while the hub says it is listable (an approved intro
 * and at least 3 published pages); otherwise it answers 404 and is never
 * listed. Hourly, like the index pages themselves.
 */
function sectionIndexRoutes() {
  const k = hubKit;
  if (!k) return [];
  const hub = createHubClient(k, { revalidate: 3600, timeoutMs: 2500 });
  return HUB_SECTIONS.map((sec) => ({ sec, route: createContentRoute({ kit: k, hub, basePath: sec.basePath, pageTypes: [sec.pageType], index: true }) }));
}
const indexRoutes = sectionIndexRoutes();

/**
 * Hub pages in sitemap 0 (the file that already holds the tools, trust pages
 * and other hand-built sections): every page the hub has published in a
 * mounted section (src/seo/hub-sections.ts), and each section index the hub
 * says is listable, so a hub page is in exactly one sitemap. lastmod is the
 * hub's dateModified (its sitemap `lastmod`) as a day, never the clock; an
 * index takes its newest page's. Nothing for the other files, and nothing off
 * production (as sitemapEntries).
 *
 * Sitemap 0 is read at request time (src/app/sitemap-0.xml/route.ts), so a
 * hub page published before a deploy is in it on the first request. The
 * fetch is tagged zeplik:sitemap, so the revalidate webhook refreshes it on
 * publish. A hub outage never fails or empties the file: it uses the last
 * list this process read, else no hub rows (a fresh process), and the code's
 * own rows are always there. Page controls still run last, in sitemapResponse.
 */
export async function hubSitemapRows(id: number): Promise<SitemapEntry[]> {
  return (await hubSitemap(id)).rows;
}

async function hubSitemap(id: number): Promise<{ rows: SitemapEntry[]; source: "live" | "last-good" | null }> {
  if (Number(id) !== 0 || !SITE.isProduction) return { rows: [], source: null };
  if (!hubDaily) return { rows: [], source: null };
  let entries: HubSitemapEntry[];
  let source: "live" | "last-good" | null = "live";
  try {
    entries = await hubDaily.getSitemapEntries();
    lastGoodHub = entries;
  } catch (err) {
    if (isNextInternalError(err)) throw err;
    console.warn(`[sitemap] hub entries unavailable, ${lastGoodHub ? "using the last good list" : "no hub rows"}: ${err instanceof Error ? err.message : String(err)}`);
    entries = lastGoodHub ?? [];
    source = lastGoodHub ? "last-good" : null;
  }
  const host = new URL(SITE.url).host;
  const pages = new Map<string, SitemapEntry>();
  const newest = new Map<string, string>();
  for (const e of entries) {
    let path: string;
    try {
      const u = new URL(e.url);
      if (u.host !== host) continue;
      path = u.pathname.replace(/\/+$/, "");
    } catch {
      continue;
    }
    const section = sectionOf(path);
    if (!section || e.pageType !== section.pageType || e.locale !== "en") continue;
    const slug = path.slice(section.basePath.length + 1);
    if (!slug || slug.includes("/") || !/^\d{4}-\d{2}-\d{2}/.test(e.lastmod)) continue;
    const day = e.lastmod.slice(0, 10);
    pages.set(path, { url: abs(path), lastModified: day, changeFrequency: "daily", priority: 0.6 });
    if ((newest.get(section.basePath) ?? "") < day) newest.set(section.basePath, day);
  }
  const out: SitemapEntry[] = [];
  for (const { sec, route } of indexRoutes) {
    const day = newest.get(sec.basePath);
    if (!day) continue;
    const listed = await route.indexStaticRoutes(); // never throws; [] while not listable
    if (listed.some((r) => r.path === sec.basePath)) out.push({ url: abs(sec.basePath), lastModified: day, changeFrequency: "daily", priority: 0.5 });
  }
  out.push(...[...pages.values()].sort((a, b) => a.url.localeCompare(b.url)));
  return { rows: out, source };
}

/** The newest lastmod in one sitemap file, hub rows included, for the index. */
export async function sitemapFileLastmod(id: number): Promise<string | undefined> {
  return [...sitemapEntries(id), ...(await hubSitemapRows(id))].map((e) => e.lastModified).sort().at(-1);
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
 * URL -- from the code's rows and the hub's rows alike. Returns the rows
 * unchanged unless ZEPLIK_PAGE_CONTROLS=on, so the Docker build and CI always
 * write the code's own sitemap. Do not remove.
 */
export async function sitemapResponse(id: number): Promise<Response> {
  const hub = await hubSitemap(id);
  const rows = await siteControls.filterRows([...sitemapEntries(id), ...hub.rows]); // last step: nothing is added after it
  // Sitemap 0 holds the hub's pages and is read at request time: seo-kit's
  // sitemap cache header (5 min at the edge) and the source it was read from.
  const headers =
    Number(id) === 0
      ? { ...SITEMAP_HEADERS, "Cache-Control": SITEMAP_ROUTE_CACHE_CONTROL, ...(hub.source ? { [SITEMAP_SOURCE_HEADER]: hub.source } : {}) }
      : SITEMAP_HEADERS;
  return new Response(sitemapXml(rows), { headers });
}

/**
 * What a hub webhook must also revalidate so a page control (or any change
 * carrying URLs) reaches the force-static sitemaps at once instead of after
 * their 24 h revalidate: every sitemap file, the index, and each same-site URL
 * in the payload. A hub article event (publish, update, unpublish, delete)
 * also refreshes every hub section index (src/seo/hub-sections.ts), so a
 * first article turns its section's 404 index into a listing and a removed
 * one leaves it. Empty for any other event, so nothing extra runs for it.
 */
export function controlRevalidatePaths(p: { event: string; kind?: string; urls?: readonly string[] }): string[] {
  const urls = p.urls ?? [];
  const article = p.kind === "article";
  if (p.event !== "redirect" && urls.length === 0 && !article) return [];
  const out = new Set<string>(["/sitemap.xml", ...SITEMAP_IDS.map(sitemapPath)]);
  if (article) for (const s of HUB_SECTIONS) out.add(s.basePath);
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
