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
import { readFileSync } from "node:fs";

const BASE = (process.argv.find((a) => a.startsWith("http")) || "https://timetozone.com").replace(/\/+$/, "");
const LIMIT = Number(process.argv[process.argv.indexOf("--limit") + 1]) || Infinity;
const CONC = Number(process.env.CONC || 24);

const REGIONS = "Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Etc|Europe|Indian|Pacific";
const ZRE = new RegExp(`(?:${REGIONS})(?:\\\\?/[A-Za-z_+-]+){1,2}`, "g");

const offMin = (tz, ms = Date.now()) => {
  const raw = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
    .formatToParts(ms)
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

/* ------------------------------------------------------ DST claims on a page */
// A place page does not only state an offset, it states what happens next:
// "It switches to EDT (UTC-4) on 14 Mar 2027", or "does not observe daylight
// saving time". Nothing checked either, and they are the sentences a reader
// plans around. Both come straight out of tzdata, so both are checkable.
const DAY = 86_400_000;
const transCache = new Map();

/** The next offset change in `tz`, or null if there is none within two years. */
function nextTransition(tz) {
  if (transCache.has(tz)) return transCache.get(tz);
  const now = Date.now();
  const base = offMin(tz, now);
  let lo = null;
  for (let d = 1; d <= 800; d++) {
    if (offMin(tz, now + d * DAY) !== base) { lo = now + (d - 1) * DAY; break; }
  }
  let out = null;
  if (lo !== null) {
    let hi = lo + DAY;
    while (hi - lo > 60_000) {
      const mid = lo + Math.floor((hi - lo) / 2);
      if (offMin(tz, mid) === base) lo = mid;
      else hi = mid;
    }
    out = { at: hi, from: base, to: offMin(tz, hi) };
  }
  transCache.set(tz, out);
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/**
 * The date a transition is named by: the clock reading at the moment it fires,
 * in the offset in force just before it -- the convention the pages use
 * (engine/tz.ts transitionWall).
 *
 * Reading the local time *after* the change is wrong whenever a fall-back
 * crosses midnight backwards. Chile's clocks read 00:00 on 4 April and go back
 * to 23:00 on 3 April, and the change is named for the 4th. Taking the after
 * side made this audit report 22 correct Chilean pages as broken, which is
 * how an audit stops being read.
 */
function transitionDateText(t) {
  const d = new Date(t.at + t.from * 60_000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Check a place page's forward-looking DST sentence. Returns a complaint or null. */
function checkDstClaim(ans, tz) {
  const t = nextTransition(tz);
  const says = /does not observe daylight saving time/i.test(ans);
  const sw = /switches to\s+([A-Za-z0-9:+\u2212-]+)\s*\(\s*UTC([+\u2212-])(\d{1,2})(?::(\d{2}))?\s*\)\s*on\s+(\d{1,2} [A-Za-z]{3} \d{4})/.exec(ans);

  if (says && t) return `claims no daylight saving, but ${tz} changes offset on ${transitionDateText(t)}`;
  if (sw && !t) return `claims a switch on ${sw[5]}, but ${tz} has no transition within two years`;
  if (!sw) return null;

  const claimedOff = (sw[2] === "-" || sw[2] === "\u2212" ? -1 : 1) * (Number(sw[3]) * 60 + Number(sw[4] ?? 0));
  if (claimedOff !== t.to) return `claims it switches to UTC${hrs(claimedOff)}, tzdata says UTC${hrs(t.to)}`;
  const real = transitionDateText(t);
  if (sw[5] !== real) return `claims the switch is on ${sw[5]}, tzdata says ${real}`;
  return null;
}

/* ------------------------------------------- the same-region rule (docs/04 4.2) */
// A page about BST is about the named zone, which means UTC+1 by definition --
// not about whatever Europe/London happens to be doing in November. When both
// sides of a pair are counterpart names for one region (BST/GMT, EDT/EST), the
// engine pins each to a fixed offset so the gap is a constant hour all year.
// tzdata is the wrong oracle for those pages; this is the right one.
const ZONES = (() => {
  const src = readFileSync(new URL("../src/data/zones.ts", import.meta.url), "utf8");
  const map = new Map();
  for (const m of src.matchAll(/\{\s*slug: "([^"]+)"[^\n]*?iana: "([^"]+)", kind: "([^"]+)"[^\n]*?\}/g)) {
    const [, slug, iana, kind] = m;
    const cp = /counterpart: "([^"]+)"/.exec(m[0]);
    map.set(slug, { slug, iana, kind, counterpart: cp?.[1] });
  }
  return map;
})();

/** Standard and daylight offsets for a zone this year; DST is always the larger. */
const seasonal = (tz) => {
  const y = new Date().getUTCFullYear();
  const seen = new Set();
  for (let mo = 0; mo < 12; mo++) {
    const raw = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
      .formatToParts(Date.UTC(y, mo, 15, 12))
      .find((p) => p.type === "timeZoneName").value;
    const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(raw);
    seen.add(raw === "GMT" ? 0 : (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)));
  }
  const vals = [...seen].sort((a, b) => a - b);
  return { std: vals[0], dst: vals.length > 1 ? vals[vals.length - 1] : null };
};

const pinned = (z) => {
  if (z.iana.startsWith("Etc/")) return 0;
  const { std, dst } = seasonal(z.iana);
  if (z.kind === "dst") return dst ?? std;
  if (z.kind === "std") return std;
  return offMin(z.iana);
};

/** If this URL is a counterpart pair, the difference the rule fixes it at. */
function sameRegionDiff(url) {
  const path = new URL(url).pathname.replace(/\/$/, "");
  const seg = path.split("/").filter(Boolean);
  const slug = seg[0] || "";
  const i = slug.indexOf("-to-");
  if (i === -1) return null;
  const key = (p) => p.replace(/-time$/, "");
  const a = ZONES.get(key(slug.slice(0, i)));
  const b = ZONES.get(key(slug.slice(i + 4)));
  if (!a || !b) return null;
  const counterparts = a.counterpart === b.slug || b.counterpart === a.slug;
  if (!counterparts && a.iana !== b.iana) return null;
  return pinned(b) - pinned(a);
}

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

  // "Georgia is on Eastern Standard Time - UTC+4 (UTC-5) right now": the
  // abbreviation came from one zone and the offset from another. When a page
  // prints a bare offset in place of an abbreviation, the two must agree.
  const both = /–\s*(UTC[+−-][\d:]+)\s*\(\s*(UTC[+−-][\d:]+)\s*\)/.exec(ans);
  if (both && both[1].replace(/\s/g, "") !== both[2].replace(/\s/g, "")) {
    bad.push(`${url}\n      names the zone ${both[1]} but gives the offset ${both[2]}`);
    return;
  }

  // Place page: "<Place> is on <Name> - ABBR ( UTC-8 ) right now."
  const place = /\(\s*UTC([+−-])(\d{1,2})(?::(\d{2}))?\s*\)\s*right now/.exec(ans);
  if (place && zones.length >= 1) {
    const claimed = (place[1] === "-" || place[1] === "−" ? -1 : 1) * (Number(place[2]) * 60 + Number(place[3] ?? 0));
    const truth = offMin(zones[0]);
    if (claimed !== truth) {
      bad.push(`${url}\n      states UTC${hrs(claimed)}, ${zones[0]} is UTC${hrs(truth)}`);
      return;
    }
    // Only single-zone pages make a forward-looking claim about one zone.
    if (!/has more than one time zone/.test(ans)) {
      const complaint = checkDstClaim(ans, zones[0]);
      if (complaint) {
        bad.push(`${url}\n      ${complaint}`);
        return;
      }
    }
    ok++;
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
  const fixedByRule = sameRegionDiff(url);
  if (fixedByRule !== null) {
    if (Math.abs(fixedByRule) !== Math.abs(claimed)) {
      bad.push(`${url}\n      states ${hrs(claimed)}h, same-region rule fixes it at ${hrs(fixedByRule)}h`);
    } else ok++;
    return;
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
