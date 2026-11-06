#!/usr/bin/env node
/**
 * Ping IndexNow (Bing, Yandex — which feeds ChatGPT search) after a deploy.
 *   node scripts/indexnow.mjs [path ...]
 * With no arguments it submits the home page and the top pair pages.
 */
const SITE_URL = (process.env.SITE_URL || "https://timetozone.com").replace(/\/+$/, "");
const KEY = process.env.INDEXNOW_KEY;

if (!KEY) {
  console.error("INDEXNOW_KEY is not set — nothing submitted");
  process.exit(0);
}

const DEFAULTS = [
  "/",
  "/pst-to-est",
  "/est-to-pst",
  "/cst-to-est",
  "/est-to-ist",
  "/ist-to-est",
  "/utc-to-est",
  "/world-clock",
  "/meeting-planner",
  "/time-zones",
  "/time-zone-map",
  "/daylight-saving-time",
  "/time/india",
  "/time/uk/london",
  "/what-time-zone-am-i-in",
  "/military-time-converter",
];

const paths = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULTS;
const host = new URL(SITE_URL).host;
const body = {
  host,
  key: KEY,
  keyLocation: `${SITE_URL}/${KEY}.txt`,
  urlList: paths.map((p) => `${SITE_URL}${p.startsWith("/") ? p : `/${p}`}`),
};

const res = await fetch("https://api.indexnow.org/IndexNow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});
console.log(`indexnow: ${res.status} for ${body.urlList.length} URLs`);
process.exit(res.ok ? 0 : 1);
