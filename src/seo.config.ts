import { defineSeoKit } from "@zeplik/seo-kit";
import { HUB_FALLBACK } from "@/seo/hub-url";

/**
 * @zeplik/seo-kit config for timetozone.com (operating manual 16,
 * sites/timezone.yaml in the engine repo). The origin is a literal: canonicals
 * never depend on the deploy environment.
 *
 * Existing pages are NOT moved onto seo-kit components: their heads and JSON-LD
 * already pass seo-check and the repo's own seo:lint, and a template change
 * ships behind a per-site flag on a canary first (manual 11.2 rule 7). This
 * config serves the hub hooks (revalidate webhook) and the seo-kit JSON-LD
 * builders.
 */
export const kit = defineSeoKit({
  site: "timetozone.com",
  origin: "https://timetozone.com",
  hubUrl: process.env.ZEPLIK_HUB_URL || HUB_FALLBACK,
  role: "ad",
  // Ads through seo-kit slots switch on only when the publisher id is set (15.5).
  // The site's own <Ad> slots are unchanged and still read SITE.adsenseClient.
  adsAllowed: !!process.env.NEXT_PUBLIC_ADSENSE_CLIENT,
  adsenseClient: process.env.NEXT_PUBLIC_ADSENSE_CLIENT || undefined,
  trailingSlash: false, // same as next.config.mjs
  locales: ["en"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  organization: {
    name: "TimeToZone",
    sameAs: process.env.NEXT_PUBLIC_CHROME_STORE_URL ? [process.env.NEXT_PUBLIC_CHROME_STORE_URL] : [],
  },
  indexNowKey: process.env.INDEXNOW_KEY || process.env.ZEPLIK_INDEXNOW_KEY || undefined,
});
