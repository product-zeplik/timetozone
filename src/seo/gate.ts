/**
 * The indexing gate. Decides which of the infinitely many valid combinations
 * Google is allowed to see, and which are pre-built. docs/05 §5.3.
 * SERVER ONLY (pulls in the generated data through entities.ts).
 */
import { ZONES, ZONE_BY_SLUG } from "@/data/zones";
import {
  COUNTRIES,
  DST_PAIR_KEEP,
  PLACES,
  REGIONS,
  countryKey,
  pairFromKeys,
  parsePair,
  sideFor,
} from "@/engine/entities";
import keywordsJson from "@/data/generated/keywords.json";

export interface KeywordRow {
  keyword: string;
  market: string;
  volume: number;
  kd: number | null;
  url: string;
  slot: string;
  slotBase: string;
}

export const KEYWORDS = keywordsJson as KeywordRow[];

/** All keyword rows grouped by target URL. */
const byUrl = new Map<string, KeywordRow[]>();
for (const k of KEYWORDS) {
  const list = byUrl.get(k.url);
  if (list) list.push(k);
  else byUrl.set(k.url, [k]);
}
for (const list of byUrl.values()) list.sort((a, b) => b.volume - a.volume);

export function keywordsFor(url: string): KeywordRow[] {
  return byUrl.get(url) ?? [];
}
export function primaryKeyword(url: string): KeywordRow | undefined {
  const list = keywordsFor(url);
  return list.find((k) => k.slotBase === "primary") ?? list[0];
}
export function keywordsBySlot(url: string, slot: string): KeywordRow[] {
  return keywordsFor(url).filter((k) => k.slotBase === slot);
}
/** Total measured monthly volume mapped to a URL. */
export function volumeFor(url: string): number {
  return keywordsFor(url).reduce((n, k) => n + k.volume, 0);
}
export const KEYWORD_URLS = [...byUrl.keys()];

/* ------------------------------------------------------------- top entities */

export const TOP_ZONES = ZONES.filter((z) => z.top).map((z) => z.slug);

export const PLACE_TARGETS = [
  "est",
  "pst",
  "cst",
  "mst",
  "gmt",
  "utc",
  "ist",
  "aest",
  "cet",
  "jst",
  "bst",
  "sgt",
];

const CITY_FOCUS_COUNTRIES = ["GB", "CA", "AU", "IN", "AE", "DE", "FR"];

/** Ranked countries + the biggest cities, as pair keys. docs/05 §5.3 (3). */
function buildTopPlaces(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (key: string) => {
    if (!key || seen.has(key) || !sideFor(key)) return;
    seen.add(key);
    out.push(key);
  };

  for (const c of COUNTRIES.filter((c) => c.rank < 40).sort((a, b) => a.rank - b.rank)) push(countryKey(c));
  for (const p of PLACES.slice(0, 70)) push(`${p.entity}-time`);
  for (const p of PLACES.filter((p) => p.iso2 === "US").slice(0, 20)) push(`${p.entity}-time`);
  for (const iso of CITY_FOCUS_COUNTRIES) {
    for (const p of PLACES.filter((p) => p.iso2 === iso).slice(0, 30)) push(`${p.entity}-time`);
  }
  return out;
}

let topPlacesCache: string[] | null = null;
export function topPlaces(): string[] {
  if (!topPlacesCache) topPlacesCache = buildTopPlaces();
  return topPlacesCache;
}

/* --------------------------------------------------------------- hour pairs */

const HOUR_PAIR_SEED = [
  "est-to-pst",
  "pst-to-est",
  "cst-to-est",
  "est-to-cst",
  "est-to-ist",
  "ist-to-est",
  "pst-to-ist",
  "cst-to-pst",
  "mst-to-est",
  "utc-to-est",
  "est-to-gmt",
  "gmt-to-est",
  "est-to-utc",
  "utc-to-pst",
  "pst-to-gmt",
  "cet-to-est",
  "est-to-cet",
  "est-to-aest",
  "aest-to-est",
  "est-to-jst",
  "jst-to-est",
  "est-to-philippine-time",
  "pst-to-philippine-time",
  "bst-to-est",
  "est-to-bst",
  "pst-to-cst",
  "cst-to-ist",
  "ist-to-pst",
  "ist-to-cst",
  "mst-to-pst",
  "est-to-mst",
  "utc-to-ist",
  "ist-to-utc",
  "gmt-to-ist",
  "ist-to-gmt",
  "cet-to-ist",
  "pst-to-utc",
  "utc-to-cst",
  "kst-to-est",
  "est-to-kst",
];

/** 40 zone-to-zone pairs that get all 24 hour pages. docs/05 §5.3. */
function buildHourPairs(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const slug of HOUR_PAIR_SEED) {
    const p = parsePair(slug);
    if (!p || seen.has(p.slug)) continue;
    seen.add(p.slug);
    out.push(p.slug);
  }
  if (out.length < 40) {
    // pad from the measured zone-to-zone pairs with the most volume
    const extra = [...byUrl.keys()]
      .filter((u) => /^\/[a-z0-9-]+-to-[a-z0-9-]+$/.test(u))
      .map((u) => ({ u, v: volumeFor(u) }))
      .sort((a, b) => b.v - a.v);
    for (const { u } of extra) {
      if (out.length >= 40) break;
      const p = parsePair(u.slice(1));
      if (!p || seen.has(p.slug)) continue;
      if (p.from.kind !== "zone" || p.to.kind !== "zone") continue;
      seen.add(p.slug);
      out.push(p.slug);
    }
  }
  return out.slice(0, 40);
}

let hourPairsCache: string[] | null = null;
export function hourPairs(): string[] {
  if (!hourPairsCache) hourPairsCache = buildHourPairs();
  return hourPairsCache;
}
export function isHourPair(slug: string): boolean {
  return hourPairs().includes(slug);
}

/* ------------------------------------------------------------ the pair gate */

/** Both sides resolve to the same clock -> no page worth indexing. */
function sidesCollapse(slug: string): boolean {
  const p = parsePair(slug);
  if (!p) return true;
  if (p.from.fixed != null || p.to.fixed != null) return false; // same-region pairs are meaningful
  return p.from.tz === p.to.tz;
}

function addPair(set: Set<string>, slug: string) {
  const p = parsePair(slug);
  if (!p) return;
  if (p.from.fixed == null && p.to.fixed == null && p.from.tz === p.to.tz) return;
  set.add(p.slug);
}

/** (1) pair URLs in the keyword map, including the parents of hour URLs. */
function keywordPairs(): Set<string> {
  const out = new Set<string>();
  for (const url of byUrl.keys()) {
    const m = /^\/([a-z0-9-]+-to-[a-z0-9-]+)(?:\/([a-z0-9]+))?$/.exec(url);
    if (m) addPair(out, m[1]);
  }
  return out;
}

/** (2) the full matrix of the 30 top zones. */
function zoneMatrix(): Set<string> {
  const out = new Set<string>();
  for (const a of TOP_ZONES) for (const b of TOP_ZONES) if (a !== b) addPair(out, `${a}-to-${b}`);
  return out;
}

let staticCache: Set<string> | null = null;
/** Pre-built at build time: keyword pairs + the top-zone matrix. */
export function staticPairs(): Set<string> {
  if (staticCache) return staticCache;
  const out = keywordPairs();
  for (const s of zoneMatrix()) out.add(s);
  // pairs that keep a DST name because they have their own measured demand
  for (const s of DST_PAIR_KEEP) addPair(out, s);
  staticCache = out;
  return out;
}

let indexedCache: Set<string> | null = null;
/** Every pair URL Google is allowed to index. */
export function indexedPairs(): Set<string> {
  if (indexedCache) return indexedCache;
  const out = new Set(staticPairs());
  const places = topPlaces();

  // (3) top places x zone targets, both directions
  for (const place of places) {
    for (const target of PLACE_TARGETS) {
      addPair(out, `${place}-to-${target}`);
      addPair(out, `${target}-to-${place}`);
    }
  }
  // (4) the first 30 top places against each other
  const core = places.slice(0, 30);
  for (const a of core) for (const b of core) if (a !== b) addPair(out, `${a}-to-${b}`);

  indexedCache = out;
  return out;
}

export function isIndexedPair(slug: string): boolean {
  return indexedPairs().has(slug);
}

/* ------------------------------------------------------- place / zone gates */

/** Place pages are all indexable; these are the ones pre-built. docs/05 §5.3. */
export function staticPlacePaths(): string[] {
  const out: string[] = [];
  for (const c of COUNTRIES.filter((c) => c.rank < 999)) out.push(`/time/${c.slug}`);
  for (const r of REGIONS.filter((r) => ["US", "CA", "AU"].includes(r.iso2))) {
    out.push(`/time/${r.countrySlug}/${r.slug}`);
  }
  for (const p of PLACES.slice(0, 200)) out.push(`/time/${p.countrySlug}/${p.slug}`);
  return [...new Set(out)];
}

/** Countries and regions with more than one clock: /time-zone/{slug}. */
export function multiZoneEntities(): { slug: string; kind: "country" | "region" }[] {
  const out: { slug: string; kind: "country" | "region" }[] = [];
  for (const c of COUNTRIES) if (c.multiZone) out.push({ slug: c.slug, kind: "country" });
  for (const r of REGIONS) if (r.multiZone) out.push({ slug: r.entity, kind: "region" });
  return out;
}

/** Countries that have a DST transition this year or next. */
export function dstCountries(): string[] {
  const year = new Date().getUTCFullYear();
  const out: string[] = [];
  for (const c of COUNTRIES) {
    const observes = c.zones.some((tz) => {
      const jan = janJulDiffers(tz, year);
      return jan || janJulDiffers(tz, year + 1);
    });
    if (observes) out.push(c.slug);
  }
  return out;
}

function janJulDiffers(tz: string, year: number): boolean {
  const off = (ms: number) => {
    const raw = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
      .formatToParts(ms)
      .find((p) => p.type === "timeZoneName")!.value;
    if (raw === "GMT") return 0;
    const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(raw)!;
    return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
  };
  return off(Date.UTC(year, 0, 15, 12)) !== off(Date.UTC(year, 6, 15, 12));
}

/* ------------------------------------------------------- popular link lists */

/** Zone-to-zone and place pairs ordered by measured volume, for link blocks. */
let rankedCache: string[] | null = null;
export function rankedPairs(): string[] {
  if (rankedCache) return rankedCache;
  const indexed = indexedPairs();
  const scored = [...indexed].map((slug) => ({ slug, v: volumeFor(`/${slug}`) }));
  scored.sort((a, b) => b.v - a.v || a.slug.localeCompare(b.slug));
  rankedCache = scored.map((s) => s.slug);
  return rankedCache;
}

/** Indexed pairs that involve `key` as the source. */
export function pairsFrom(key: string, limit = 8, exclude?: string): string[] {
  const out: string[] = [];
  for (const slug of rankedPairs()) {
    if (out.length >= limit) break;
    if (slug === exclude) continue;
    if (slug.startsWith(`${key}-to-`)) out.push(slug);
  }
  return out;
}

/** Indexed pairs that involve `key` as the target. */
export function pairsTo(key: string, limit = 8, exclude?: string): string[] {
  const out: string[] = [];
  for (const slug of rankedPairs()) {
    if (out.length >= limit) break;
    if (slug === exclude) continue;
    if (slug.endsWith(`-to-${key}`)) out.push(slug);
  }
  return out;
}

/** Any indexed pair touching `key`, in either direction. */
export function pairsWith(key: string, limit = 24): string[] {
  const out: string[] = [];
  for (const slug of rankedPairs()) {
    if (out.length >= limit) break;
    if (slug.startsWith(`${key}-to-`) || slug.endsWith(`-to-${key}`)) out.push(slug);
  }
  return out;
}

export { pairFromKeys, sidesCollapse, ZONE_BY_SLUG };
