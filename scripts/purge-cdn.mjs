#!/usr/bin/env node
/**
 * Purge the Cloudflare cache. Run after a deploy, or Cloudflare keeps serving
 * the previous build's HTML for up to the origin's s-maxage (24 h).
 *   node scripts/purge-cdn.mjs            # purge everything
 *   node scripts/purge-cdn.mjs /a /b      # purge specific paths
 */
const SITE_URL = (process.env.SITE_URL || "https://timetozone.com").replace(/\/+$/, "");
const ZONE = process.env.CF_ZONE_ID;
const TOKEN = process.env.CF_API_TOKEN;

if (!ZONE || !TOKEN) {
  console.error("CF_ZONE_ID and CF_API_TOKEN are not set — nothing purged.");
  process.exit(0);
}

const paths = process.argv.slice(2);
const body = paths.length
  ? { files: paths.map((p) => `${SITE_URL}${p.startsWith("/") ? p : `/${p}`}`) }
  : { purge_everything: true };

const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE}/purge_cache`, {
  method: "POST",
  headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
  body: JSON.stringify(body),
});
const text = await res.text();
console.log(`purge-cdn: ${res.status} ${text.slice(0, 200)}`);
process.exit(res.ok ? 0 : 1);
