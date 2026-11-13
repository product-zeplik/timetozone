/**
 * The content hub the site reads when ZEPLIK_HUB_URL is not set (it always wins
 * when set). cms.zeplik.com has no DNS record yet (13 Nov 2026), so the
 * fallback is the hub's Railway host; switch it back once cms.zeplik.com
 * resolves. One constant, used by src/seo.config.ts and the page-control kit
 * in src/seo/page-controls.ts, so the two can never point at different hubs.
 */
export const HUB_FALLBACK = "https://hub-production-b4aad4f9.up.railway.app";
