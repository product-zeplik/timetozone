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
  /** Section index labels: the H1, the <title> and meta description, the breadcrumb name. */
  h1: string;
  title: string;
  description: string;
  crumb: string;
}

export const HUB_SECTIONS: readonly HubSection[] = [
  {
    basePath: "/guides",
    pageType: "guide",
    featureId: "guides",
    h1: "Time zone guides",
    title: "Time Zone Guides – TimeToZone",
    description: "Guides to time zones, daylight saving time and scheduling across time zones, from TimeToZone.",
    crumb: "Guides",
  },
  {
    basePath: "/compare",
    pageType: "comparison",
    featureId: "compare",
    h1: "Time zone tool comparisons",
    title: "Time Zone Tool Comparisons – TimeToZone",
    description: "Comparisons of time zone converters, world clocks and meeting planners, with the test method and date on every page.",
    crumb: "Comparisons",
  },
  {
    basePath: "/alternatives",
    pageType: "alternatives",
    featureId: "alternatives",
    h1: "Time zone tool alternatives",
    title: "Time Zone Tool Alternatives – TimeToZone",
    description: "Alternatives to time zone converters, world clocks and meeting planners, with the selection criteria on every page.",
    crumb: "Alternatives",
  },
  {
    basePath: "/best",
    pageType: "best_of",
    featureId: "best",
    h1: "Best time zone tools",
    title: "Best Time Zone Tools – TimeToZone",
    description: "Ranked lists of time zone converters, world clocks and meeting planners, with the method and review date on every page.",
    crumb: "Best of",
  },
];

/** The section a site path belongs to (its index or one of its pages), or undefined. */
export function sectionOf(path: string): HubSection | undefined {
  return HUB_SECTIONS.find((s) => path === s.basePath || path.startsWith(`${s.basePath}/`));
}
