import { createHubClient } from "@zeplik/seo-kit/hub";
import { controlsKit } from "@/seo/page-controls";

/**
 * The hub client for reads on EXISTING pages and files: the hub copy slot on
 * the tool pages and the hub rows of sitemap 0.
 *
 * Built on the page-control layer's own kit (src/seo/page-controls.ts, held
 * equal to src/seo.config.ts by tests/page-controls.test.ts), not on
 * src/seo.config.ts, so an unrelated bad setting there (a malformed
 * INDEXNOW_KEY or ad client throws at import) can never take a tool page or a
 * sitemap down. If even that kit is invalid there is no client, and the slot
 * and the hub rows are simply empty.
 *
 * `revalidate: 86400` is the ISR period of the tool pages and the sitemaps, so
 * a hub fetch never shortens a page's revalidate or changes its
 * Cache-Control. Every fetch carries the seo-kit cache tags (zeplik:tool:<id>,
 * zeplik:sitemap), so the revalidate webhook shows new hub content at once.
 */
export const hubKit = controlsKit();
export const hubDaily = hubKit ? createHubClient(hubKit, { revalidate: 86400, timeoutMs: 2500 }) : null;
