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

    if (title.length > 65) warnings.push(`${path}: title is ${title.length} chars — "${title}"`);
    if (desc.length > 160) warnings.push(`${path}: description is ${desc.length} chars`);
    if (bytes > 120 * 1024 && !path.startsWith("/time-zone-map") && path !== "/time-zones") {
      warnings.push(`${path}: HTML is ${(bytes / 1024).toFixed(0)} KB`);
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

/* -------------------------------------------------------------------- report */

console.log(`seo-lint: ${files.length} HTML pages (${indexable} indexable, ${noindex} noindex)`);
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
