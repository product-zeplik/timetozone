import type { PageTypeId } from "@zeplik/core";

/**
 * The hub content sections this site mounts (plain data; the route objects
 * are in src/seo/content-routes.ts). Read by the routes, the section indexes,
 * the sitemap (src/seo/sitemap-data.ts) and the revalidate webhook.
 *
 * URL design: each section is its own static first segment with one page type,
 * so it can never collide with a keyword-map.csv URL (`/{a}-to-{b}`,
 * `/{pair}/{hour}`, `/time/...`, `/time-zone/...`, `/zones/...`) and Next
 * resolves it before `[pair]`. The site has no local pages of these types, so
 * every slug in them belongs to the hub.
 *
 * Mounted (rules/page-types.yaml against sites/timezone.yaml's topic scope):
 * guide, comparison, alternatives, best_of. Not mounted, by decision:
 * glossary (the site's glossary is the curated /zones/{abbr} set and the
 * /time-zones table, built from src/data/zones.ts), data_study (the computed
 * /daylight-saving-time section owns the DST-date data and its keywords),
 * tool/preset/feature (code-built in this repo).
 */
export interface HubSection {
  /** Bare base path: /guides, /compare, ... */
  basePath: string;
  pageType: PageTypeId;
  /** Manifest feature id of the section index (seo/manifest.json). */
  featureId: string;
  // No index labels here: the index's H1, title and description are the hub's
  // approved section intro (seo-kit route.IndexPage).
}

export const HUB_SECTIONS: readonly HubSection[] = [
  {
    basePath: "/guides",
    pageType: "guide",
    featureId: "guides",
  },
  {
    basePath: "/compare",
    pageType: "comparison",
    featureId: "compare",
  },
  {
    basePath: "/alternatives",
    pageType: "alternatives",
    featureId: "alternatives",
  },
  {
    basePath: "/best",
    pageType: "best_of",
    featureId: "best",
  },
];

/** The section a site path belongs to (its index or one of its pages), or undefined. */
export function sectionOf(path: string): HubSection | undefined {
  return HUB_SECTIONS.find((s) => path === s.basePath || path.startsWith(`${s.basePath}/`));
}
