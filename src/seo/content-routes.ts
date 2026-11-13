import type { SitemapEntry } from "@zeplik/core";
import { createContentRoute } from "@zeplik/seo-kit/next";
import { createHubClient, isNextBuildPhase, isNextInternalError } from "@zeplik/seo-kit/hub";
import { kit } from "@/seo.config";
import { HUB_SECTIONS, type HubSection } from "@/seo/hub-sections";

/** The hub sections' client: hourly ISR, the same period as their page files. */
export const hubHourly = createHubClient(kit, { revalidate: 3600, timeoutMs: 8000 });

/**
 * The hub's published sitemap entries, for a section index. At request time a
 * hub outage throws, so the ISR regeneration fails and Next keeps the last
 * good index (an outage never turns a live index into a 404). During
 * `next build` it gives [] and the index is simply not prebuilt.
 */
export async function publishedEntries(): Promise<SitemapEntry[]> {
  try {
    return await hubHourly.getSitemapEntries();
  } catch (err) {
    if (isNextInternalError(err) || !isNextBuildPhase()) throw err;
    console.warn(`[hub] sitemap entries unavailable during the build, no section index prebuilt: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

/**
 * Hub content routes (engine manual 4 and 6): pages the content hub writes,
 * fact-checks and publishes after the owner approves them, rendered by
 * @zeplik/seo-kit's ArticlePage (one H1, byline, dates, disclosure, the hub's
 * Article JSON-LD with FAQPage/HowTo stripped). This repo never holds their
 * copy (CLAUDE.md: copy lives in the content hub). Sections and URL design:
 * src/seo/hub-sections.ts.
 *
 * One object per section, in this one module, imported by the section's page
 * files and by the status document (src/app/.well-known/zeplik-seo.json), which
 * lists them for the hub. No ad slot is passed: hub pages carry no ads until
 * the owner adds one (CLAUDE.md: no new ad slots unless a task says so).
 */
const route = (s: HubSection) => createContentRoute({ kit, hub: hubHourly, basePath: s.basePath, pageTypes: [s.pageType] });

export const CONTENT_ROUTES = HUB_SECTIONS.map((s) => ({ ...s, route: route(s) }));

export type HubRouteSection = (typeof CONTENT_ROUTES)[number];

/** The route section with this base path; throws for a path that is not a section. */
export function routeSection(basePath: string): HubRouteSection {
  const s = CONTENT_ROUTES.find((x) => x.basePath === basePath);
  if (!s) throw new Error(`not a hub section: ${basePath}`);
  return s;
}

export const guides = routeSection("/guides").route;
export const comparisons = routeSection("/compare").route;
export const alternatives = routeSection("/alternatives").route;
export const bestOf = routeSection("/best").route;
