#!/usr/bin/env node
/**
 * Internal link graph audit. docs/05 §5.5 targets: every indexed page has at
 * least 5 inbound internal links and sits within 3 clicks of the home page,
 * and no internal link points at a noindex or 404 URL.
 *
 *   node scripts/link-audit.mjs [baseUrl]
 *
 * Pages rendered on demand (ISR) are not on disk, so any linked path that is
 * missing from the build output is fetched from the running server before the
 * graph is built. Without that, a city linked only from an on-demand country
 * page looks like an orphan.
 *
 * Crawls the rendered HTML of the pre-built pages (fast, no browser) and
 * reports orphans, thin-inbound pages, depth and broken internal links.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, ".next", "server", "app");
if (!existsSync(APP)) {
  console.error("link-audit: run a production build first");
  process.exit(1);
}

/* ------------------------------------------------------------ load the HTML */

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith("_")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (name.endsWith(".html")) out.push(full);
  }
  return out;
}

const urlPathOf = (file) => {
  let rel = relative(APP, file).replace(/\\/g, "/").replace(/\.html$/, "");
  if (rel === "index") return "/";
  return `/${rel.replace(/\/index$/, "")}`;
};

const pages = new Map(); // path -> { indexed, outbound:Set }
const files = walk(APP);

for (const file of files) {
  const html = readFileSync(file, "utf8");
  const path = urlPathOf(file);
  const robots = /<meta\s+name="robots"\s+content="([^"]*)"/i.exec(html)?.[1] ?? "";
  const indexed = !robots.toLowerCase().includes("noindex");

  // Only count links in the document body, and ignore the ones every page
  // carries (header nav + footer), so "inbound links" means editorial links.
  const body = html.slice(html.indexOf("<main"), html.indexOf("</main>") + 7);
  const outbound = new Set();
  for (const m of body.matchAll(/href="(\/[^"#?]*)"/g)) {
    let href = m[1].replace(/\/$/, "") || "/";
    if (href.startsWith("/_next") || href.startsWith("/api")) continue;
    outbound.add(href);
  }
  pages.set(path, { indexed, outbound });
}

/* ------------------------------------- pull in the pages rendered on demand */

const BASE = (process.argv[2] || "http://127.0.0.1:3010").replace(/\/+$/, "");

async function fetchMissing() {
  const wanted = new Set();
  for (const { outbound } of pages.values()) {
    for (const to of outbound) if (!pages.has(to)) wanted.add(to);
  }
  if (!wanted.size) return { added: 0, unreachable: 0, wanted: 0 };
  const list = [...wanted];
  let added = 0;
  let unreachable = 0;
  for (let i = 0; i < list.length; i += 24) {
    const batch = list.slice(i, i + 24);
    await Promise.all(
      batch.map(async (path) => {
        try {
          const res = await fetch(BASE + path, { redirect: "manual" });
          if (res.status !== 200) return;
          const html = await res.text();
          const robots = /<meta\s+name="robots"\s+content="([^"]*)"/i.exec(html)?.[1] ?? "";
          const body = html.slice(html.indexOf("<main"), html.indexOf("</main>") + 7);
          const outbound = new Set();
          for (const m of body.matchAll(/href="(\/[^"#?]*)"/g)) {
            const href = m[1].replace(/\/$/, "") || "/";
            if (href.startsWith("/_next") || href.startsWith("/api")) continue;
            outbound.add(href);
          }
          pages.set(path, { indexed: !robots.toLowerCase().includes("noindex"), outbound, isr: true });
          added++;
        } catch {
          // The server could not be reached. This is not a page that is
          // missing, it is a page we failed to look at, and the difference
          // matters: counting it as absent invents an orphan out of every
          // city whose only editorial link lives on an on-demand country
          // page. Record the blind spot so the report can refuse to assert.
          unreachable++;
        }
      })
    );
  }
  return { added, unreachable, wanted: list.length };
}

const fetchStats = await fetchMissing();
if (fetchStats.added) console.log(`fetched ${fetchStats.added} on-demand page(s) from ${BASE}`);
// Orphans, inbound counts, reachability and depth are all read straight off
// the link graph, so a graph with holes cannot support any of them.
const graphComplete = fetchStats.unreachable === 0;
if (!graphComplete) {
  console.log(
    `link-audit: could not reach ${BASE} for ${fetchStats.unreachable} of ${fetchStats.wanted} linked path(s) rendered on demand`
  );
}
for (const p of pages.keys()) if (!p) pages.delete(p);

/* ------------------------------------------------------------- the graph */

const inbound = new Map();
for (const p of pages.keys()) inbound.set(p, new Set());
const broken = new Map();
const toNoindex = new Map();

for (const [from, { outbound }] of pages) {
  for (const to of outbound) {
    if (to === from) continue;
    const target = pages.get(to);
    if (!target) {
      // Not pre-built. It may still be a valid ISR URL, so only flag paths
      // that cannot exist at all.
      if (!/^\/(time|zones|time-zone|daylight-saving-time|map)\//.test(to) && !/-to-/.test(to)) {
        if (!broken.has(to)) broken.set(to, new Set());
        broken.get(to).add(from);
      }
      continue;
    }
    inbound.get(to).add(from);
    if (!target.indexed) {
      if (!toNoindex.has(to)) toNoindex.set(to, new Set());
      toNoindex.get(to).add(from);
    }
  }
}

/* --------------------------------------------------------------- depth (BFS) */

// The header nav and footer are on every page, so their targets are depth 1
// and can never be orphans however few editorial links point at them.
const GLOBAL = [
  "/",
  "/world-clock",
  "/time-zones",
  "/time-zone-map",
  "/meeting-planner",
  "/what-time-zone-am-i-in",
  "/military-time-converter",
  "/unix-timestamp-converter",
  "/time-calculator",
  "/time-unit-converter",
  "/daylight-saving-time",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
];

const depth = new Map([["/", 0]]);
let frontier = ["/"];
let d = 0;
while (frontier.length && d < 8) {
  d++;
  const next = [];
  for (const p of frontier) {
    const page = pages.get(p);
    if (!page) continue;
    const targets = d === 1 ? new Set([...page.outbound, ...GLOBAL]) : page.outbound;
    for (const t of targets) {
      if (!pages.has(t) || depth.has(t)) continue;
      depth.set(t, d);
      next.push(t);
    }
  }
  frontier = next;
}

/* -------------------------------------------------------------------- report */

const indexedPages = [...pages.entries()].filter(([, v]) => v.indexed).map(([k]) => k);
const globalSet = new Set(GLOBAL);
const orphans = indexedPages.filter((p) => p !== "/" && !globalSet.has(p) && inbound.get(p).size === 0);
const thin = indexedPages.filter((p) => p !== "/" && !globalSet.has(p) && inbound.get(p).size > 0 && inbound.get(p).size < 5);
const deep = indexedPages.filter((p) => (depth.get(p) ?? 99) > 3);
const unreached = indexedPages.filter((p) => !depth.has(p));

const counts = indexedPages.map((p) => inbound.get(p).size).sort((a, b) => a - b);
const median = counts[Math.floor(counts.length / 2)];

const isrCount = [...pages.values()].filter((v) => v.isr).length;
console.log(
  `link-audit: ${pages.size - isrCount} pre-built + ${isrCount} on-demand pages, ${indexedPages.length} indexable`
);
console.log(`inbound links (editorial, excluding header and footer): median ${median}, min ${counts[0]}, max ${counts[counts.length - 1]}`);
const byDepth = {};
for (const p of indexedPages) {
  const k = depth.has(p) ? depth.get(p) : "unreached";
  byDepth[k] = (byDepth[k] ?? 0) + 1;
}
console.log(`clicks from home: ${Object.entries(byDepth).map(([k, v]) => `${k}:${v}`).join(" · ")}`);

// A full report on disk, so the thin and deep sets can be grouped by page type
// and a fix verified against the previous run without re-crawling 8,000 pages.
const REPORT = process.env.LINK_REPORT;
if (REPORT) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    REPORT,
    JSON.stringify(
      {
        totals: { pages: pages.size, indexable: indexedPages.length, median },
        byDepth,
        thin: thin.map((p) => ({ url: p, inbound: inbound.get(p).size, depth: depth.get(p) ?? null })),
        deep: deep.map((p) => ({ url: p, inbound: inbound.get(p).size, depth: depth.get(p) ?? null })),
        orphans,
      },
      null,
      1
    )
  );
  console.log(`link-audit: full report written to ${REPORT}`);
}

const problems = [];
const notAssertable = [];
if (graphComplete) {
  if (orphans.length) problems.push(`${orphans.length} indexable page(s) with no inbound link: ${orphans.slice(0, 8).join(", ")}`);
  if (thin.length) problems.push(`${thin.length} indexable page(s) with fewer than 5 inbound links: ${thin.slice(0, 8).join(", ")}`);
  if (unreached.length) problems.push(`${unreached.length} indexable page(s) unreachable from home: ${unreached.slice(0, 8).join(", ")}`);
  if (deep.length) problems.push(`${deep.length} indexable page(s) more than 3 clicks from home: ${deep.slice(0, 8).join(", ")}`);
} else {
  notAssertable.push(
    `orphans, inbound counts, reachability and depth (${orphans.length}/${thin.length}/${unreached.length}/${deep.length} would have been reported from an incomplete graph)`,
    "re-run against a server that serves the on-demand pages: node scripts/link-audit.mjs https://timetozone.com"
  );
}
if (toNoindex.size) {
  const ex = [...toNoindex.entries()].slice(0, 5).map(([t, f]) => `${t} (from ${[...f][0]})`);
  problems.push(`${toNoindex.size} noindex URL(s) linked from indexable pages: ${ex.join(", ")}`);
}
if (broken.size) {
  const ex = [...broken.entries()].slice(0, 5).map(([t, f]) => `${t} (from ${[...f][0]})`);
  problems.push(`${broken.size} internal link(s) to URLs that cannot exist: ${ex.join(", ")}`);
}

if (notAssertable.length) {
  console.log(`\n${notAssertable.length} thing(s) not assertable:`);
  for (const n of notAssertable) console.log(`  - ${n}`);
}
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  x ${p}`);
  process.exit(1);
}
if (!graphComplete) {
  console.log("\nlink-audit: INCONCLUSIVE - the graph checks could not run");
  process.exit(1);
}
console.log("\nlink-audit: no problems found");
process.exit(0);
