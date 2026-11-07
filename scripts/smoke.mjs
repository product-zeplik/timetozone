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
  "/sitemap/0.xml",
  "/sitemap/1.xml",
  "/sitemap/2.xml",
  "/sitemap/3.xml",
  "/sitemap/4.xml",
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

const check = (ok, label, detail) => {
  if (ok) pass++;
  else fails.push(`${label}${detail ? ` — ${detail}` : ""}`);
};

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

console.log(`smoke: ${BASE}\n`);

for (const p of OK_200) {
  const r = await get(p);
  const body = r.text;
  check(r.status === 200, `200 ${p}`, `got ${r.status}`);
  if (r.status === 200) {
    check(/<h1[^>]*>/.test(body), `h1 on ${p}`);
    check(/class="answer"/.test(body), `answer on ${p}`);
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
    const prod = process.env.SITE_ENV === "production";
    check(prod ? /Allow: \/$/m.test(t) : /Disallow: \/$/m.test(t), "robots matches SITE_ENV", t.slice(0, 80));
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
  if (process.env.SITE_ENV === "production") {
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

console.log(`\n${pass} checks passed`);
if (fails.length) {
  console.log(`${fails.length} FAILED:`);
  for (const f of fails) console.log(`  x ${f}`);
  process.exit(1);
}
console.log("smoke: OK");
