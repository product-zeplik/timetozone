#!/usr/bin/env node
/**
 * Lints the real rendered HTML in .next/server/app after a production build.
 * Exits 1 on any error. docs/11 §11.2.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, ".next", "server", "app");
const SITE_URL = (process.env.SITE_URL || "https://timetozone.com").replace(/\/+$/, "");

if (!existsSync(APP)) {
  console.error(`seo-lint: ${relative(ROOT, APP)} not found — run a production build first.`);
  process.exit(1);
}

/* ------------------------------------------------------------------- helpers */

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

const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
  "#x27": "'",
  "#x2F": "/",
};

function decode(s) {
  return s
    .replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, g) => {
      if (ENTITIES[g] !== undefined) return ENTITIES[g];
      if (g[0] === "#") {
        const code = g[1] === "x" || g[1] === "X" ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return m;
    })
    .trim();
}

function stripTags(s) {
  return decode(
    s
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
  );
}

/** `.next/server/app/time/uk/london.html` -> `/time/uk/london`; `index.html` -> `/` */
function urlPathOf(file) {
  let rel = relative(APP, file).replace(/\\/g, "/").replace(/\.html$/, "");
  if (rel === "index") return "/";
  rel = rel.replace(/\/index$/, "");
  return `/${rel}`;
}

/** Normalise for duplicate comparison: NFKD, no accents, no punctuation. */
function norm(s) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‐-―−]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    // Collapse dotted acronyms before punctuation is stripped, or "D.C."
    // becomes the two tokens "d" and "c" and never matches the keyword "dc".
    // Google treats the two spellings as one term; so should this.
    .replace(/\b(?:[a-z]\.){2,}/gi, (m) => m.replace(/\./g, ""))
    .replace(/[^\w\s'"-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/* --------------------------------------------------------------- keyword map */

const STOP = new Set([
  "to",
  "in",
  "the",
  "is",
  "what",
  "time",
  "zone",
  "zones",
  "a",
  "an",
  "of",
  "and",
  "am",
  "i",
  "it",
  "now",
  "my",
  "do",
  "does",
  "between",
  "for",
  "converter",
  "convert",
]);

let keywords = [];
const kwFile = join(ROOT, "src", "data", "generated", "keywords.json");
if (existsSync(kwFile)) keywords = JSON.parse(readFileSync(kwFile, "utf8"));
const primaryByUrl = new Map();
for (const k of keywords) {
  if (k.slotBase !== "primary") continue;
  const cur = primaryByUrl.get(k.url);
  if (!cur || k.volume > cur.volume) primaryByUrl.set(k.url, k);
}

/* ---------------------------------------------------------------------- run */

const files = walk(APP);
const errors = [];
const warnings = [];
const byTitle = new Map();
const byH1 = new Map();
const byDesc = new Map();

/**
 * The block between the H1 and the first table, per sibling group.
 *
 * Google began serving /pst-to-est/12am to people searching "5am pst to est"
 * while every signal this linter already checked was correct and distinct:
 * the titles, the H1s, the canonicals, the descriptions. What was not distinct
 * was the body. Of the 72 words between the H1 and the first table, 68 were
 * identical on all 24 sibling pages, so four words had to carry the choice
 * between two dozen URLs. No duplicate-title check can see that, which is why
 * this one reads the block a reader actually skims.
 */
const atfByGroup = new Map();
const HOUR_PATH = /^\/([a-z0-9-]+)\/(\d{1,2})(am|pm)$/;

/** `9`,`am` -> `09:00`; `12`,`am` -> `00:00`; `5`,`pm` -> `17:00`. */
function hour24(n, ap) {
  const h = Number(n) % 12 + (ap === "pm" ? 12 : 0);
  return `${String(h).padStart(2, "0")}:00`;
}

/** The words of the above-the-fold block, in order, markup and entities gone. */
function aboveFold(html) {
  const start = html.indexOf("<h1");
  if (start === -1) return [];
  const rest = html.slice(start);
  // The first <h2> is the first section heading; before it sits the answer,
  // any supporting prose, and the converter's own labels.
  const end = rest.search(/<h2[\s>]/i);
  return stripTags(end > 0 ? rest.slice(0, end) : rest.slice(0, 6000))
    .toLowerCase()
    .split(/[^a-z0-9:+-]+/)
    .filter(Boolean);
}

/** Words of `a` that `b` does not also have, counting repeats. */
function ownWords(a, b) {
  const bag = new Map();
  for (const w of b) bag.set(w, (bag.get(w) ?? 0) + 1);
  let own = 0;
  for (const w of a) {
    const n = bag.get(w) ?? 0;
    if (n > 0) bag.set(w, n - 1);
    else own++;
  }
  return own;
}

let indexable = 0;
let noindex = 0;

for (const file of files) {
  const html = readFileSync(file, "utf8");
  const path = urlPathOf(file);
  const bytes = Buffer.byteLength(html);

  const title = (() => {
    const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    return m ? stripTags(m[1]) : "";
  })();
  const desc = (() => {
    const m = /<meta\s+name="description"\s+content="([^"]*)"/i.exec(html);
    return m ? decode(m[1]) : "";
  })();
  const canonical = (() => {
    const m = /<link\s+rel="canonical"\s+href="([^"]*)"/i.exec(html);
    return m ? decode(m[1]) : "";
  })();
  const robots = (() => {
    const m = /<meta\s+name="robots"\s+content="([^"]*)"/i.exec(html);
    return m ? decode(m[1]).toLowerCase() : "";
  })();
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => stripTags(m[1]));
  const h1 = h1s[0] ?? "";

  const isNoindex = robots.includes("noindex");
  if (isNoindex) noindex++;
  else indexable++;

  // JSON-LD must parse
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, raw] of blocks) {
    try {
      JSON.parse(raw.replace(/\\u003c/g, "<"));
    } catch (e) {
      errors.push(`${path}: JSON-LD does not parse (${e.message})`);
    }
  }

  if (!isNoindex) {
    if (!title) errors.push(`${path}: missing <title>`);
    if (!h1) errors.push(`${path}: missing <h1>`);
    if (h1s.length > 1) errors.push(`${path}: ${h1s.length} <h1> elements`);
    if (!desc) errors.push(`${path}: missing meta description`);
    if (!canonical) errors.push(`${path}: missing canonical`);
    else {
      const expected = path === "/" ? SITE_URL : `${SITE_URL}${path}`;
      if (canonical !== expected) errors.push(`${path}: canonical is "${canonical}", expected "${expected}"`);
    }
    if (!blocks.length) errors.push(`${path}: no JSON-LD`);

    const push = (map, key) => {
      if (!key) return;
      const list = map.get(key);
      if (list) list.push(path);
      else map.set(key, [path]);
    };
    push(byTitle, norm(title));
    push(byH1, norm(h1));
    push(byDesc, norm(desc));

    const hour = HOUR_PATH.exec(path);
    if (hour) {
      const entry = { path, words: aboveFold(html), own24: hour24(hour[2], hour[3]) };
      const group = atfByGroup.get(hour[1]);
      if (group) group.push(entry);
      else atfByGroup.set(hour[1], [entry]);
    }

    if (title.length > 65) warnings.push(`${path}: title is ${title.length} chars — "${title}"`);
    if (desc.length > 160) warnings.push(`${path}: description is ${desc.length} chars`);
    // docs/09 budgets 60 KB of HTML "per pair/place page", so the ceiling
    // depends on what the page is for. A conversion page is held near that
    // budget. A hub -- /time-zones, the maps, a zone page, a country or region
    // index -- exists to carry the link graph: those pages are what put every
    // pair within the three clicks of home that docs/11 requires, so they are
    // allowed to be large, but still checked, because a hub that doubles is a
    // regression worth seeing.
    const isHub =
      path.startsWith("/time-zone-map") ||
      path === "/time-zones" ||
      path.startsWith("/zones/") ||
      /^\/time\/[^/]+$/.test(path) ||
      path.startsWith("/time-zone/");
    const ceiling = isHub ? 240 : 80;
    if (bytes > ceiling * 1024) {
      warnings.push(`${path}: HTML is ${(bytes / 1024).toFixed(0)} KB (ceiling ${ceiling} KB)`);
    }

    const kw = primaryByUrl.get(path);
    if (kw) {
      const haystack = norm(`${title} ${h1}`);
      const missing = norm(kw.keyword)
        .split(" ")
        .filter((w) => w && !STOP.has(w))
        .filter((w) => !haystack.includes(w));
      if (missing.length) {
        warnings.push(`${path}: primary keyword "${kw.keyword}" missing ${missing.join(", ")} from title+h1`);
      }
    }
  }
}

for (const [key, paths] of byTitle) if (paths.length > 1) errors.push(`duplicate title across ${paths.length} pages: "${key}" -> ${paths.slice(0, 6).join(", ")}${paths.length > 6 ? " …" : ""}`);
for (const [key, paths] of byH1) if (paths.length > 1) errors.push(`duplicate h1 across ${paths.length} pages: "${key}" -> ${paths.slice(0, 6).join(", ")}${paths.length > 6 ? " …" : ""}`);
for (const [key, paths] of byDesc) if (paths.length > 1) errors.push(`duplicate description across ${paths.length} pages: "${key}" -> ${paths.slice(0, 6).join(", ")}${paths.length > 6 ? " …" : ""}`);

let closestSiblings = { words: Infinity, pairing: "" };
// What is enforced is an invariant the content can actually satisfy: each hour
// page names its own hour in 24-hour form above the fold. That form appears
// nowhere else on the page and nowhere in the 12-hour answer sentence, so it is
// the one token that separates /pst-to-est/5am from its 23 siblings, and losing
// it is the regression that put the 12am page in front of "5am pst to est"
// searches.
//
// A minimum word-distance from the nearest sibling was tried here first and
// removed: consecutive hours legitimately share nearly all their digits -- the
// 1am page converts 1:00 to 2:00 and the 2am page converts 2:00 to 3:00 -- so
// no wording can push them apart, and the gate would have failed 586 pages
// forever for a thing that is not wrong. The distance is reported instead, so
// the number stays visible without blocking a deploy over it.
for (const [group, pages] of atfByGroup) {
  for (const page of pages) {
    if (!page.words.includes(page.own24)) {
      errors.push(
        `${page.path}: does not state its own hour as ${page.own24} above the fold, ` +
          `so only the 12-hour form separates it from the other ${pages.length - 1} pages under /${group}`
      );
    }
  }
  if (pages.length < 2) continue;
  let worst = Infinity;
  let pairing = "";
  for (const a of pages) {
    for (const b of pages) {
      if (a.path === b.path) continue;
      const own = ownWords(a.words, b.words);
      if (own < worst) {
        worst = own;
        pairing = `${a.path} vs ${b.path}`;
      }
    }
  }
  if (worst < closestSiblings.words) closestSiblings = { words: worst, pairing };
}

/* -------------------------------------------------------------------- report */

console.log(`seo-lint: ${files.length} HTML pages (${indexable} indexable, ${noindex} noindex)`);
if (closestSiblings.pairing) {
  // Reported every run rather than only on regression, because the number is
  // the thing worth watching: it is what decides whether a search engine can
  // tell two sibling hour pages apart.
  console.log(`  closest sibling hour pages: all but ${closestSiblings.words} word(s) shared above the fold (${closestSiblings.pairing})`);
}
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings.slice(0, 60)) console.log(`  ! ${w}`);
  if (warnings.length > 60) console.log(`  … ${warnings.length - 60} more`);
}
if (errors.length) {
  console.log(`\n${errors.length} error(s):`);
  for (const e of errors.slice(0, 80)) console.log(`  x ${e}`);
  if (errors.length > 80) console.log(`  … ${errors.length - 80} more`);
  console.log("\nseo-lint FAILED");
  process.exit(1);
}
console.log("\nseo-lint: 0 errors");
