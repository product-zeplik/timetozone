#!/usr/bin/env node
/**
 * Daily rank tracking for the keywords we actually target.
 *
 *   node scripts/rank-report.mjs --add snapshot.json   # record today
 *   node scripts/rank-report.mjs                       # report latest vs previous
 *   node scripts/rank-report.mjs --history "pst to est"
 *
 * A snapshot is whatever rows a source gives us, normalised to
 *   [{ keyword, position, impressions?, clicks?, url? }]
 * It accepts either that JSON directly, or a Search Console Queries.csv
 * export (the columns it writes are "Top queries, Clicks, Impressions,
 * CTR, Position").
 *
 * Snapshots are stored one file per day under data/rank-history/ so the
 * day-over-day delta is computed from recorded fact rather than memory.
 * Re-running on the same day overwrites that day, so a correction never
 * creates a phantom movement.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HIST = join(ROOT, "data", "rank-history");
const MAP = join(ROOT, "data", "keyword-map.csv");

const today = () => new Date().toISOString().slice(0, 10);

/** The keywords we deliberately target, from the one contract that defines them. */
function targetKeywords() {
  const lines = readFileSync(MAP, "utf8").trim().split("\n");
  const cols = lines[0].split(",");
  const kw = cols.indexOf("keyword");
  const url = cols.indexOf("target_url");
  const vol = cols.indexOf("volume");
  const out = new Map();
  for (const line of lines.slice(1)) {
    const f = line.split(",");
    if (!f[kw]) continue;
    const k = f[kw].trim().toLowerCase();
    // One keyword can be mapped per market; keep the largest volume.
    const v = Number(f[vol]) || 0;
    if (!out.has(k) || out.get(k).volume < v) out.set(k, { url: f[url], volume: v });
  }
  return out;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
  const qi = head.findIndex((h) => h.includes("quer"));
  const pi = head.findIndex((h) => h.startsWith("position"));
  const ii = head.findIndex((h) => h.startsWith("impression"));
  const ci = head.findIndex((h) => h.startsWith("click"));
  if (qi === -1 || pi === -1) throw new Error("CSV needs a query column and a Position column");
  return lines.slice(1).map((l) => {
    const f = l.split(",").map((x) => x.replace(/^"|"$/g, ""));
    return {
      keyword: f[qi].trim().toLowerCase(),
      position: Number(f[pi]),
      impressions: ii > -1 ? Number(f[ii]) : undefined,
      clicks: ci > -1 ? Number(f[ci]) : undefined,
    };
  });
}

function load(file) {
  const raw = readFileSync(file, "utf8");
  const rows = raw.trimStart().startsWith("[") ? JSON.parse(raw) : parseCsv(raw);
  return rows
    .filter((r) => r.keyword && Number.isFinite(r.position))
    .map((r) => ({ ...r, keyword: String(r.keyword).trim().toLowerCase() }));
}

function snapshots() {
  if (!existsSync(HIST)) return [];
  return readdirSync(HIST)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ date: f.replace(/\.json$/, ""), rows: JSON.parse(readFileSync(join(HIST, f), "utf8")) }));
}

function add(file) {
  const rows = load(file);
  mkdirSync(HIST, { recursive: true });
  const date = today();
  writeFileSync(join(HIST, `${date}.json`), JSON.stringify(rows, null, 1));
  console.log(`recorded ${rows.length} ranked keywords for ${date}`);
}

const fmt = (n) => (n === undefined ? "—" : n.toFixed(1));

function report() {
  const snaps = snapshots();
  if (snaps.length === 0) {
    console.log("no snapshots yet — record one with: node scripts/rank-report.mjs --add <file>");
    return;
  }
  const cur = snaps[snaps.length - 1];
  const prev = snaps.length > 1 ? snaps[snaps.length - 2] : null;
  const targets = targetKeywords();

  const byKw = (s) => new Map(s.rows.map((r) => [r.keyword, r]));
  const now = byKw(cur);
  const before = prev ? byKw(prev) : new Map();

  const top3 = cur.rows.filter((r) => r.position <= 3).length;
  const top10 = cur.rows.filter((r) => r.position <= 10).length;
  const top20 = cur.rows.filter((r) => r.position <= 20).length;
  const mapped = cur.rows.filter((r) => targets.has(r.keyword));

  console.log(`\nrank report — ${cur.date}${prev ? ` (vs ${prev.date})` : " (baseline, no prior day)"}\n`);
  console.log(`  ranked keywords : ${cur.rows.length}${prev ? ` (${sign(cur.rows.length - prev.rows.length)})` : ""}`);
  console.log(`  top 3 / 10 / 20 : ${top3} / ${top10} / ${top20}`);
  console.log(`  of our mapped   : ${mapped.length} of ${targets.size} targeted keywords are ranking`);

  if (!prev) {
    console.log("\n  current positions:");
    for (const r of [...cur.rows].sort((a, b) => a.position - b.position).slice(0, 40)) {
      console.log(`    ${fmt(r.position).padStart(6)}  ${r.keyword}`);
    }
    return;
  }

  const up = [], down = [], gained = [], lost = [];
  for (const [k, r] of now) {
    const p = before.get(k);
    if (!p) gained.push(r);
    else if (r.position < p.position - 0.05) up.push({ ...r, from: p.position });
    else if (r.position > p.position + 0.05) down.push({ ...r, from: p.position });
  }
  for (const [k, r] of before) if (!now.has(k)) lost.push(r);

  const show = (title, rows, line) => {
    if (!rows.length) return;
    console.log(`\n  ${title} (${rows.length}):`);
    for (const r of rows.slice(0, 25)) console.log(`    ${line(r)}`);
  };
  up.sort((a, b) => a.from - b.from - (a.position - b.position));
  show("improved", up, (r) => `${fmt(r.from)} -> ${fmt(r.position)}  ${r.keyword}`);
  show("declined", down, (r) => `${fmt(r.from)} -> ${fmt(r.position)}  ${r.keyword}`);
  show("newly ranking", gained.sort((a, b) => a.position - b.position), (r) => `${fmt(r.position).padStart(6)}  ${r.keyword}`);
  show("dropped out", lost, (r) => `was ${fmt(r.position)}  ${r.keyword}`);
  console.log("");
}

const sign = (n) => (n > 0 ? `+${n}` : String(n));

function history(keyword) {
  const k = keyword.trim().toLowerCase();
  console.log(`\nposition history — "${k}"\n`);
  let any = false;
  for (const s of snapshots()) {
    const r = s.rows.find((x) => x.keyword === k);
    if (r) { console.log(`  ${s.date}  ${fmt(r.position)}`); any = true; }
    else console.log(`  ${s.date}  —`);
  }
  if (!any) console.log("  (never recorded as ranking)");
  console.log("");
}

const args = process.argv.slice(2);
if (args[0] === "--add") {
  if (!args[1]) { console.error("--add needs a file"); process.exit(1); }
  add(args[1]);
  report();
} else if (args[0] === "--history") {
  history(args.slice(1).join(" "));
} else {
  report();
}
