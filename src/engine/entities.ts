/**
 * SERVER ONLY. Imports the generated JSON (~800 KB) — never import this from a
 * `'use client'` file (docs/02 import boundary, docs/14 #12).
 */
import { ZONES, ZONE_BY_SLUG, type Zone } from "@/data/zones";
import { applySameRegionRule, zoneSide, type Side } from "./side";
import countriesJson from "@/data/generated/countries.json";
import regionsJson from "@/data/generated/regions.json";
import placesJson from "@/data/generated/places.json";
import metaJson from "@/data/generated/meta.json";

export interface Country {
  iso2: string;
  name: string;
  short: string;
  slug: string;
  zones: string[];
  primary: string;
  multiZone: boolean;
  rank: number;
}
export interface Region {
  iso2: string;
  countrySlug: string;
  countryName: string;
  countryShort: string;
  name: string;
  rawName: string;
  slug: string;
  entity: string;
  zones: string[];
  primary: string;
  multiZone: boolean;
}
export interface Place {
  name: string;
  slug: string;
  entity: string;
  iso2: string;
  countrySlug: string;
  countryName: string;
  countryShort: string;
  region: string;
  regionSlug: string;
  tz: string;
  pop: number;
  lat: number;
  lng: number;
}

export const COUNTRIES = countriesJson as Country[];
export const REGIONS = regionsJson as Region[];
export const PLACES = placesJson as Place[];
export const BUILD_META = metaJson as { builtAt: string; tzdata: string; node: string; year: number };

export const COUNTRY_BY_SLUG = new Map(COUNTRIES.map((c) => [c.slug, c]));
export const COUNTRY_BY_ISO = new Map(COUNTRIES.map((c) => [c.iso2, c]));
export const REGION_BY_KEY = new Map(REGIONS.map((r) => [`${r.countrySlug}/${r.slug}`, r]));
export const PLACE_BY_KEY = new Map(PLACES.map((p) => [`${p.countrySlug}/${p.slug}`, p]));
export const REGION_BY_ENTITY = new Map(REGIONS.map((r) => [r.entity, r]));
export const PLACE_BY_ENTITY = new Map(PLACES.map((p) => [p.entity, p]));

/* ------------------------------------------------------------- side builders */

/** The pair-URL key of a country: `india-time`, `uk-time`, `us-time`. */
export function countryKey(c: Country): string {
  return c.iso2 === "US" ? "us-time" : `${c.slug}-time`;
}
/** The pair label of a country: short name, "US" for the United States. */
export function countryLabel(c: Country): string {
  return c.iso2 === "US" ? "US" : c.short;
}

export function countrySide(c: Country): Side {
  return {
    key: countryKey(c),
    kind: "country",
    label: countryLabel(c),
    long: c.name,
    tz: c.primary,
    href: `/time/${c.slug}`,
  };
}

export function regionSide(r: Region): Side {
  return {
    key: `${r.entity}-time`,
    kind: "region",
    label: r.name,
    long: `${r.name}, ${r.countryShort}`,
    tz: r.primary,
    href: `/time/${r.countrySlug}/${r.slug}`,
  };
}

export function placeSide(p: Place): Side {
  return {
    key: `${p.entity}-time`,
    kind: "city",
    label: p.name,
    long: `${p.name}, ${p.countryShort}`,
    tz: p.tz,
    href: `/time/${p.countrySlug}/${p.slug}`,
    lat: p.lat,
    lng: p.lng,
  };
}

/* ------------------------------------------------------------------ registry */

const registry = new Map<string, Side>();

for (const z of ZONES) registry.set(z.slug, zoneSide(z));
for (const c of COUNTRIES) {
  const s = countrySide(c);
  if (!registry.has(s.key)) registry.set(s.key, s);
}
for (const r of REGIONS) {
  const s = regionSide(r);
  if (!registry.has(s.key)) registry.set(s.key, s);
}
for (const p of PLACES) {
  const s = placeSide(p);
  if (!registry.has(s.key)) registry.set(s.key, s);
}

export const REGISTRY = registry;

export function sideFor(key: string): Side | undefined {
  return registry.get(key);
}

/* ------------------------------------------------------------------- aliases */

/** Input slug -> canonical slug, served as a 308 redirect. docs/03 §3.3. */
export const PAIR_ALIASES: Record<string, string> = {
  pht: "philippine-time",
  "philippines-time": "philippine-time",
  "ph-time": "philippine-time",
  "manila-time": "philippine-time",
  "pakistan-time": "pkt",
  "japan-time": "jst",
  "korea-time": "kst",
  "south-korea-time": "kst",
  "china-time": "china-standard-time",
  "singapore-time": "sgt",
  "hong-kong-time": "hkt",
  "bangladesh-time": "bangladesh-standard-time",
  "nepal-time": "npt",
  "usa-time": "us-time",
  "united-states-time": "us-time",
  "eastern-time": "est",
  "central-time": "cst",
  "pacific-time": "pst",
  "mountain-time": "mst",
  "gulf-time": "gst",
  "dubai-time": "gst",
  "uae-time": "gst",
  "moscow-time": "msk",
};
for (const z of ZONES) if (z.pairAlias) PAIR_ALIASES[z.slug] = z.pairAlias;

/** DST names collapse to their standard slug in pair URLs. */
const DST_NAME_TO_STD: Record<string, string> = {
  edt: "est",
  cdt: "cst",
  mdt: "mst",
  pdt: "pst",
  akdt: "akst",
  adt: "at",
  ndt: "nst",
  cest: "cet",
  eest: "eet",
  acdt: "acst",
  aedt: "aest",
  nzdt: "nzst",
};

/** Pairs with their own measured demand that keep the DST name. docs/03 §3.3. */
export const DST_PAIR_KEEP = new Set([
  "pdt-to-est",
  "edt-to-est",
  "pdt-to-cst",
  "pst-to-pdt",
  "cdt-to-est",
  "est-to-edt",
  "edt-to-cst",
  "cest-to-est",
  "cest-to-ist",
  "bst-to-est",
  "bst-to-pst",
  "bst-to-ist",
  "bst-to-cet",
  "bst-to-utc",
  "bst-to-cst",
  "est-to-bst",
  "edt-to-bst",
  "pst-to-bst",
  "utc-to-bst",
  "est-to-aedt",
  "aedt-to-est",
  "aedt-to-pst",
  "gmt-to-edt",
  "ist-to-edt",
  "ist-to-pdt",
  "pdt-to-ist",
  "edt-to-ist",
  "cdt-to-ist",
]);

function sameRegionSlugs(a: string, b: string): boolean {
  const za = ZONE_BY_SLUG.get(a);
  const zb = ZONE_BY_SLUG.get(b);
  if (!za || !zb) return false;
  if (za.iana === zb.iana) return true;
  return za.counterpart === zb.slug || zb.counterpart === za.slug;
}

/** Resolve one half of a pair slug to its canonical registry key. */
function aliasSide(raw: string): string {
  return PAIR_ALIASES[raw] ?? raw;
}

export interface ParsedPair {
  from: Side;
  to: Side;
  fromKey: string;
  toKey: string;
  slug: string; // the canonical slug
  canonical: boolean; // true when the input slug already was canonical
}

/**
 * Parse `/{a}-to-{b}`. Tries every `-to-` split position, so city names
 * containing "to" (Toronto) are safe. Returns null for 404.
 */
export function parsePair(input: string): ParsedPair | null {
  const slug = input.toLowerCase();
  const positions: number[] = [];
  let i = slug.indexOf("-to-");
  while (i !== -1) {
    positions.push(i);
    i = slug.indexOf("-to-", i + 1);
  }
  if (!positions.length) return null;

  for (const pos of positions) {
    const rawA = slug.slice(0, pos);
    const rawB = slug.slice(pos + 4);
    if (!rawA || !rawB) continue;

    let a = aliasSide(rawA);
    let b = aliasSide(rawB);
    if (!registry.has(a) || !registry.has(b)) continue;

    // DST-name collapse, unless this exact pair is kept or it's a same-region pair
    const aliasedSlug = `${a}-to-${b}`;
    if (!DST_PAIR_KEEP.has(aliasedSlug) && !sameRegionSlugs(a, b)) {
      const a2 = DST_NAME_TO_STD[a] ?? a;
      const b2 = DST_NAME_TO_STD[b] ?? b;
      if ((a2 !== a || b2 !== b) && registry.has(a2) && registry.has(b2) && a2 !== b2) {
        a = a2;
        b = b2;
      }
    }

    if (a === b) return null;
    const canonSlug = `${a}-to-${b}`;
    const [from, to] = applySameRegionRule(registry.get(a)!, registry.get(b)!);
    return { from, to, fromKey: a, toKey: b, slug: canonSlug, canonical: canonSlug === slug };
  }
  return null;
}

/** Build a pair from two canonical keys (no alias handling). */
export function pairFromKeys(a: string, b: string): ParsedPair | null {
  if (a === b) return null;
  const sa = registry.get(a);
  const sb = registry.get(b);
  if (!sa || !sb) return null;
  const [from, to] = applySameRegionRule(sa, sb);
  return { from, to, fromKey: a, toKey: b, slug: `${a}-to-${b}`, canonical: true };
}

/* --------------------------------------------------------------- zone lookup */

export function zoneBySlug(slug: string): Zone | undefined {
  return ZONE_BY_SLUG.get(slug);
}

/* -------------------------------------------------------------- search index */

export type SearchRow = [string, string, string, string]; // key, label, sublabel, tz

let searchCache: SearchRow[] | null = null;

export function searchIndex(): SearchRow[] {
  if (searchCache) return searchCache;
  const rows: SearchRow[] = [];
  for (const z of ZONES) rows.push([z.slug, `${z.abbr} - ${z.name}`, "Time zone", z.iana]);
  for (const c of COUNTRIES) rows.push([countryKey(c), countryLabel(c), "Country", c.primary]);
  for (const r of REGIONS) rows.push([`${r.entity}-time`, r.name, r.countryName, r.primary]);
  for (const p of PLACES) {
    rows.push([`${p.entity}-time`, p.name, p.region ? `${p.region}, ${p.countryName}` : p.countryName, p.tz]);
  }
  searchCache = rows;
  return rows;
}
