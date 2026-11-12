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

  const base = resolveBase(tz, std, dst, ms);
  let out: string;
  if (!base) {
    // Before giving up and printing a bare offset, ask the platform. CLDR
    // carries a short name for ~79 of the zones we publish, and it is the
    // authority on them: it knows America/Vancouver is PDT and Winnipeg is
    // CDT, which our curated list cannot match since CLDR names them
    // "Pacific Time (Canada)" rather than "Pacific Time". For the other ~228
    // CLDR answers "GMT+5" and we keep the offset, so this cannot resurrect
    // the Libya-is-SAST class of error that step 2 above exists to prevent.
    out = cldrShort(tz, ms) || fmtOffset(offsetMinutes(tz, ms));
  } else if (dst !== null && isDst(tz, ms)) {
    const cp = counterpartOf(base.slug);
    out = (cp ?? base).abbr;
  } else {
    out = base.abbr;
  }
  abbrCache.set(cacheKey, out);
  return out;
}

/**
 * CLDR's own short name for a zone, but only when it is a real abbreviation.
 * CLDR returns "GMT+5" for zones that have none, and that is not a name.
 */
const shortCache = new Map<string, string>();
function cldrShort(tz: string, ms: number): string {
  const hit = shortCache.get(tz);
  if (hit !== undefined) return hit;
  let out = "";
  try {
    const v =
      new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
        .formatToParts(ms)
        .find((p) => p.type === "timeZoneName")?.value ?? "";
    if (/^[A-Z]{2,6}$/.test(v)) out = v;
  } catch {
    out = "";
  }
  shortCache.set(tz, out);
  return out;
}

/**
 * The CLDR generic name for a zone ("Central European Time", "Kazakhstan
 * Time"), normalised so that Standard/Summer/Daylight and accents do not
 * matter: "Brasília Standard Time" and "Brasilia Time" compare equal.
 */
const cldrCache = new Map<string, string>();
function cldrName(tz: string, ms: number): string {
  const hit = cldrCache.get(tz);
  if (hit !== undefined) return hit;
  let out = "";
  try {
    out =
      new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longGeneric" })
        .formatToParts(ms)
        .find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    out = "";
  }
  const norm = normName(out);
  cldrCache.set(tz, norm);
  return norm;
}

function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(standard|summer|daylight)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pick the curated zone (kind std or fixed) that represents `tz`. */
function resolveBase(tz: string, std: number, dst: number | null, ms: number): Zone | undefined {
  const asBase = (z: Zone | undefined): Zone | undefined => {
    if (!z) return undefined;
    if (z.kind === "dst") return counterpartOf(z.slug) ?? z;
    return z;
  };

  // 1. exact IANA match, ignoring generic names. This stays first and stays
  //    authoritative: Europe/London is GMT/BST here, though CLDR calls it
  //    "United Kingdom Time".
  const exact = ZONES.filter((z) => z.iana === tz && z.kind !== "generic");
  if (exact.length) {
    return asBase(exact.find((z) => z.kind === "std" || z.kind === "fixed") ?? exact[0]);
  }

  // 2. Otherwise borrow a curated zone's abbreviation only when the platform's
  //    own CLDR data says the two zones share a name.
  //
  //    docs/04 §4.2 matches on same-continent + same-offset instead. That is
  //    too loose: it is only ever asked for an offset, so it hands back
  //    whichever curated zone happens to sit on that offset in that continent.
  //    Libya came out as "SAST" because South Africa is the curated UTC+2 zone
  //    in Africa, and the map also showed "Fiji — NZST", "Kazakhstan — PKT",
  //    "Timor-Leste — JST", "Bolivia — AST" and "Ecuador — EST". The offsets
  //    were right and the names belonged to other countries.
  //
  //    CLDR knows Africa/Tripoli is "Eastern European Standard Time" and
  //    Asia/Almaty is "Kazakhstan Time", so a name comparison keeps every
  //    example docs/04 gives -- Phoenix is Mountain Time, Panama is Eastern
  //    Time, Paris is Central European Time -- and refuses the rest. The
  //    offset check stays as a guard, and a zone CLDR names after its own
  //    country simply falls through to step 3.
  const want = cldrName(tz, ms);
  if (want) {
    const year = wallTime(tz, ms).year;
    const named = ZONES.filter((z) => {
      if (z.kind === "generic" || z.iana.startsWith("Etc/")) return false;
      if (normName(z.name) !== want) return false;
      const s = seasonalOffsets(z.iana, year);
      return s.std === std && (dst === null || s.dst === dst);
    });
    if (named.length) {
      return asBase(named.find((z) => z.kind === "std" || z.kind === "fixed") ?? named[0]);
    }
  }

  // 3. no match -> the caller prints the plain offset
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
