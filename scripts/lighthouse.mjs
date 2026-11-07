#!/usr/bin/env node
/**
 * Lighthouse (mobile) over one template URL per page type. docs/11 §11.4.
 *   node scripts/lighthouse.mjs [baseUrl]
 * Targets: Performance >= 95, SEO 100, Accessibility >= 95, CLS 0.
 */
import { chromium } from "playwright";
import lighthouse from "lighthouse";

const BASE = (process.argv[2] || "http://127.0.0.1:3010").replace(/\/+$/, "");
const URLS = process.argv.slice(3).length
  ? process.argv.slice(3)
  : [
      "/",
      "/pst-to-est",
      "/pst-to-est/9am",
      "/time/uk/london",
      "/time/usa/texas",
      "/zones/est",
      "/daylight-saving-time/usa",
      "/meeting-planner",
      "/time-zones",
      "/world-clock",
    ];

const browser = await chromium.launch({ args: ["--remote-debugging-port=9222"] });
const port = 9222;

/**
 * With AdSense enabled, best-practices cannot reach 95: Google's ad script sets
 * third-party cookies and logs its own console errors, and neither is under
 * this site's control. The score is still reported, and the target without ads
 * is 95. Run with ADS=off to measure the site's own code.
 *
 * Whether ads are live is read from the page being measured, not from this
 * shell's environment: auditing production from a laptop that has no
 * NEXT_PUBLIC_ADSENSE_CLIENT set would otherwise grade a site that does serve
 * ads against the no-ads target and fail for the wrong reason.
 */
async function adsLive() {
  if (process.env.ADS === "off") return false;
  if (process.env.ADS === "on") return true;
  try {
    const html = await (await fetch(BASE + "/")).text();
    return html.includes("adsbygoogle.js");
  } catch {
    return Boolean(process.env.NEXT_PUBLIC_ADSENSE_CLIENT);
  }
}
const ADS = await adsLive();
console.log(`ads ${ADS ? "live on the target — best-practices target 70" : "off — best-practices target 95"}\n`);
const TARGET = { performance: 95, seo: 100, accessibility: 95, "best-practices": ADS ? 70 : 95 };
const fails = [];
const table = [];

for (const path of URLS) {
  const res = await lighthouse(
    BASE + path,
    { port, output: "json", logLevel: "error", onlyCategories: Object.keys(TARGET) },
    undefined
  );
  const c = res.lhr.categories;
  const cls = res.lhr.audits["cumulative-layout-shift"]?.numericValue ?? 0;
  const lcp = res.lhr.audits["largest-contentful-paint"]?.numericValue ?? 0;
  const tbt = res.lhr.audits["total-blocking-time"]?.numericValue ?? 0;
  const score = (k) => Math.round((c[k]?.score ?? 0) * 100);

  const row = {
    path,
    perf: score("performance"),
    a11y: score("accessibility"),
    bp: score("best-practices"),
    seo: score("seo"),
    cls: Number(cls.toFixed(3)),
    lcp: Math.round(lcp),
    tbt: Math.round(tbt),
  };
  table.push(row);
  console.log(
    `${path.padEnd(28)} perf ${String(row.perf).padStart(3)}  a11y ${String(row.a11y).padStart(3)}  ` +
      `bp ${String(row.bp).padStart(3)}  seo ${String(row.seo).padStart(3)}  ` +
      `CLS ${row.cls.toFixed(3)}  LCP ${row.lcp}ms  TBT ${row.tbt}ms`
  );

  for (const [k, min] of Object.entries(TARGET)) {
    const got = score(k);
    if (got < min) fails.push(`${path}: ${k} ${got} < ${min}`);
  }
  if (cls > 0.01) fails.push(`${path}: CLS ${cls.toFixed(3)} > 0`);

  // name the biggest opportunities so a failure is actionable
  if (score("performance") < 100) {
    const ops = Object.values(res.lhr.audits)
      .filter((a) => a.details?.type === "opportunity" && a.numericValue > 150)
      .map((a) => `${a.title} (${Math.round(a.numericValue)}ms)`);
    if (ops.length) console.log(`    opportunities: ${ops.slice(0, 3).join(", ")}`);
  }
  const a11yIssues = Object.values(res.lhr.audits).filter(
    (a) => a.score === 0 && a.scoreDisplayMode === "binary" && c.accessibility?.auditRefs?.some((r) => r.id === a.id)
  );
  if (a11yIssues.length) console.log(`    a11y: ${a11yIssues.map((a) => a.id).join(", ")}`);
}

await browser.close();

const avg = (k) => Math.round(table.reduce((n, r) => n + r[k], 0) / table.length);
console.log(`\naverage — perf ${avg("perf")} · a11y ${avg("a11y")} · best-practices ${avg("bp")} · seo ${avg("seo")}`);

if (fails.length) {
  console.log(`\n${fails.length} below target:`);
  for (const f of fails) console.log(`  x ${f}`);
  process.exit(1);
}
console.log("lighthouse: all targets met");
