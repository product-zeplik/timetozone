#!/usr/bin/env node
/**
 * Check what every published page SAYS the time is against what tzdata says.
 *
 *   npm run audit:offsets                        # all of production
 *   npm run audit:offsets -- http://127.0.0.1:3000
 *   npm run audit:offsets -- https://timetozone.com --limit 500
 *
 * The engine has 127 tests, but what a reader gets is static HTML baked at
 * some earlier moment, on whatever tz database the build happened to run.
 * Tests cannot see that gap; this does. It reads the URL list from our own
 * sitemaps, pulls each page, extracts the offset the page states, and compares
 * it with this process's tzdata (vendor/icu-tz via scripts/with-tzdata.mjs).
 *
 * It found Cuba stating UTC-5 while Havana was on UTC-4, across 15 pages.
 */
const BASE = (process.argv.find((a) => a.startsWith("http")) || "https://timetozone.com").replace(/\/+$/, "");
const LIMIT = Number(process.argv[process.argv.indexOf("--limit") + 1]) || Infinity;
const CONC = Number(process.env.CONC || 24);

const REGIONS = "Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Etc|Europe|Indian|Pacific";
const ZRE = new RegExp(`(?:${REGIONS})(?:\\\\?/[A-Za-z_+-]+){1,2}`, "g");

const offMin = (tz) => {
  const raw = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
    .formatToParts(Date.now())
    .find((p) => p.type === "timeZoneName").value;
  if (raw === "GMT") return 0;
  const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(raw);
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
};
const valid = (tz) => {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
};
const strip = (t) =>
  t.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");
const hrs = (m) => (m / 60).toString();

const text = async (u) => {
  const r = await fetch(u, { headers: { "user-agent": "timetozone-offset-audit" } });
  if (!r.ok) throw new Error(`status ${r.status}`);
  return r.text();
};

/* ------------------------------------------- the URL list, from our sitemaps */
const index = await text(`${BASE}/sitemap.xml`);
const children = [...index.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
if (!children.length) throw new Error("no child sitemaps — refusing to audit a partial set");
const urls = [];
for (const c of children) {
  const xml = await text(c.replace(/^https?:\/\/[^/]+/, BASE));
  for (const m of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)) urls.push(m[1].trim().replace(/^https?:\/\/[^/]+/, BASE));
}
const list = [...new Set(urls)].slice(0, LIMIT);
console.log(`offset-audit: ${list.length} URLs on ${BASE}, tzdata ${process.versions.tz}\n`);

/* ----------------------------------------------------------------- the check */
const bad = [];
const skip = new Map();
let ok = 0;
let done = 0;

async function one(url) {
  let html;
  try { html = await text(url); } catch (e) { skip.set(`fetch ${e.message}`, (skip.get(`fetch ${e.message}`) || 0) + 1); return; }
  const h1 = /<\/h1>([\s\S]{0,400})/.exec(html);
  if (!h1) return skip.set("no h1", (skip.get("no h1") || 0) + 1);
  const ans = strip(h1[1]);
  const zones = [...new Set([...html.matchAll(ZRE)].map((m) => m[0].replace("\\/", "/")))].filter(valid);

  // Place page: "<Place> is on <Name> - ABBR ( UTC-8 ) right now."
  const place = /\(\s*UTC([+−-])(\d{1,2})(?::(\d{2}))?\s*\)\s*right now/.exec(ans);
  if (place && zones.length >= 1) {
    const claimed = (place[1] === "-" || place[1] === "−" ? -1 : 1) * (Number(place[2]) * 60 + Number(place[3] ?? 0));
    const truth = offMin(zones[0]);
    if (claimed !== truth) bad.push(`${url}\n      states UTC${hrs(claimed)}, ${zones[0]} is UTC${hrs(truth)}`);
    else ok++;
    return;
  }

  // Pair page: "<B> is N hours ahead of <A>." / "<B> and <A> are on the same time."
  let claimed;
  if (/are on the same time/.test(ans)) claimed = 0;
  else {
    const d = /is\s+(?:(\d+)\s*hours?)?\s*(?:and\s*)?(?:(\d+)\s*minutes?)?\s*(ahead|behind)/.exec(ans);
    if (!d) return skip.set("no answer sentence", (skip.get("no answer sentence") || 0) + 1);
    claimed = (Number(d[1] || 0) * 60 + Number(d[2] || 0)) * (d[3] === "ahead" ? 1 : -1);
  }
  if (zones.length !== 2) return skip.set(`${zones.length} zones on page`, (skip.get(`${zones.length} zones on page`) || 0) + 1);
  const truth = offMin(zones[1]) - offMin(zones[0]);
  // The page names its sides in its own order; the magnitude is the claim.
  if (Math.abs(truth) !== Math.abs(claimed)) {
    bad.push(`${url}\n      states ${hrs(claimed)}h, tzdata says ${hrs(truth)}h (${zones[0]} ${hrs(offMin(zones[0]))} / ${zones[1]} ${hrs(offMin(zones[1]))})`);
  } else ok++;
}

const queue = [...list];
await Promise.all(
  Array.from({ length: CONC }, async () => {
    let u;
    while ((u = queue.shift())) {
      await one(u);
      if (++done % 1000 === 0) console.log(`  ...${done}/${list.length}  mismatches ${bad.length}`);
    }
  })
);

const skipped = [...skip.values()].reduce((a, b) => a + b, 0);
console.log(`\nchecked ${list.length}  verified ${ok}  MISMATCH ${bad.length}  not assertable ${skipped}`);
for (const b of bad) console.log(`  BAD ${b}`);
if (skip.size) console.log(`  (not assertable: ${[...skip].map(([k, v]) => `${k} x${v}`).join(", ")})`);
process.exit(bad.length ? 1 : 0);
