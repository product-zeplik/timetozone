#!/usr/bin/env node
/**
 * seo/content-dates.json: the day each page family's content last changed,
 * read from git history. GR-36 / manual 11.2 rule 6: dateModified, the visible
 * "Updated" date and sitemap lastmod move only when the content does, and they
 * never come from the build or request clock.
 *
 *   node scripts/content-dates.mjs          rewrite seo/content-dates.json
 *   node scripts/content-dates.mjs --check  exit 1 if a recorded date is later
 *                                           than git supports (fabricated),
 *                                           warn if one lags behind git
 *
 * Every page in a family is computed from the same template, content builder,
 * engine and data, so a family is the unit a commit can change. A family's
 * date is the UTC day of the newest commit that touched any of its sources.
 * Uncommitted changes to a source count as today: run this before committing
 * content. Styling (globals.css), presentational blocks, the layout, tests and
 * scripts are not content and are not listed.
 *
 * Why a committed file and not git at build time: CI checks out one commit and
 * Railway builds from a source snapshot, so the build has no usable history.
 * In a shallow clone `git log -1 -- <file>` answers with the clone boundary,
 * which is fake freshness again, so this refuses to run in one.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "seo", "content-dates.json");
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();

/** Inputs every computed page reads: the engine, the zone and entity data, the tzdata, the indexing gate. */
const COMMON = [
  "src/engine",
  "src/data/zones.ts",
  "src/data/keyword-map.csv",
  "src/data/pairs-tier1.json",
  "src/data/generated/countries.json",
  "src/data/generated/places.json",
  "src/data/generated/regions.json",
  "src/data/generated/keywords.json",
  "src/content/labels.ts",
  "src/seo/gate.ts",
  "src/seo/meta.ts",
  "vendor/icu-tz",
];
const TOOL = [...COMMON, "src/components/ToolPage.tsx"];
const PLACE = [...COMMON, "src/components/PlaceView.tsx", "src/content/place.ts"];

export const FAMILIES = {
  home: [...TOOL, "src/app/page.tsx", "src/components/Converter.tsx", "src/content/nav.ts"],
  pair: [...COMMON, "src/app/[pair]/page.tsx", "src/components/PairView.tsx", "src/content/pair.ts", "src/components/Converter.tsx"],
  hour: [...COMMON, "src/app/[pair]/[hour]/page.tsx", "src/components/PairView.tsx", "src/content/pair.ts", "src/components/Converter.tsx"],
  place: [...PLACE, "src/app/time/[...place]/page.tsx"],
  "multi-zone": [...PLACE, "src/app/time-zone/[place]/page.tsx"],
  zone: [...PLACE, "src/app/zones/[abbr]/page.tsx"],
  "dst-hub": [...COMMON, "src/app/daylight-saving-time/page.tsx", "src/content/dst.ts"],
  "dst-country": [...COMMON, "src/app/daylight-saving-time/[country]/page.tsx", "src/content/dst.ts"],
  "time-zones": [...COMMON, "src/app/time-zones/page.tsx"],
  "time-zone-map": [...TOOL, "src/app/time-zone-map/[[...region]]/page.tsx", "src/content/map.ts", "src/components/MapReadout.tsx", "src/app/map/[name]/route.ts"],
  "world-clock": [...TOOL, "src/app/world-clock/page.tsx", "src/components/tools/WorldClock.tsx"],
  "meeting-planner": [...TOOL, "src/app/meeting-planner/page.tsx", "src/components/tools/MeetingPlanner.tsx"],
  "what-time-zone-am-i-in": [...TOOL, "src/app/what-time-zone-am-i-in/page.tsx", "src/components/tools/SmallTools.tsx"],
  "military-time-converter": [...TOOL, "src/app/military-time-converter/page.tsx", "src/components/tools/SmallTools.tsx"],
  "unix-timestamp-converter": [...TOOL, "src/app/unix-timestamp-converter/page.tsx", "src/components/tools/SmallTools.tsx"],
  "time-calculator": [...TOOL, "src/app/time-calculator/page.tsx", "src/components/tools/SmallTools.tsx", "src/components/tools/ZoneDifference.tsx"],
  "time-unit-converter": [...TOOL, "src/app/time-unit-converter/page.tsx", "src/components/tools/SmallTools.tsx"],
  about: ["src/app/about/page.tsx"],
  contact: ["src/app/contact/page.tsx"],
  privacy: ["src/app/privacy/page.tsx"],
  terms: ["src/app/terms/page.tsx"],
};

const utcDay = (unixSeconds) => new Date(unixSeconds * 1000).toISOString().slice(0, 10);

function familyDate(sources) {
  const existing = sources.filter((s) => existsSync(join(ROOT, s)));
  if (!existing.length) return null;
  const dirty = git("status", "--porcelain", "--", ...existing);
  if (dirty) return new Date().toISOString().slice(0, 10);
  const ts = git("log", "-1", "--format=%ct", "--", ...existing);
  return ts ? utcDay(Number(ts)) : null;
}

function compute() {
  if (git("rev-parse", "--is-shallow-repository") === "true") {
    console.error("content-dates: shallow clone; run `git fetch --unshallow` first (a shallow log dates every page to the clone boundary)");
    process.exit(2);
  }
  const families = {};
  for (const [name, sources] of Object.entries(FAMILIES)) {
    const d = familyDate(sources);
    if (d) families[name] = d;
  }
  return families;
}

const families = compute();
if (process.argv.includes("--check")) {
  const recorded = JSON.parse(readFileSync(OUT, "utf8")).families;
  let bad = 0;
  for (const [name, d] of Object.entries(families)) {
    const r = recorded[name];
    if (!r) { console.error(`content-dates: family "${name}" missing from seo/content-dates.json`); bad++; }
    else if (r > d) { console.error(`content-dates: ${name} records ${r}, but git's newest change is ${d} (fabricated freshness)`); bad++; }
    else if (r < d) console.warn(`content-dates: ${name} records ${r}, git says ${d}; run npm run content-dates`);
  }
  for (const name of Object.keys(recorded)) if (!(name in families)) { console.error(`content-dates: unknown family "${name}"`); bad++; }
  if (bad) process.exit(1);
  console.log(`content-dates: ${Object.keys(families).length} families agree with git`);
} else {
  const out = {
    $comment: "Generated by scripts/content-dates.mjs from git history. Do not edit by hand; run `npm run content-dates` before committing content.",
    families,
  };
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify(families, null, 2));
}
