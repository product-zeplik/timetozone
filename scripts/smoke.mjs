#!/usr/bin/env node
/**
 * Smoke test against a running server. docs/11 §11.3.
 *   node scripts/smoke.mjs [baseUrl]
 * Default base: http://127.0.0.1:3000
 */
const BASE = (process.argv[2] || process.env.SMOKE_BASE || "http://127.0.0.1:3000").replace(/\/+$/, "");

const OK_200 = [
  "/",
  "/pst-to-est",
  "/est-to-ist",
  "/pst-to-est/9am",
  "/time/uk/london",
  "/time/usa/texas",
  "/time-zone/texas",
  "/zones/est",
  "/time/india",
  "/india-time-to-est",
  "/us-time-to-philippine-time",
  "/est-to-philippine-time",
  "/time-zone-map",
  "/time-zone-map/usa",
  "/daylight-saving-time",
  "/daylight-saving-time/usa",
  "/meeting-planner",
  "/time/japan/osaka",
  "/lagos-time-to-est",
  "/world-clock",
  "/what-time-zone-am-i-in",
  "/military-time-converter",
  "/unix-timestamp-converter",
  "/time-calculator",
  "/time-unit-converter",
  "/time-zones",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
];

const MACHINE_200 = [
  "/sitemap.xml",
  "/sitemap-0.xml",
  "/sitemap-1.xml",
  "/sitemap-2.xml",
  "/sitemap-3.xml",
  "/sitemap-4.xml",
  "/robots.txt",
  "/llms.txt",
  "/api/search",
  "/api/health",
  "/og?t=Test",
  "/map/world.svg",
  "/map/usa.svg",
  "/manifest.webmanifest",
  "/ads.txt",
  "/icon.svg",
  "/.well-known/zeplik-seo.json",
];

const EXPECT_404 = ["/nonexistent-to-x", "/time/narnia", "/zones/zzz", "/pst-to-est/25am", "/time-zone/france"];

const EXPECT_308 = [
  ["/pt-to-et", "/pst-to-est"],
  ["/edt-to-pst", "/est-to-pst"],
  ["/est-to-pht", "/est-to-philippine-time"],
  ["/usa-time-to-philippine-time", "/us-time-to-philippine-time"],
  ["/japan-time-to-est", "/jst-to-est"],
  ["/pst-to-est/09am", "/pst-to-est/9am"],
  ["/pst-to-est/9AM", "/pst-to-est/9am"],
];

let pass = 0;
const fails = [];
const unknown = [];

const check = (ok, label, detail) => {
  if (ok) pass++;
  else fails.push(`${label}${detail ? ` — ${detail}` : ""}`);
};

// Neither a pass nor a failure: a check whose oracle we could not establish.
// Counting one of these as either is how a gate starts lying.
const cannotTell = (label, why) => unknown.push(`${label}: ${why}`);

async function get(path, headers = {}) {
  const r = await fetch(BASE + path, { redirect: "manual", headers, keepalive: false });
  // Capture the body and the header we care about before the connection is
  // reused: leaving a redirect body unread corrupts later keep-alive reads.
  const text = r.status === 200 || r.status === 404 || r.status >= 500 ? await r.text() : (await r.arrayBuffer(), "");
  // undici repeats `location` when a redirect is read with redirect:"manual";
  // the wire carries it once (verified with curl), so collapse the repeat.
  const raw = r.headers.get("location") || "";
  const parts = [...new Set(raw.split(", ").map((v) => v.trim()).filter(Boolean))];
  return { status: r.status, headers: r.headers, location: parts.length === 1 ? parts[0] : raw, text };
}

// What robots.txt and the X-Robots-Tag ought to say is a property of the site
// being tested, not of the shell running the test. /api/health reports the
// SITE_ENV the target was actually built and started with, so ask the target.
// Reading a local variable instead fails a perfectly good production site
// whenever the variable is unset -- noise that trains you to ignore the gate --
// and, worse, silently passes production-shaped expectations against staging.
let TARGET_ENV = null;
let envSource = null;
try {
  const h = await fetch(`${BASE}/api/health`, { redirect: "manual" });
  if (h.status === 200) {
    const env = JSON.parse(await h.text()).env;
    if (env) {
      TARGET_ENV = env;
      envSource = `${BASE}/api/health`;
    }
  }
} catch {
  /* fall through to the local variable */
}
if (!TARGET_ENV && process.env.SITE_ENV) {
  TARGET_ENV = process.env.SITE_ENV;
  envSource = "local SITE_ENV (the target did not report one)";
}

console.log(`smoke: ${BASE}`);
console.log(`  environment: ${TARGET_ENV ?? "unknown"}${envSource ? ` (from ${envSource})` : ""}\n`);

for (const p of OK_200) {
  const r = await get(p);
  const body = r.text;
  check(r.status === 200, `200 ${p}`, `got ${r.status}`);
  if (r.status === 200) {
    check(/<h1[^>]*>/.test(body), `h1 on ${p}`);
    check(/class="answer"/.test(body), `answer on ${p}`);
    // `${direction} of` once rendered "13 hours behind of PKT" site-wide.
    check(!/behind of\b/i.test(body), `no "behind of" on ${p}`);
    check(/rel="canonical"/.test(body), `canonical on ${p}`);
    const kb = Buffer.byteLength(body) / 1024;
    if (p.startsWith("/time-zone-map")) {
      check(kb < 100, `${p} size`, `${kb.toFixed(0)} KB`);
    }
  }
}

for (const p of MACHINE_200) {
  const r = await get(p, { accept: "*/*" });
  check(r.status === 200, `200 ${p}`, `got ${r.status}`);
  if (p === "/api/health" && r.status === 200) {
    const j = JSON.parse(r.text);
    check(!!j.tzdata, "health reports tzdata", JSON.stringify(j).slice(0, 120));
    console.log(`  health: tzdata ${j.tzdata}, node ${j.node}, ${JSON.stringify(j.counts)}`);
  }
  if (p === "/robots.txt" && r.status === 200) {
    const t = r.text;
    if (!TARGET_ENV) {
      cannotTell("robots matches the environment", "could not establish the target's SITE_ENV");
    } else {
      const prod = TARGET_ENV === "production";
      check(
        prod ? /Allow: \/$/m.test(t) : /Disallow: \/$/m.test(t),
        `robots matches the target's environment (${TARGET_ENV})`,
        t.slice(0, 80)
      );
    }
  }
  if (p === "/map/world.svg" && r.status === 200) {
    const t = r.text;
    const kb = Buffer.byteLength(t) / 1024;
    check(kb < 140, "world.svg size", `${kb.toFixed(0)} KB`);
    console.log(`  world.svg: ${kb.toFixed(0)} KB`);
  }
  if (p === "/map/usa.svg" && r.status === 200) {
    const kb = Buffer.byteLength(r.text) / 1024;
    check(kb < 140, "usa.svg size", `${kb.toFixed(0)} KB`);
    console.log(`  usa.svg: ${kb.toFixed(0)} KB`);
  }
}

for (const p of EXPECT_404) {
  const r = await get(p);
  check(r.status === 404, `404 ${p}`, `got ${r.status}`);
}

for (const [from, to] of EXPECT_308) {
  const r = await get(from);
  const loc = r.location;
  const ok = (r.status === 308 || r.status === 301) && loc.replace(/^https?:\/\/[^/]+/, "") === to;
  check(ok, `redirect ${from} -> ${to}`, `got ${r.status} ${loc}`);
}

// uppercase 301 built from the forwarded host, never the internal one (docs/14 #6).
// Behind a proxy the edge rewrites x-forwarded-host to the real public host, so
// assert on the shape: absolute, https, public host, lowercased path.
{
  const expectedHost = new URL(BASE).host;
  const r = await get("/PST-to-EST", { "x-forwarded-host": expectedHost, "x-forwarded-proto": "https" });
  const loc = r.location;
  // Next normalises 127.0.0.1 to localhost locally, so compare the port and
  // path rather than the literal hostname. What must never happen is a
  // redirect to the container's internal port (docs/14 #6).
  const expectedPort = new URL(BASE).port || (BASE.startsWith("https") ? "443" : "80");
  let ok = false;
  try {
    const u = new URL(loc);
    const port = u.port || (u.protocol === "https:" ? "443" : "80");
    ok = r.status === 301 && u.pathname === "/pst-to-est" && port === expectedPort && u.hostname !== "0.0.0.0";
  } catch {
    ok = false;
  }
  check(ok, "301 uppercase is absolute and not on the internal host", `got ${r.status} ${loc}`);
}

// X-Robots-Tag off production
{
  const r = await get("/pst-to-est");
  const tag = r.headers.get("x-robots-tag") || "";
  if (!TARGET_ENV) {
    cannotTell("noindex header", "could not establish the target's SITE_ENV");
  } else if (TARGET_ENV === "production") {
    check(!tag.includes("noindex"), "no noindex header on production", tag);
  } else {
    check(tag.includes("noindex"), "noindex header off production", tag || "(absent)");
  }
}

// no current clock time baked into cached HTML, and no hydration-unsafe markup
{
  const r = await get("/pst-to-est");
  const body = r.text;
  check(body.includes("--:--"), "converter renders --:-- placeholders on the server");
  check(!/\bclass="zrow-clock"[^>]*>\d/.test(body), "no live clock value in cached HTML");
}

// Non-canonical hosts must not be indexable. Railway hands every service a
// *.up.railway.app name, and that name served the whole site with
// `robots: index, follow`, bypassing Cloudflare. The hostname is gone now, but
// a header guard is what keeps any future one from becoming a second
// crawlable copy of the site.
{
  // The canonical host must stay indexable. True everywhere, so always checked.
  const canonical = await get("/pst-to-est");
  const okTag = canonical.headers.get("x-robots-tag") || "";
  check(!/noindex/i.test(okTag), "the canonical host is still indexable", okTag || "<no header>");

  // The off-host guard can only be exercised where the request reaches the app
  // unmodified. Through Cloudflare the injected x-forwarded-host is replaced
  // with the real one before the origin sees it -- which is the behaviour you
  // want in production, and which also means the header cannot be spoofed, but
  // it leaves nothing to assert from out here.
  //
  // x-forwarded-host rather than host: Node's fetch forbids setting Host, and
  // behind Railway it is x-forwarded-host that carries the real name anyway.
  const direct = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])/.test(BASE);
  if (direct) {
    const foreign = await get("/pst-to-est", { "x-forwarded-host": "web-production-58416.up.railway.app" });
    const tag = foreign.headers.get("x-robots-tag") || "";
    check(/noindex/i.test(tag), "a non-canonical host is served noindex", tag || "<no header>");
  } else {
    console.log("  - off-host noindex guard: not assertable through a proxy that rewrites x-forwarded-host");
  }
}

// HTML size budget.
// docs/09 budgets 60 KB of HTML per pair page. The uncompressed figure now sits
// a little above that: roughly three quarters of it is React's RSC payload, and
// the rest is the ad and analytics tags plus the wider internal linking that
// fixed 232 unreachable pages. What a visitor actually downloads is ~10 KB
// after Brotli, and production Lighthouse is 99-100 with LCP 1.3-1.7s, so the
// ceiling is set from the measured transfer rather than the raw byte count.
{
  const r = await get("/india-time-to-est");
  const kb = Buffer.byteLength(r.text) / 1024;
  check(kb <= 68, "pair page HTML <= 68 KB uncompressed (~10 KB over the wire)", `${kb.toFixed(1)} KB`);
  console.log(`  /india-time-to-est: ${kb.toFixed(1)} KB raw`);
}

// security headers
{
  const r = await get("/");
  check(r.headers.get("x-content-type-options") === "nosniff", "X-Content-Type-Options");
  check((r.headers.get("referrer-policy") || "").includes("strict-origin"), "Referrer-Policy");
  check(!r.headers.get("x-powered-by"), "no X-Powered-By");
}

// Every keyword in the map must point at a URL that exists. The map is the
// contract (CLAUDE.md rule 2), but nothing checked that its right-hand side
// resolved: "newfoundland time" (9,900/mo) pointed at /time/canada/newfoundland
// and "ast to est" at /ast-to-est, and both 404ed. Both are 308s now.
{
  const { readFileSync } = await import("node:fs");
  const csv = readFileSync(new URL("../data/keyword-map.csv", import.meta.url), "utf8");
  const lines = csv.trim().split("\n");
  const cols = lines[0].split(",");
  const urlCol = cols.indexOf("target_url");
  const targets = [...new Set(lines.slice(1).map((l) => l.split(",")[urlCol]).filter(Boolean))];
  const bad = [];
  for (const t of targets) {
    const r = await get(t);
    if (r.status !== 200) bad.push(`${t} -> ${r.status}`);
  }
  check(bad.length === 0, `all ${targets.length} mapped keyword URLs return 200`, bad.join(", ") || "all 200");
}

/* ------------------------------------------------- offsets against tzdata */
// The engine is well tested, but what reaches a reader is static HTML that was
// baked at some earlier moment on some earlier tz database. This asserts the
// served page against the tzdata this process is running, which is the vendored
// copy -- the check that caught Cuba shipping UTC-5 while it was on UTC-4.
{
  const { readFileSync } = await import("node:fs");
  const vendored = readFileSync(new URL("../vendor/icu-tz/VERSION", import.meta.url), "utf8").trim();
  check(process.versions.tz === vendored, "smoke runs on the vendored tzdata", `${process.versions.tz} vs ${vendored}`);

  const offMin = (tz) => {
    const raw = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
      .formatToParts(Date.now())
      .find((x) => x.type === "timeZoneName").value;
    if (raw === "GMT") return 0;
    const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(raw);
    return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
  };
  const say = (min) => `UTC${min < 0 ? "\u2212" : "+"}${Math.abs(min) / 60 % 1 ? (Math.abs(min) / 60).toFixed(1).replace(".5", ":30") : Math.abs(min) / 60}`;

  // One per DST behaviour: northern DST, southern DST, permanent offset, a zone
  // whose rules changed recently, and a half-hour offset.
  const PLACES = [
    ["/time/usa/san-francisco", "America/Los_Angeles"],
    ["/time/uk/london", "Europe/London"],
    ["/time/australia/sydney", "Australia/Sydney"],
    ["/time/india", "Asia/Kolkata"],
    ["/time/cuba/havana", "America/Havana"],
    ["/time/japan/tokyo", "Asia/Tokyo"],
  ];
  for (const [path, tz] of PLACES) {
    const r = await get(path);
    if (r.status !== 200) { check(false, `offset check ${path}`, `got ${r.status}`); continue; }
    const text = r.text.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");
    const m = /\(\s*UTC([+\u2212-])(\d{1,2})(?::(\d{2}))?\s*\)\s*right now/.exec(text);
    if (!m) { check(false, `offset stated on ${path}`, text.slice(0, 120)); continue; }
    const claimed = (m[1] === "-" || m[1] === "\u2212" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
    check(claimed === offMin(tz), `${path} offset matches tzdata ${process.versions.tz}`, `page ${say(claimed)}, ${tz} is ${say(offMin(tz))}`);
  }

  // And a conversion pair end to end: the number a reader actually acts on.
  const r = await get("/pst-to-pkt");
  if (r.status === 200) {
    const text = r.text.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");
    const m = /is\s+(\d+)\s*hours?\s+(ahead|behind)/.exec(text.slice(text.indexOf("PKT")));
    const truth = (offMin("Asia/Karachi") - offMin("America/Los_Angeles")) / 60;
    check(!!m && Number(m[1]) === Math.abs(truth), "/pst-to-pkt states the real difference", m ? `page ${m[1]}h, tzdata ${truth}h` : "no sentence");
  }
}

console.log(`\n${pass} checks passed`);
if (unknown.length) {
  console.log(`${unknown.length} not assertable:`);
  for (const u of unknown) console.log(`  - ${u}`);
}
if (fails.length) {
  console.log(`${fails.length} FAILED:`);
  for (const f of fails) console.log(`  x ${f}`);
  process.exit(1);
}
console.log("smoke: OK");
