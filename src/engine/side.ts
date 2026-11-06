/**
 * A "Side" is one end of a conversion. Plain JSON so it can be handed to the
 * client island. See docs/04-engine-spec.md §4.2.
 */
import { ZONES, ZONE_BY_SLUG, type Zone } from "@/data/zones";
import { fmtOffset, isDst, offsetMinutes, seasonalOffsets, wallTime } from "./tz";

export type SideKind = "zone" | "country" | "region" | "city";

export interface Side {
  key: string;
  kind: SideKind;
  label: string; // short display label: "PST", "India", "London"
  long: string; // "Pacific Standard Time", "India", "London, United Kingdom"
  tz: string; // IANA id
  fixed?: number | null; // forced offset in minutes (same-region rule)
  zoneSlug?: string;
  href?: string;
  lat?: number;
  lng?: number;
}

/* -------------------------------------------------------- counterpart links */

const COUNTERPART = new Map<string, string>();
for (const z of ZONES) {
  if (z.counterpart) {
    COUNTERPART.set(z.slug, z.counterpart);
    if (!COUNTERPART.has(z.counterpart)) COUNTERPART.set(z.counterpart, z.slug);
  }
}
export function counterpartOf(slug: string): Zone | undefined {
  const c = COUNTERPART.get(slug);
  return c ? ZONE_BY_SLUG.get(c) : undefined;
}

const continentOf = (tz: string) => tz.split("/")[0];

/* -------------------------------------------------------------- abbrFor */

const abbrCache = new Map<string, string>();

/**
 * The abbreviation to show next to a time in `tz` at `ms`.
 * Resolution order per docs/04 §4.2.
 */
export function abbrFor(tz: string, ms: number = Date.now()): string {
  const year = wallTime(tz, ms).year;
  const { std, dst } = seasonalOffsets(tz, year);
  const cacheKey = `${tz}|${year}|${offsetMinutes(tz, ms)}`;
  const hit = abbrCache.get(cacheKey);
  if (hit) return hit;

  const base = resolveBase(tz, std, dst);
  let out: string;
  if (!base) {
    out = fmtOffset(offsetMinutes(tz, ms));
  } else if (dst !== null && isDst(tz, ms)) {
    const cp = counterpartOf(base.slug);
    out = (cp ?? base).abbr;
  } else {
    out = base.abbr;
  }
  abbrCache.set(cacheKey, out);
  return out;
}

/** Pick the curated zone (kind std or fixed) that represents `tz`. */
function resolveBase(tz: string, std: number, dst: number | null): Zone | undefined {
  const asBase = (z: Zone | undefined): Zone | undefined => {
    if (!z) return undefined;
    if (z.kind === "dst") return counterpartOf(z.slug) ?? z;
    return z;
  };

  // 1. exact IANA match, ignoring generic names
  const exact = ZONES.filter((z) => z.iana === tz && z.kind !== "generic");
  if (exact.length) {
    return asBase(exact.find((z) => z.kind === "std" || z.kind === "fixed") ?? exact[0]);
  }

  // 2. no DST -> a curated std zone with the same standard offset on the same
  //    continent (America/Phoenix -> MST, America/Panama -> EST).
  //    Checked before (3) or Panama would match Colombia Time (docs/14 #15).
  if (dst === null) {
    const cont = continentOf(tz);
    const byStd = ZONES.filter(
      (z) =>
        z.kind === "std" &&
        !z.iana.startsWith("Etc/") &&
        continentOf(z.iana) === cont &&
        seasonalOffsets(z.iana, new Date().getUTCFullYear()).std === std
    );
    if (byStd.length) return asBase(byStd.find((z) => z.top) ?? byStd[0]);
  }

  // 3. same (std, dst) seasonal offsets on the same continent
  const cont = continentOf(tz);
  const year = new Date().getUTCFullYear();
  const bySeason = ZONES.filter((z) => {
    if (z.kind === "generic" || z.iana.startsWith("Etc/")) return false;
    if (continentOf(z.iana) !== cont) return false;
    const s = seasonalOffsets(z.iana, year);
    return s.std === std && s.dst === dst;
  });
  if (bySeason.length) {
    const pref =
      bySeason.find((z) => (z.kind === "std" || z.kind === "fixed") && z.top) ??
      bySeason.find((z) => z.kind === "std" || z.kind === "fixed") ??
      bySeason[0];
    return asBase(pref);
  }

  // 4. no match
  return undefined;
}

/* --------------------------------------------------------------- zone sides */

export function zoneSide(z: Zone): Side {
  return {
    key: z.slug,
    kind: "zone",
    label: z.abbr,
    long: z.name,
    tz: z.iana,
    zoneSlug: z.slug,
    href: `/zones/${z.slug}`,
  };
}

/* ---------------------------------------------------------- same-region rule */

/**
 * When both sides are the same region's standard/daylight names
 * (EST/EDT, CET/CEST, BST/GMT, AEST/AEDT), pin each to a fixed offset so the
 * difference is the constant 1 hour all year. docs/04 §4.2.
 */
export function applySameRegionRule(a: Side, b: Side): [Side, Side] {
  if (a.kind !== "zone" || b.kind !== "zone") return [a, b];
  const za = a.zoneSlug ? ZONE_BY_SLUG.get(a.zoneSlug) : undefined;
  const zb = b.zoneSlug ? ZONE_BY_SLUG.get(b.zoneSlug) : undefined;
  if (!za || !zb) return [a, b];

  const sameIana = za.iana === zb.iana;
  const counterparts = COUNTERPART.get(za.slug) === zb.slug || COUNTERPART.get(zb.slug) === za.slug;
  if (!sameIana && !counterparts) return [a, b];

  const year = new Date().getUTCFullYear();
  const pin = (side: Side, z: Zone): Side => {
    if (z.iana.startsWith("Etc/")) return { ...side, fixed: 0 };
    const { std, dst } = seasonalOffsets(z.iana, year);
    if (z.kind === "dst") return { ...side, fixed: dst ?? std };
    if (z.kind === "std") return { ...side, fixed: std };
    // fixed/generic kind inside a same-region pair: use its live offset family
    return { ...side, fixed: offsetMinutes(z.iana, Date.UTC(year, 0, 15, 12)) };
  };
  return [pin(a, za), pin(b, zb)];
}

/* --------------------------------------------------------------- accessors */

export function sideOffset(s: Side, ms: number = Date.now()): number {
  return s.fixed ?? offsetMinutes(s.tz, ms);
}

export function sideAbbr(s: Side, ms: number = Date.now()): string {
  if (s.fixed !== undefined && s.fixed !== null) return s.label;
  if (s.zoneSlug) {
    const z = ZONE_BY_SLUG.get(s.zoneSlug);
    if (z) {
      if (z.kind === "fixed") return z.abbr;
      return abbrFor(z.iana, ms);
    }
  }
  return abbrFor(s.tz, ms);
}

/** True when this side can change offset over the year. */
export function sideObservesDst(s: Side): boolean {
  if (s.fixed !== undefined && s.fixed !== null) return false;
  return seasonalOffsets(s.tz, new Date().getUTCFullYear()).dst !== null;
}
