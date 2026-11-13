import { crawlerHits, type CrawlerHitsReporter } from "@zeplik/seo-kit/middleware";
import { controlsKit } from "@/seo/page-controls";

/**
 * AI-crawler hit reporting (engine manual 8.3, seo-kit crawlerHits): counts
 * requests from search/AI crawlers and AI-assistant referrals and sends the
 * hub hourly aggregates (agent, path without query, status, verified flag).
 * No address, user agent, cookie, query string or referrer URL leaves the site.
 *
 * OFF unless ZEPLIK_CRAWLER_HITS=on, which is set on the production Railway
 * service only (never CI, previews, the Dockerfile or locally). Off, record()
 * returns at once and calls nothing. Batches are signed with
 * ZEPLIK_REVALIDATE_SECRET (never printed).
 *
 * Built on the page-control layer's own kit (src/seo/page-controls.ts) so the
 * middleware can never fail to load over an unrelated setting in
 * src/seo.config.ts; if even that kit is invalid, the hook is a no-op.
 * src/middleware.ts calls hits.record(req, res, event) as the last line before
 * every return. Do not remove it.
 */
const NOOP: CrawlerHitsReporter = {
  enabled: false,
  record: () => {},
  flush: async () => {},
  status: () => ({
    enabled: false,
    configured: false,
    kitVersion: "",
    buffered: 0,
    pendingBatches: 0,
    recorded: 0,
    sent: 0,
    dropped: 0,
    lastSentAt: null,
    lastError: "kit invalid",
    rangesFetchedAt: null,
    verifiable: [],
  }),
};

function create(): CrawlerHitsReporter {
  const kit = controlsKit();
  return kit ? crawlerHits({ kit }) : NOOP;
}

/** The process-wide reporter. */
export const hits = create();
