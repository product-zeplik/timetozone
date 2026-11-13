import { defineSeoKit, type SeoKit } from "@zeplik/seo-kit";
import { pageControls, seoMiddleware, type PageControlsOptions, type PageControlsStatus } from "@zeplik/seo-kit/middleware";
import { HUB_FALLBACK } from "@/seo/hub-url";

/**
 * Hub page controls (engine core page-controls.ts): the hub can take a URL out
 * of the index or the sitemap at runtime -- 410, 301, `X-Robots-Tag: noindex,
 * follow`, or sitemap exclusion -- and nothing else. Restrict-only: whatever
 * this repo's code decides still applies; a control only adds to it.
 *
 * OFF unless ZEPLIK_PAGE_CONTROLS=on, which is set on the production Railway
 * service only. CI, the Docker build (so seo:lint and the prebuilt HTML),
 * `next dev` and local smoke never see hub state. Fails open: a hub outage
 * keeps the last good set (or none) and never takes a page down.
 *
 * Two consumers, one source per process: src/middleware.ts (410/301 early,
 * noindex header on the way out) and src/seo/sitemap-data.ts (controlled URLs
 * leave the sitemap). Do not remove either hook.
 */

/**
 * Paths a control never reaches here, on top of the hub's own protected list:
 * Next internals, the API (health, revalidate, search), and any file with an
 * extension (robots.txt, llms.txt, the IndexNow key, sitemaps, assets).
 */
export function skipControls(pathname: string): boolean {
  if (pathname.startsWith("/_next/") || pathname.startsWith("/__nextjs")) return true;
  if (pathname === "/api" || pathname.startsWith("/api/")) return true;
  const last = pathname.slice(pathname.lastIndexOf("/") + 1);
  return /\.[a-z0-9]{1,12}$/i.test(last);
}

/**
 * The control layer's own kit: the fields it needs, the same values as
 * src/seo.config.ts (a test holds them equal). It is separate so that the
 * middleware, which runs on every page, never fails to load because of an
 * unrelated setting there (a malformed INDEXNOW_KEY or ad client would throw
 * at import). If even this fails, controls stay off and the site serves as if
 * the hook were absent.
 */
export function controlsKit(): SeoKit | null {
  try {
    return defineSeoKit({
      site: "timetozone.com",
      origin: "https://timetozone.com",
      hubUrl: process.env.ZEPLIK_HUB_URL || HUB_FALLBACK,
      role: "ad",
      trailingSlash: false,
      locales: ["en"],
      defaultLocale: "en",
      localePrefix: "as-needed",
      organization: { name: "TimeToZone" },
    });
  } catch (err) {
    console.warn(`[page-controls] disabled, kit invalid: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** What the status document says when the control kit could not load. */
const OFF_STATUS: PageControlsStatus = { enabled: false, version: null, count: 0, fetchedAt: null, lastError: "kit invalid", dropped: [], refused: null };

const OFF = {
  enabled: false as const,
  respond: async (_req: Request): Promise<Response | undefined> => undefined,
  decorate: async <R extends Response>(_req: Request, res: R): Promise<R> => res,
  filterRows: async <T extends { url: string }>(rows: readonly T[]): Promise<T[]> => [...rows],
  status: (): PageControlsStatus => OFF_STATUS,
};

export function createPageControls(opts: Omit<PageControlsOptions, "kit"> = {}) {
  const kit = controlsKit();
  if (!kit) return OFF;
  const controls = pageControls({ kit, ...opts });
  // Only the control layer: this site's middleware already lowercases and
  // deliberately never redirects hosts (src/middleware.ts), and Next owns the
  // trailing slash (next.config.mjs trailingSlash: false).
  const seo = seoMiddleware({
    kit,
    pageControls: controls,
    canonicalHost: false,
    trailingSlash: false,
    lowercase: false,
    skip: skipControls,
  });
  return {
    enabled: controls.enabled,
    /** A 410 or 301 for a controlled path, or undefined. No-op when off. */
    async respond(req: Request): Promise<Response | undefined> {
      if (!controls.enabled) return undefined;
      try {
        return await seo(req);
      } catch (err) {
        console.warn(`[page-controls] skipped: ${err instanceof Error ? err.message : String(err)}`);
        return undefined; // fail open: the page serves as the code decides
      }
    },
    /** Adds `X-Robots-Tag: noindex, follow` + `x-zeplik-control` for a noindex control. No-op when off. */
    async decorate<R extends Response>(req: Request, res: R): Promise<R> {
      if (!controls.enabled) return res;
      try {
        return (await seo.decorate(req, res)) as R;
      } catch (err) {
        console.warn(`[page-controls] skipped: ${err instanceof Error ? err.message : String(err)}`);
        return res;
      }
    },
    /** Drops every controlled URL from sitemap rows. Returns the rows unchanged when off. */
    filterRows<T extends { url: string }>(rows: readonly T[]): Promise<T[]> {
      return controls.filterRows(rows);
    },
    /** On or off, set version, count, a short error word: for /.well-known/zeplik-seo.json. No values. */
    status(): PageControlsStatus {
      return controls.status();
    },
  };
}

/** The process-wide source. */
export const siteControls = createPageControls();
