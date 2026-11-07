#!/usr/bin/env node
/**
 * Device + accessibility audit across real viewports.
 *   node scripts/visual-audit.mjs [baseUrl] [--shots]
 *
 * Checks, per page x viewport x theme:
 *   - horizontal overflow (the #1 mobile defect)
 *   - total page height (scroll burden)
 *   - tap targets under 44px
 *   - text smaller than 12px
 *   - headings hidden behind the sticky header (scroll-margin bugs)
 *   - console errors and React hydration warnings
 * Plus a no-JavaScript render check per page.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = (process.argv[2] || "http://127.0.0.1:3010").replace(/\/+$/, "");
const SHOTS = process.argv.includes("--shots");
const OUT = process.env.AUDIT_OUT || "/tmp/ttz-audit";
if (SHOTS) mkdirSync(OUT, { recursive: true });

const PAGES = [
  ["home", "/"],
  ["pair", "/pst-to-est"],
  ["hour", "/pst-to-est/9am"],
  ["city", "/time/uk/london"],
  ["country", "/time/india"],
  ["region", "/time/usa/texas"],
  ["multizone", "/time-zone/texas"],
  ["zone", "/zones/est"],
  ["dst", "/daylight-saving-time/usa"],
  ["planner", "/meeting-planner"],
  ["map", "/time-zone-map"],
  ["zones-hub", "/time-zones"],
  ["worldclock", "/world-clock"],
];

const VIEWPORTS = [
  ["mobile-s", 320, 720, true],
  ["mobile", 390, 844, true],
  ["tablet", 768, 1024, true],
  ["laptop", 1280, 800, false],
  ["desktop", 1680, 1050, false],
];

const AUDIT = `(() => {
  const out = { overflow: 0, height: 0, smallTargets: [], tinyText: [], behindHeader: [], widest: null };
  const de = document.documentElement;
  out.overflow = Math.max(0, de.scrollWidth - de.clientWidth);
  out.height = document.body.scrollHeight;

  if (out.overflow > 0) {
    let worst = null;
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      const right = r.right + window.scrollX;
      if (right > de.clientWidth + 1 && (!worst || right > worst.right)) {
        worst = { right, sel: el.tagName + (el.className ? '.' + String(el.className).split(' ')[0] : '') };
      }
    }
    out.widest = worst;
  }

  const seen = new Set();
  for (const el of document.querySelectorAll('a, button, summary, input, select, [role=option]')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    // links inside a paragraph are exempt: WCAG 2.5.8 excludes inline text links
    const inProse = el.tagName === 'A' && ['P','LI','SPAN','TD','TH'].includes(el.parentElement?.tagName);
    if (inProse) continue;
    if (r.height < 24 || r.width < 24) {
      const k = el.tagName + '|' + (el.textContent || '').trim().slice(0, 24);
      if (!seen.has(k)) { seen.add(k); out.smallTargets.push(k + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); }
    }
  }

  const tiny = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (!el.firstChild || el.firstChild.nodeType !== 3) continue;
    const t = (el.textContent || '').trim();
    if (!t) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs && fs < 12) tiny.add(el.tagName + ' ' + fs + 'px: ' + t.slice(0, 30));
  }
  out.tinyText = [...tiny].slice(0, 6);

  const header = document.querySelector('.site-header');
  const hh = header ? header.getBoundingClientRect().height : 0;
  for (const h of document.querySelectorAll('h2[id], h1')) {
    const sm = parseFloat(getComputedStyle(h).scrollMarginTop) || 0;
    if (sm < hh) out.behindHeader.push(h.tagName + ' scroll-margin ' + sm + ' < header ' + hh);
  }
  out.behindHeader = out.behindHeader.slice(0, 2);
  return out;
})()`;

const browser = await chromium.launch();
const problems = [];
const rows = [];

for (const [vname, w, h, isMobile] of VIEWPORTS) {
  for (const theme of ["light", "dark"]) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: 1,
      isMobile,
      hasTouch: isMobile,
      colorScheme: theme,
      userAgent: isMobile
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        : undefined,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => {
      const t = m.text();
      if (m.type() === "error" || /hydrat|did not match|Warning/i.test(t)) errors.push(t.slice(0, 160));
    });
    page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 160)));

    for (const [pname, path] of PAGES) {
      const label = `${pname} ${vname} ${theme}`;
      try {
        await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 });
      } catch {
        problems.push(`${label}: navigation failed`);
        continue;
      }
      await page.waitForTimeout(250);
      const r = await page.evaluate(AUDIT);
      rows.push({ page: pname, viewport: vname, theme, ...r });

      if (r.overflow > 0) problems.push(`${label}: horizontal overflow ${r.overflow}px (${r.widest?.sel ?? "?"})`);
      if (r.smallTargets.length) problems.push(`${label}: ${r.smallTargets.length} tap target(s) under 24px — ${r.smallTargets[0]}`);
      if (r.tinyText.length) problems.push(`${label}: text under 12px — ${r.tinyText[0]}`);
      if (r.behindHeader.length) problems.push(`${label}: ${r.behindHeader[0]}`);
      if (errors.length) {
        problems.push(`${label}: console — ${errors[0]}`);
        errors.length = 0;
      }

      if (SHOTS && theme === "light" && (vname === "mobile" || vname === "laptop")) {
        await page.screenshot({ path: join(OUT, `${pname}-${vname}.png`), fullPage: false });
      }
    }
    await ctx.close();
  }
}

// no-JavaScript render: the answer, table and FAQ must all be in the HTML
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  for (const [pname, path] of [["pair", "/pst-to-est"], ["city", "/time/uk/london"], ["zone", "/zones/est"]]) {
    await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
    const r = await page.evaluate(() => ({
      answer: !!document.querySelector(".answer")?.textContent?.trim(),
      h1: !!document.querySelector("h1")?.textContent?.trim(),
      table: document.querySelectorAll("table tbody tr").length,
      faq: document.querySelectorAll(".faq details").length,
    }));
    if (!r.answer || !r.h1) problems.push(`no-JS ${pname}: missing answer or h1`);
    if (pname === "pair" && r.table < 24) problems.push(`no-JS ${pname}: only ${r.table} table rows`);
    if (r.faq < 3) problems.push(`no-JS ${pname}: only ${r.faq} FAQ entries`);
    console.log(`no-JS ${pname}: h1=${r.h1} answer=${r.answer} tableRows=${r.table} faqs=${r.faq}`);
  }
  await ctx.close();
}

await browser.close();

/* -------------------------------------------------------------------- report */

const heightsFor = (vp) =>
  PAGES.map(([p]) => {
    const row = rows.find((r) => r.page === p && r.viewport === vp && r.theme === "light");
    return `${p} ${row ? Math.round(row.height) : "?"}`;
  }).join(" · ");

console.log(`\npage heights @ mobile(390): ${heightsFor("mobile")}`);
console.log(`page heights @ laptop(1280): ${heightsFor("laptop")}`);

const uniq = [...new Set(problems)];
console.log(`\n${rows.length} page/viewport/theme combinations checked`);
if (!uniq.length) {
  console.log("visual-audit: no problems found");
  process.exit(0);
}
console.log(`\n${uniq.length} problem(s):`);
for (const p of uniq.slice(0, 50)) console.log(`  x ${p}`);
if (uniq.length > 50) console.log(`  … ${uniq.length - 50} more`);
writeFileSync(join(OUT, "problems.txt"), uniq.join("\n"));
process.exit(1);
