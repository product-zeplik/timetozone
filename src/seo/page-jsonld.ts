import { article, breadcrumbList } from "@zeplik/seo-kit/jsonld";
import { SITE, abs } from "@/site";

/**
 * Page-type JSON-LD from the engine's @zeplik/seo-kit/jsonld builders
 * (manual 6, rules/page-types.yaml), for the page types seo/manifest.json
 * declares that the hand-written graph in src/seo/meta.ts did not cover.
 * Built from the same strings the page renders (H1, meta description), so the
 * markup cannot disagree with the visible page. No FAQPage, HowTo, Review or
 * AggregateRating is added here.
 */

/** The homepage's one-item BreadcrumbList (tool page type: WebApplication + BreadcrumbList). */
export function homeBreadcrumbs() {
  return breadcrumbList([{ name: "Home", url: `${SITE.url}/` }]);
}

/**
 * Article for an informational hub (guide and glossary page types). The page
 * has no human byline, so it is credited to the site's Organization rather
 * than a person (GR-11: no invented authors), and publisher / isPartOf point
 * at the Organization and WebSite nodes the layout already emits (/#org,
 * /#website). Dates come from git (seo/content-dates.json and the commit that
 * added the page), never the clock.
 */
export function hubArticle(o: {
  path: string;
  headline: string;
  description: string;
  datePublished: string;
  dateModified: string;
}) {
  const node = article({
    url: abs(o.path),
    headline: o.headline,
    description: o.description,
    author: { name: SITE.name },
    datePublished: o.datePublished,
    dateModified: o.dateModified,
    inLanguage: "en",
    siteUrl: SITE.url,
  });
  return {
    ...node,
    author: { "@id": `${SITE.url}/#org` },
    publisher: { "@id": `${SITE.url}/#org` },
    isPartOf: { "@id": `${SITE.url}/#website` },
  };
}
