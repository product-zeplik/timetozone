#!/usr/bin/env node
/**
 * Submit every indexable URL to IndexNow (Bing, Yandex — and Yandex feeds
 * ChatGPT search), read from our own sitemap index so the list can never
 * drift from what we actually publish.
 *
 *   INDEXNOW_KEY=... node scripts/indexnow-all.mjs [--dry]
 *
 * IndexNow caps a request at 10,000 URLs, so this batches. Submitting the
 * whole set is only worth doing when the set itself changed (a deploy that
 * adds or removes pages); IndexNow asks that you not resubmit unchanged
 * URLs, and Bing will throttle a host that does.
 */
const SITE_URL = (process.env.SITE_URL || "https://timetozone.com").replace(/\/+$/, "");
const KEY = process.env.INDEXNOW_KEY;
const DRY = process.argv.includes("--dry");

if (!KEY && !DRY) {
  console.error("INDEXNOW_KEY is not set — nothing submitted");
  process.exit(0);
}

const BATCH = 10000;
const text = async (u) => {
  const r = await fetch(u, { headers: { "user-agent": "timetozone-indexnow" } });
  if (!r.ok) throw new Error(`${u} -> ${r.status}`);
  return r.text();
};

const locs = (xml, tag) => [...xml.matchAll(new RegExp(`<${tag}>\\s*<loc>([^<]+)</loc>`, "g"))].map((m) => m[1].trim());

const index = await text(`${SITE_URL}/sitemap.xml`);
const children = locs(index, "sitemap");
if (children.length === 0) {
  console.error("no child sitemaps found in the index — refusing to submit a partial set");
  process.exit(1);
}

const urls = [];
for (const child of children) {
  const xml = await text(child);
  const found = locs(xml, "url");
  console.log(`  ${child.replace(SITE_URL, "")}: ${found.length}`);
  urls.push(...found);
}

const unique = [...new Set(urls)];
console.log(`${unique.length} unique URLs across ${children.length} sitemaps`);

// A URL that is not ours would be a bug in the sitemap, not something to ping.
const foreign = unique.filter((u) => !u.startsWith(`${SITE_URL}/`) && u !== SITE_URL);
if (foreign.length) {
  console.error(`refusing to submit: ${foreign.length} URL(s) outside ${SITE_URL}, first ${foreign[0]}`);
  process.exit(1);
}

if (DRY) {
  console.log("--dry: nothing submitted");
  process.exit(0);
}

const host = new URL(SITE_URL).host;
let failed = 0;
for (let i = 0; i < unique.length; i += BATCH) {
  const urlList = unique.slice(i, i + BATCH);
  const res = await fetch("https://api.indexnow.org/IndexNow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key: KEY, keyLocation: `${SITE_URL}/${KEY}.txt`, urlList }),
  });
  console.log(`  batch ${i / BATCH + 1}: ${res.status} for ${urlList.length} URLs`);
  if (!res.ok) failed++;
}
console.log(failed ? `indexnow-all: ${failed} batch(es) failed` : "indexnow-all: OK");
process.exit(failed ? 1 : 0);
