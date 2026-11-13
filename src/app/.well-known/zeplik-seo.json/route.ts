import { createSiteStatusHandler, crawlerHitsState } from "@zeplik/seo-kit/next";
import { kit } from "@/seo.config";
import { CONTENT_ROUTES } from "@/seo/content-routes";
import { siteControls } from "@/seo/page-controls";
import { HUB_COPY_FAMILIES } from "@/seo/hub-copy";

/**
 * The engine status document (seo-kit createSiteStatusHandler): what this site
 * can receive from the content hub -- the kit and core versions, the hub
 * content routes it mounts, the page families whose template carries the hub
 * copy slot, whether an IndexNow key is set, the page-control state and the
 * crawler-hit hook's state. Booleans, versions and route shapes only: no key,
 * no hub URL, no environment value. The hub reads it daily.
 *
 * Not a page: not in any sitemap, not linked, `X-Robots-Tag: noindex` (set by
 * the handler), cache-control `public, max-age=300`. The middleware matcher
 * excludes .json paths, so page controls never touch it.
 */
export const dynamic = "force-dynamic";
export const GET = createSiteStatusHandler({
  kit,
  contentRoutes: CONTENT_ROUTES.map((s) => s.route),
  toolCopy: HUB_COPY_FAMILIES,
  pageControls: siteControls,
  crawlerHits: crawlerHitsState(),
});
