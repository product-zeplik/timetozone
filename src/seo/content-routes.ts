import { createContentRoute } from "@zeplik/seo-kit/server";
import { createHubClient } from "@zeplik/seo-kit/hub";
import { kit } from "@/seo.config";
import { HUB_SECTIONS, type HubSection } from "@/seo/hub-sections";

/** The hub sections' client: hourly ISR, the same period as their page files. */
export const hubHourly = createHubClient(kit, { revalidate: 3600, timeoutMs: 8000 });

/**
 * Hub content routes (engine manual 4 and 6): pages the content hub writes,
 * fact-checks and publishes after the owner approves them, rendered by
 * @zeplik/seo-kit's ArticlePage (one H1, byline, dates, disclosure, the hub's
 * Article JSON-LD with FAQPage/HowTo stripped). This repo never holds their
 * copy (CLAUDE.md: copy lives in the content hub). Sections and URL design:
 * src/seo/hub-sections.ts.
 *
 * One object per section, from seo-kit's server entry (no client module, so a
 * page that imports it ships no seo-kit client JS), in this one module,
 * imported by the section's page files and by the status document (src/app/.well-known/zeplik-seo.json), which
 * lists them for the hub. No ad slot is passed: hub pages carry no ads until
 * the owner adds one (CLAUDE.md: no new ad slots unless a task says so), and
 * CTAs are plain server links (ctaTracking: false in src/seo.config.ts).
 *
 * index: true: every section is hub-only, and its index is seo-kit's
 * route.IndexPage (the hub's approved intro, title and pages), a real 404 that
 * stays out of the sitemap until the hub says it is listable (an approved
 * intro and at least 3 published pages).
 */
const route = (s: HubSection) => createContentRoute({ kit, hub: hubHourly, basePath: s.basePath, pageTypes: [s.pageType], index: true });

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
