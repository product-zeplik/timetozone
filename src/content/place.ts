/**
 * Content builders for place clocks (D), multi-zone pages (E) and zone pages (F).
 * docs/06.
 */
import { ZONES, ZONE_BY_SLUG, type Zone } from "@/data/zones";
import type { Side } from "@/engine/side";
import { abbrFor, counterpartOf, sideAbbr, zoneSide } from "@/engine/side";
import {
  COUNTRIES,
  COUNTRY_BY_SLUG,
  PLACES,
  PLACE_BY_KEY,
  REGIONS,
  REGION_BY_ENTITY,
  REGION_BY_KEY,
  countryKey,
  pairFromKeys,
  sideFor,
  type Country,
  type Place,
  type Region,
} from "@/engine/entities";
import {
  fmtClock,
  fmtDate,
  fmtDuration,
  fmtOffset,
  longZoneName,
  nextTransition,
  offsetMinutes,
  seasonalOffsets,
  transitionsInYear,
  wallTime,
} from "@/engine/tz";
import { diffMinutes, dstInfo } from "@/engine/pair";
import { dstCountries, isIndexedPair, multiZoneEntities, pairsWith } from "@/seo/gate";
import { clip, firstThatFits, title as brandTitle } from "@/seo/meta";
import { familyName, tLabel } from "./labels";
import type { FaqItem } from "@/components/Blocks";

/* ------------------------------------------------------------------ targets */

export type PlaceTarget =
  | { kind: "country"; country: Country }
  | { kind: "region"; region: Region; country: Country }
  | { kind: "city"; place: Place; country: Country };

/** Resolve `/time/{...segments}` to an entity, or null for a 404. */
/* ------------------------------------------------- nearby-city link graph */

/**
 * Every city links to its eight nearest by great-circle distance, and every
 * city it names links back, so the relation is symmetric by construction.
 *
 * That symmetry is the point. A city in a sparsely-covered country -- Doha,
 * Lusaka, Antananarivo -- is otherwise linked only from its country page and
 * its region page, which leaves it under the five inbound links docs/11
 * requires. Linking by shared time zone does not help, because Asia/Baku has
 * no other city on it at all; and linking only *from* sparse cities does not
 * help either, because it creates outbound links where the shortage is
 * inbound. Closing the relation both ways gives every city eight inbound
 * links whatever its country looks like.
 *
 * Selection keeps the best eight as it scans rather than sorting all 2,859
 * candidates per city, which keeps the whole graph well under a second.
 */
const NEARBY_LINKS = 8;

function haversine(a: Place, b: Place): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(s)));
}

let nearbyCache: Map<string, Place[]> | null = null;
function nearbyCities(): Map<string, Place[]> {
  if (nearbyCache) return nearbyCache;
  const key = (p: Place) => `${p.countrySlug}/${p.slug}`;
  const out = new Map<string, Place[]>();
  const add = (k: string, p: Place) => {
    const list = out.get(k) ?? [];
    if (!list.some((q) => key(q) === key(p))) list.push(p);
    out.set(k, list);
  };

  for (const city of PLACES) {
    const best: { p: Place; d: number }[] = [];
    for (const other of PLACES) {
      // Cities in the same country are skipped: the country page already links
      // them all, so they add no new inbound source. In a sparsely covered
      // region -- Zambia, Madagascar, Cameroon -- the eight nearest cities are
      // otherwise all countrymen, and the block changes nothing.
      if (other === city || other.countrySlug === city.countrySlug) continue;
      const d = haversine(city, other);
      if (best.length < NEARBY_LINKS) {
        best.push({ p: other, d });
        best.sort((a, b) => a.d - b.d);
      } else if (d < best[best.length - 1].d) {
        best[best.length - 1] = { p: other, d };
        best.sort((a, b) => a.d - b.d);
      }
    }
    for (const n of best) {
      add(key(city), n.p);
      add(key(n.p), city); // the link back, which is what creates inbound
    }
  }
  nearbyCache = out;
  return out;
}

/**
 * The IANA area of a zone id ("Europe/Tbilisi" -> "Europe"). IANA areas are
 * continents and oceans, so they group countries geographically without
 * introducing a second, hand-maintained country-to-continent table.
 */
function ianaArea(iana: string): string {
  return iana.split("/")[0];
}

const AREA_LABEL: Record<string, string> = {
  Africa: "Africa",
  America: "the Americas",
  Antarctica: "Antarctica",
  Arctic: "the Arctic",
  Asia: "Asia",
  Atlantic: "the Atlantic",
  Australia: "Australia",
  Europe: "Europe",
  Indian: "the Indian Ocean",
  Pacific: "the Pacific",
};

/** Reader-facing name for a zone's IANA area, for link-block headings. */
function areaLabel(iana: string): string {
  const area = ianaArea(iana);
  return AREA_LABEL[area] ?? area.replace(/_/g, " ");
}

export function resolvePlace(segments: string[]): PlaceTarget | null {
  if (segments.length === 0 || segments.length > 2) return null;
  const country = COUNTRY_BY_SLUG.get(segments[0]);
  if (!country) return null;
  if (segments.length === 1) return { kind: "country", country };

  const key = `${segments[0]}/${segments[1]}`;
  const city = PLACE_BY_KEY.get(key);
  if (city) return { kind: "city", place: city, country };
  const region = REGION_BY_KEY.get(key);
  if (region) return { kind: "region", region, country };
  return null;
}

export function targetPath(t: PlaceTarget): string {
  if (t.kind === "country") return `/time/${t.country.slug}`;
  if (t.kind === "region") return `/time/${t.region.countrySlug}/${t.region.slug}`;
  return `/time/${t.place.countrySlug}/${t.place.slug}`;
}

export function targetSide(t: PlaceTarget): Side {
  const key =
    t.kind === "country" ? countryKey(t.country) : t.kind === "region" ? `${t.region.entity}-time` : `${t.place.entity}-time`;
  const fromRegistry = sideFor(key);
  if (fromRegistry) return fromRegistry;
  // the entity exists but another key claimed the slug: build it inline
  if (t.kind === "country") {
    return { key, kind: "country", label: t.country.short, long: t.country.name, tz: t.country.primary, href: targetPath(t) };
  }
  if (t.kind === "region") {
    return {
      key,
      kind: "region",
      label: t.region.name,
      long: `${t.region.name}, ${t.region.countryShort}`,
      tz: t.region.primary,
      href: targetPath(t),
    };
  }
  return {
    key,
    kind: "city",
    label: t.place.name,
    long: `${t.place.name}, ${t.place.countryShort}`,
    tz: t.place.tz,
    href: targetPath(t),
    lat: t.place.lat,
    lng: t.place.lng,
  };
}

/* -------------------------------------------------------------------- names */

const CITY_ALIAS: Record<string, string> = {
  "Los Angeles": "LA",
  "New York": "NYC",
  Washington: "DC",
  "Ho Chi Minh City": "Saigon",
  Mumbai: "Bombay",
  Kolkata: "Calcutta",
  Chennai: "Madras",
  Beijing: "Peking",
};

interface Names {
  name: string; // "London"
  nameShort: string; // "London, UK"
  full: string; // "London, United Kingdom"
  zones: string[];
  primary: string;
  multiZone: boolean;
  countryName: string;
  countrySlug: string;
  countryShort: string;
}

function namesOf(t: PlaceTarget): Names {
  if (t.kind === "country") {
    return {
      name: t.country.short,
      nameShort: t.country.short,
      full: t.country.name,
      zones: t.country.zones,
      primary: t.country.primary,
      multiZone: t.country.multiZone,
      countryName: t.country.name,
      countrySlug: t.country.slug,
      countryShort: t.country.short,
    };
  }
  if (t.kind === "region") {
    return {
      name: t.region.name,
      nameShort: t.region.name,
      full: `${t.region.name}, ${t.region.countryName}`,
      zones: t.region.zones,
      primary: t.region.primary,
      multiZone: t.region.multiZone,
      countryName: t.region.countryName,
      countrySlug: t.region.countrySlug,
      countryShort: t.region.countryShort,
    };
  }
  return {
    name: t.place.name,
    nameShort: `${t.place.name}, ${t.place.countryShort}`,
    full: `${t.place.name}, ${t.place.countryName}`,
    zones: [t.place.tz],
    primary: t.place.tz,
    multiZone: false,
    countryName: t.place.countryName,
    countrySlug: t.place.countrySlug,
    countryShort: t.place.countryShort,
  };
}

/* ------------------------------------------------------- distinct zone list */

export interface ZoneRow {
  tz: string;
  abbr: string;
  offset: number;
  offsetText: string;
  longName: string;
  cities: { name: string; href: string }[];
}

function zoneRows(names: Names, now: number): ZoneRow[] {
  const seen = new Set<string>();
  const out: ZoneRow[] = [];
  for (const tz of names.zones) {
    const sig = `${offsetMinutes(tz, Date.UTC(new Date(now).getUTCFullYear(), 0, 15, 12))}:${offsetMinutes(
      tz,
      Date.UTC(new Date(now).getUTCFullYear(), 6, 15, 12)
    )}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    const cities = PLACES.filter((p) => p.countrySlug === names.countrySlug && p.tz === tz)
      .slice(0, 6)
      .map((p) => ({ name: p.name, href: `/time/${p.countrySlug}/${p.slug}` }));
    out.push({
      tz,
      abbr: abbrFor(tz, now),
      offset: offsetMinutes(tz, now),
      offsetText: fmtOffset(offsetMinutes(tz, now)),
      longName: longZoneName(tz, now),
      cities,
    });
  }
  return out;
}

/* ------------------------------------------------------- comparison cities */

const COMPARE_KEYS = [
  "new-york-time",
  "los-angeles-time",
  "london-time",
  "paris-time",
  "dubai-time",
  "india-time",
  "manila-time",
  "tokyo-time",
  "sydney-time",
  "toronto-time",
  "chicago-time",
  "singapore-time",
];

export interface CompareRow {
  label: string;
  tz: string;
  href: string;
  diffText: string;
}

function compareRows(selfKey: string, self: Side, now: number): CompareRow[] {
  const out: CompareRow[] = [];
  for (const key of COMPARE_KEYS) {
    if (out.length >= 10) break;
    if (key === selfKey) continue;
    const other = sideFor(key);
    if (!other || other.tz === self.tz) continue;
    const d = diffMinutes(self, other, now);
    const pairSlug = `${selfKey}-to-${key}`;
    const href = isIndexedPair(pairSlug) ? `/${pairSlug}` : other.href || "/world-clock";
    out.push({
      label: other.label,
      tz: other.tz,
      href,
      diffText:
        d === 0
          ? "Same time"
          : `${fmtDuration(d)} ${d > 0 ? "ahead" : "behind"}`,
    });
  }
  return out;
}

/* --------------------------------------------------------------- DST blocks */

export interface DstChange {
  dateText: string;
  direction: "forward" | "back";
  localHour: string;
  fromAbbr: string;
  toAbbr: string;
  fromOffset: number;
  toOffset: number;
  text: string;
}

export function dstChangesFor(tz: string, year: number): DstChange[] {
  return transitionsInYear(tz, year).map((t) => {
    const before = wallTime(tz, t.at - 60_000);
    const fromAbbr = abbrFor(tz, t.at - 60_000);
    const toAbbr = abbrFor(tz, t.at + 60_000);
    const localHour = fmtClock(before.hour, before.minute, false);
    const direction: "forward" | "back" = t.to > t.from ? "forward" : "back";
    return {
      dateText: fmtDate(before, true),
      direction,
      localHour,
      fromAbbr,
      toAbbr,
      fromOffset: t.from,
      toOffset: t.to,
      text: `Clocks go ${direction} 1 hour at ${localHour} local time, from ${fromAbbr} (${fmtOffset(
        t.from
      )}) to ${toAbbr} (${fmtOffset(t.to)}).`,
    };
  });
}

/** Countries with a clock change this year or next, for the DST cross-link. */
let dstSlugCache: Set<string> | null = null;
const dstSlugs = {
  has(slug: string) {
    if (!dstSlugCache) dstSlugCache = new Set(dstCountries());
    return dstSlugCache.has(slug);
  },
};

/* ------------------------------------------------------------- buildPlace */

export interface PlaceContent {
  kind: PlaceTarget["kind"];
  path: string;
  dstHref: string | null;
  title: string;
  description: string;
  h1: string;
  answer: string;
  crumbs: { name: string; path: string }[];
  side: Side;
  names: Names;
  zoneRows: ZoneRow[];
  multiZoneHref: string | null;
  converterSides: Side[];
  zoneFacts: { label: string; value: string }[];
  compareRows: CompareRow[];
  dstYears: { year: number; changes: DstChange[] }[];
  observesDst: boolean;
  faqs: FaqItem[];
  children: { heading: string; items: { href: string; label: string }[] }[];
  updatedDate: string;
  lat?: number;
  lng?: number;
  jsonLdKind: "City" | "AdministrativeArea" | "Country";
}

export function buildPlace(t: PlaceTarget, now: number = Date.now()): PlaceContent {
  const names = namesOf(t);
  const side = targetSide(t);
  const path = targetPath(t);
  const year = wallTime(names.primary, now).year;

  const rows = zoneRows(names, now);
  const abbr = sideAbbr(side, now);
  const off = offsetMinutes(names.primary, now);
  const longName = longZoneName(names.primary, now);
  const info = dstInfo(side, now);
  const observesDst = info.observes;

  /* --------------------------------------------------------------- answer */

  let answer: string;
  if (names.multiZone && rows.length > 1) {
    answer = `${names.name} has more than one time zone. The main one (${
      rows[0].cities[0]?.name ?? names.name
    }) is ${longName} – ${abbr} (${fmtOffset(off)}) right now.`;
  } else if (observesDst && info.next) {
    answer = `${names.name} is on ${longName} – ${abbr} (${fmtOffset(
      off
    )}) right now. It switches to ${info.next.toAbbr} (${fmtOffset(info.next.toOffset)}) on ${info.next.dateText}.`;
  } else {
    answer = `${names.name} is on ${longName} – ${abbr} (${fmtOffset(
      off
    )}) right now. ${names.name} does not observe daylight saving time.`;
  }

  /* ---------------------------------------------------------------- title */

  const titleText = firstThatFits(
    [
      brandTitle(`Time in ${names.nameShort} Now – Current Local Time`),
      `Time in ${names.nameShort} Now – Current Local Time`,
      brandTitle(`Time in ${names.nameShort} Now`),
      `Time in ${names.nameShort} Now`,
      `Time in ${names.full} Now`,
    ],
    60
  );

  const nextSentence = observesDst && info.next
    ? `Clocks change on ${info.next.dateText}.`
    : `No daylight saving time.`;
  const description = clip(
    `Current local time in ${names.full}: ${abbr} (${fmtOffset(
      off
    )}). ${nextSentence} Convert ${names.name} time to your time zone.`,
    155
  );

  /* ------------------------------------------------------------------- h1 */

  const alias = t.kind === "city" ? CITY_ALIAS[t.place.name] : undefined;
  const h1 =
    t.kind === "city"
      ? `Current Time in ${t.place.name}${alias ? ` (${alias})` : ""}, ${names.countryName}`
      : `Current Time in ${names.full}`;

  /* --------------------------------------------------------------- crumbs */

  const crumbs: { name: string; path: string }[] = [
    { name: "Home", path: "/" },
    { name: "Current time", path: "/world-clock" },
  ];
  if (t.kind !== "country") crumbs.push({ name: names.countryShort, path: `/time/${names.countrySlug}` });
  crumbs.push({ name: names.name, path });

  /* ------------------------------------------------------------ converter */

  const isAmericas = names.primary.startsWith("America") || names.primary.startsWith("Pacific/Honolulu");
  const partnerKey = isAmericas ? "utc" : "est";
  const partner = sideFor(partnerKey)!;
  const converterSides = [side, partner.tz === side.tz ? sideFor("utc")! : partner];

  /* ----------------------------------------------------------- zone facts */

  const zoneFacts = [
    { label: "Time zone", value: longName },
    { label: "Abbreviation", value: abbr },
    { label: "UTC offset", value: fmtOffset(off) },
    { label: "IANA time zone id", value: names.primary },
  ];
  if (observesDst) {
    const s = seasonalOffsets(names.primary, year);
    zoneFacts.push({
      label: "Daylight saving time",
      value: `Yes – ${fmtOffset(s.std)} in winter, ${fmtOffset(s.dst ?? s.std)} in summer`,
    });
  } else {
    zoneFacts.push({ label: "Daylight saving time", value: "Not observed" });
  }

  /* ------------------------------------------------------------- children */

  const children: { heading: string; items: { href: string; label: string }[] }[] = [];

  // Conversions that use this place as one side. Place-keyed pairs such as
  // /uk-time-to-thailand-time are not reachable from a zone page, because a
  // zone page only covers zone keys, so the place's own page is the natural
  // home for them.
  const placePairs = pairsWith(side.key).map((slug) => {
    const at = slug.indexOf("-to-");
    const q = pairFromKeys(slug.slice(0, at), slug.slice(at + 4));
    return { href: `/${slug}`, label: q ? `${tLabel(q.from)} to ${tLabel(q.to)}` : slug };
  });
  if (placePairs.length) {
    children.push({ heading: `Convert ${names.name} time`, items: placePairs });
  }
  if (t.kind === "country") {
    const regions = REGIONS.filter((r) => r.countrySlug === t.country.slug);
    if (regions.length) {
      children.push({
        heading: `States and regions of ${names.name}`,
        items: regions.map((r) => ({ href: `/time/${r.countrySlug}/${r.slug}`, label: r.name })),
      });
    }
    // Every city in the country, so none depends on a sitemap to be found.
    const cities = PLACES.filter((p) => p.countrySlug === t.country.slug);
    if (cities.length) {
      children.push({
        heading: `Current time in ${names.name} cities`,
        items: cities.map((p) => ({ href: `/time/${p.countrySlug}/${p.slug}`, label: p.name })),
      });
    }
    // Countries sharing this one's IANA area. A small country is otherwise
    // linked only from the map hub, which left 140 of them under the five
    // inbound links docs/11 asks for. The IANA area is a geographic grouping
    // that is already in the data, so this needs no new source of truth.
    const peers = COUNTRIES.filter(
      (c) => c.slug !== t.country.slug && ianaArea(c.primary) === ianaArea(names.primary)
    );
    if (peers.length) {
      children.push({
        heading: `Other countries in ${areaLabel(names.primary)}`,
        items: peers.map((c) => ({ href: `/time/${c.slug}`, label: c.name })),
      });
    }
  } else if (t.kind === "region") {
    const cities = PLACES.filter(
      (p) => p.countrySlug === t.region.countrySlug && p.regionSlug === slugOfRegion(t.region)
    );
    if (cities.length) {
      children.push({
        heading: `Cities in ${names.name}`,
        items: cities.map((p) => ({ href: `/time/${p.countrySlug}/${p.slug}`, label: p.name })),
      });
    }
    // Sibling regions. A region page previously linked only downwards to its
    // own cities, so every region depended on its country page alone.
    const siblings = REGIONS.filter(
      (r) => r.countrySlug === t.region.countrySlug && slugOfRegion(r) !== slugOfRegion(t.region)
    );
    if (siblings.length) {
      children.push({
        heading: `Other states and regions of ${names.countryShort}`,
        items: siblings.map((r) => ({ href: `/time/${r.countrySlug}/${r.slug}`, label: r.name })),
      });
    }
  } else {
    const inCountry = PLACES.filter((p) => p.countrySlug === t.place.countrySlug);
    const self = inCountry.findIndex((p) => p.slug === t.place.slug);
    // Largest cities, then this city's neighbours in the population ranking.
    // The neighbour window chains every city in the country together, so even
    // the smallest is reachable by crawling rather than only from a sitemap.
    const picked = new Map<string, Place>();
    for (const p of inCountry.slice(0, 12)) if (p.slug !== t.place.slug) picked.set(p.slug, p);
    for (const p of inCountry.slice(Math.max(0, self - 8), self + 9)) {
      if (p.slug !== t.place.slug) picked.set(p.slug, p);
    }
    if (t.place.regionSlug) {
      const sameRegion = inCountry
        .filter((p) => p.regionSlug === t.place.regionSlug && p.slug !== t.place.slug)
        .slice(0, 10);
      for (const p of sameRegion) picked.set(p.slug, p);
    }
    const cities = [...picked.values()];
    if (cities.length) {
      children.push({
        heading: `Other cities in ${names.countryShort}`,
        items: cities.map((p) => ({ href: `/time/${p.countrySlug}/${p.slug}`, label: p.name })),
      });
    }
    // Nearest cities, from the symmetric graph above. Present on a page either
    // because this city is in a sparsely-covered country, or because a city in
    // one named it — the second case is what supplies the inbound links.
    const nearby = nearbyCities().get(`${t.place.countrySlug}/${t.place.slug}`) ?? [];
    if (nearby.length) {
      children.push({
        heading: `Nearest cities to ${t.place.name}`,
        items: nearby.map((p) => ({
          href: `/time/${p.countrySlug}/${p.slug}`,
          label: `${p.name}, ${p.countryShort}`,
        })),
      });
    }
  }

  // The US map page is reachable only from the map hub otherwise. Every US
  // page is a natural place to offer it.
  const inUsa =
    (t.kind === "country" && t.country.slug === "usa") ||
    (t.kind === "region" && t.region.countrySlug === "usa") ||
    (t.kind === "city" && t.place.countrySlug === "usa");
  if (inUsa && targetPath(t) !== "/time/usa") {
    children.push({
      heading: "United States time zones",
      items: [
        { href: "/time-zone-map/usa", label: "US time zone map" },
        { href: "/time/usa", label: "Current time in the United States" },
        { href: "/time-zone/usa", label: "US time zones explained" },
      ],
    });
  }

  /* ------------------------------------------------------------------ FAQ */

  const compare = compareRows(side.key, side, now);
  const first = compare[0];
  const faqs: FaqItem[] = [
    {
      q: `What time is it in ${names.name} right now?`,
      a: `${names.name} is on ${abbr} (${fmtOffset(
        off
      )}). The live clock at the top of this page shows the current local time in ${names.name}, updated every second.`,
    },
    {
      q: `What time zone is ${names.name} in?`,
      a: names.multiZone && rows.length > 1
        ? `${names.name} uses ${rows.length} time zones: ${rows.map((r) => r.abbr).join(", ")}. The main zone is ${longName} (${names.primary}).`
        : `${names.name} is in ${longName}, abbreviated ${abbr}, ${fmtOffset(off)}. Its IANA time zone id is ${names.primary}.`,
    },
    {
      q: `Does ${names.name} observe daylight saving time?`,
      a: observesDst && info.next
        ? `Yes. The next change is on ${info.next.dateText}, when clocks go ${info.next.direction} one hour from ${info.next.fromAbbr} to ${info.next.toAbbr}.`
        : `No. ${names.name} stays on ${fmtOffset(off)} all year.`,
    },
  ];
  if (first) {
    faqs.push({
      q: `What is the time difference between ${names.name} and ${first.label}?`,
      a: `${first.diffText === "Same time" ? `${names.name} and ${first.label} are on the same time.` : `${first.label} is ${first.diffText.replace(" ahead", " ahead of").replace(" behind", " behind")} ${names.name}.`}`,
    });
  }

  const dstYears = observesDst
    ? [year, year + 1].map((y) => ({ year: y, changes: dstChangesFor(names.primary, y) })).filter((x) => x.changes.length)
    : [];

  const dstHref = observesDst && dstSlugs.has(names.countrySlug) ? `/daylight-saving-time/${names.countrySlug}` : null;

  const multiZoneHref =
    names.multiZone && rows.length > 1
      ? t.kind === "country"
        ? `/time-zone/${t.country.slug}`
        : t.kind === "region"
          ? `/time-zone/${t.region.entity}`
          : null
      : null;

  return {
    kind: t.kind,
    path,
    dstHref,
    title: titleText,
    description,
    h1,
    answer,
    crumbs,
    side,
    names,
    zoneRows: rows,
    multiZoneHref,
    converterSides,
    zoneFacts,
    compareRows: compare,
    dstYears,
    observesDst,
    faqs,
    children,
    updatedDate: fmtDate(wallTime(names.primary, now), true),
    lat: t.kind === "city" ? t.place.lat : undefined,
    lng: t.kind === "city" ? t.place.lng : undefined,
    jsonLdKind: t.kind === "city" ? "City" : t.kind === "region" ? "AdministrativeArea" : "Country",
  };
}

function slugOfRegion(r: Region): string {
  return r.slug.endsWith("-state") ? r.slug.slice(0, -6) : r.slug;
}

/* --------------------------------------------------- buildMultiZone (type E) */

export type MultiZoneTarget =
  | { kind: "country"; country: Country }
  | { kind: "region"; region: Region };

export function resolveMultiZone(slug: string): MultiZoneTarget | null {
  const country = COUNTRY_BY_SLUG.get(slug);
  if (country && country.multiZone) return { kind: "country", country };
  const region = REGION_BY_ENTITY.get(slug);
  if (region && region.multiZone) return { kind: "region", region };
  return null;
}

export interface MultiZoneContent {
  path: string;
  title: string;
  description: string;
  h1: string;
  answer: string;
  crumbs: { name: string; path: string }[];
  names: Names;
  side: Side;
  zoneRows: ZoneRow[];
  converterSides: Side[];
  zoneFacts: { label: string; value: string }[];
  dstYears: { year: number; changes: DstChange[] }[];
  observesDst: boolean;
  faqs: FaqItem[];
  placeHref: string;
  dstHref: string | null;
  siblings: { href: string; label: string }[];
  updatedDate: string;
}

export function buildMultiZone(t: MultiZoneTarget, now: number = Date.now()): MultiZoneContent {
  const placeTarget: PlaceTarget =
    t.kind === "country"
      ? { kind: "country", country: t.country }
      : { kind: "region", region: t.region, country: COUNTRY_BY_SLUG.get(t.region.countrySlug)! };
  const base = buildPlace(placeTarget, now);
  const names = base.names;
  const path = `/time-zone/${t.kind === "country" ? t.country.slug : t.region.entity}`;
  const abbrs = base.zoneRows.map((r) => r.abbr);

  const titleText = firstThatFits(
    t.kind === "country"
      ? [
          brandTitle(`${names.name} Time Zones – What Time Zone Is ${names.name}?`),
          `${names.name} Time Zones – What Time Zone Is ${names.name}?`,
          `${names.name} Time Zones`,
        ]
      : [
          brandTitle(`What Time Zone Is ${names.name}? ${abbrs.join(", ")}`),
          `What Time Zone Is ${names.name}? ${abbrs.join(", ")}`,
          brandTitle(`What Time Zone Is ${names.name}?`),
          `What Time Zone Is ${names.name}?`,
        ],
    60
  );

  const answer = `${names.name} uses ${base.zoneRows.length} time zones: ${base.zoneRows
    .map((r) => `${r.abbr} (${r.offsetText})`)
    .join(", ")}. ${base.zoneRows[0].cities[0]?.name ? `${base.zoneRows[0].cities[0].name} is on ${base.zoneRows[0].abbr}.` : ""}`.trim();

  const faqs: FaqItem[] = [
    {
      q: `What time zone is ${names.name} in?`,
      a: `${names.name} spans ${base.zoneRows.length} time zones: ${base.zoneRows
        .map((r) => `${r.abbr} (${r.offsetText})`)
        .join(", ")}.`,
    },
    {
      q: `Which areas of ${names.name} use each time zone?`,
      a: base.zoneRows
        .map((r) => `${r.abbr}: ${r.cities.slice(0, 4).map((c) => c.name).join(", ") || r.tz}`)
        .join(". "),
    },
    {
      q: `Does all of ${names.name} observe daylight saving time?`,
      a: (() => {
        const observing = base.zoneRows.filter((r) => seasonalOffsets(r.tz, new Date(now).getUTCFullYear()).dst !== null);
        if (observing.length === base.zoneRows.length) return `Yes, every zone in ${names.name} changes its clocks.`;
        if (observing.length === 0) return `No. No part of ${names.name} changes its clocks.`;
        return `No. ${observing.map((r) => r.abbr).join(", ")} change, while ${base.zoneRows
          .filter((r) => !observing.includes(r))
          .map((r) => r.abbr)
          .join(", ")} stay the same all year.`;
      })(),
    },
  ];

  return {
    path,
    title: titleText,
    description: clip(
      `${names.name} uses ${base.zoneRows.length} time zones (${abbrs.join(
        ", "
      )}). See which areas use each zone, the current time in each and DST dates.`,
      155
    ),
    h1: `What Time Zone Is ${names.name}?`,
    answer,
    crumbs: [
      { name: "Home", path: "/" },
      { name: "Time zones", path: "/time-zones" },
      { name: `${names.name} time zones`, path },
    ],
    names,
    side: base.side,
    zoneRows: base.zoneRows,
    converterSides: base.converterSides,
    zoneFacts: base.zoneFacts,
    dstYears: base.dstYears,
    observesDst: base.observesDst,
    faqs,
    placeHref: base.path,
    dstHref: base.dstHref,
    // Other countries and states that span several zones. These pages sat on
    // one or two inbound links each, from the map hub and their own place
    // page, so they cross-link to each other as a set.
    siblings: multiZoneEntities()
      // multiZoneEntities keys regions by `entity`, not by the region slug.
      .filter((e) => e.slug !== (t.kind === "country" ? t.country.slug : t.region.entity))
      .map((e) => {
        const r = resolveMultiZone(e.slug);
        const label = !r ? e.slug : r.kind === "country" ? r.country.name : r.region.name;
        return { href: `/time-zone/${e.slug}`, label };
      })
      .sort((a, b) => a.label.localeCompare(b.label)),
    updatedDate: base.updatedDate,
  };
}

/* --------------------------------------------------------- buildZone (type F) */

export interface ZoneContent {
  path: string;
  slug: string;
  title: string;
  description: string;
  h1: string;
  answer: string;
  note?: string;
  inForceNote?: string;
  crumbs: { name: string; path: string }[];
  side: Side;
  zone: Zone;
  converterSides: Side[];
  regionText: string;
  countries: { href: string; label: string }[];
  cities: { href: string; label: string }[];
  dstHeading: string;
  dstText: string;
  conversions: { href: string; label: string }[];
  moreConversions: { href: string; label: string }[];
  siblingZones: { href: string; label: string }[];
  faqs: FaqItem[];
  updatedDate: string;
  offsetText: string;
}

export function buildZone(zone: Zone, now: number = Date.now()): ZoneContent {
  const side = zoneSide(zone);
  const path = `/zones/${zone.slug}`;
  const year = wallTime(zone.iana, now).year;
  const { std, dst } = seasonalOffsets(zone.iana, year);
  const cp = counterpartOf(zone.slug);
  const liveAbbr = abbrFor(zone.iana, now);
  const ownOffset =
    zone.kind === "dst" ? (dst ?? std) : zone.kind === "std" ? std : offsetMinutes(zone.iana, now);
  const offsetText = fmtOffset(ownOffset);

  /* ------------------------------------------------------- answer (<= 50 w) */

  let answer: string;
  if (zone.kind === "generic") {
    answer = `${zone.name} (${zone.abbr}) is the local time on the clocks of ${zone.region}.`;
  } else if (zone.kind === "fixed") {
    answer = `${zone.name} (${zone.abbr}) is ${offsetText}. It is used in ${zone.region} and does not change for daylight saving time.`;
  } else if (zone.kind === "std") {
    answer = `${zone.name} (${zone.abbr}) is ${fmtOffset(std)}. It is the standard (winter) time of ${zone.region}${
      cp && dst !== null ? `; in summer the same area uses ${cp.abbr} (${fmtOffset(dst)})` : ""
    }.`;
  } else {
    answer = `${zone.name} (${zone.abbr}) is ${fmtOffset(
      dst ?? std
    )}. It is the daylight saving (summer) time of ${zone.region}${
      cp ? `; in winter the area returns to ${cp.abbr} (${fmtOffset(std)})` : ""
    }.`;
  }

  const inForceNote =
    (zone.kind === "std" || zone.kind === "dst") && liveAbbr !== zone.abbr
      ? `${zone.abbr} is not in force right now – the zone is currently on ${liveAbbr} (${fmtOffset(
          offsetMinutes(zone.iana, now)
        )}).`
      : undefined;

  const titleText = firstThatFits(
    [
      brandTitle(`${zone.abbr} Time Now – ${zone.name} (${offsetText})`),
      `${zone.abbr} Time Now – ${zone.name} (${offsetText})`,
      brandTitle(`${zone.abbr} Time Now – ${zone.name}`),
      `${zone.abbr} Time Now – ${zone.name}`,
    ],
    60
  );

  /* ----------------------------------------------------- where it is used */

  const countries = COUNTRIES.filter((c) => {
    const s = seasonalOffsets(c.primary, year);
    return s.std === std && s.dst === dst;
  })
    .slice(0, 24)
    .map((c) => ({ href: `/time/${c.slug}`, label: c.name }));

  const cities = PLACES.filter((p) => p.tz === zone.iana)
    .slice(0, 16)
    .map((p) => ({ href: `/time/${p.countrySlug}/${p.slug}`, label: p.name }));

  /* ------------------------------------------------------------------ DST */

  const nt = nextTransition(zone.iana, now);
  const dstText =
    dst === null || !nt
      ? `${zone.name} does not change for daylight saving time. It stays on ${offsetText} every day of the year.`
      : (() => {
          const before = wallTime(zone.iana, nt.at - 60_000);
          return `The next change is on ${fmtDate(before, true)} at ${fmtClock(
            before.hour,
            before.minute,
            false
          )} local time: clocks go ${nt.to > nt.from ? "forward" : "back"} one hour, from ${abbrFor(
            zone.iana,
            nt.at - 60_000
          )} (${fmtOffset(nt.from)}) to ${abbrFor(zone.iana, nt.at + 60_000)} (${fmtOffset(nt.to)}).`;
        })();

  /* ----------------------------------------------------------- conversions */

  // Every indexed pair that touches this zone, not a sample. A zone page sits
  // two clicks from home, so it is the only page that can put its pairs within
  // the three-click budget in docs/11. Capping the list left the pairs whose
  // BOTH sides are high-volume zones -- /sgt-to-bst, /gmt-to-bst, /mst-to-sgt
  // -- outside every cap at once, which is why 412 of them sat four clicks
  // deep. Only twelve keys have more than 150 pairs; for the other 286 this
  // list was already complete.
  const allConversions = pairsWith(zone.slug).map((slug) => {
    const at = slug.indexOf("-to-");
    const q = pairFromKeys(slug.slice(0, at), slug.slice(at + 4));
    return { href: `/${slug}`, label: q ? `${tLabel(q.from)} to ${tLabel(q.to)}` : slug };
  });
  // The popular ones stay in plain sight; the tail goes behind a disclosure so
  // a 585-link zone page still reads calmly. Both are in the server-rendered
  // HTML, so crawlers follow them either way.
  const conversions = allConversions.slice(0, 48);
  const moreConversions = allConversions.slice(48);

  // Sibling zones. A zone page was linked from the zones hub and from the
  // "Learn more" block of pair pages that happen to use it, which left 28 of
  // the 62 under five inbound links.
  // Generic zones (ET, CT, MT, PT) are included: their pairs are filed under
  // the alias (est, cst, ...), so no conversion block ever points at them and
  // they were the last four zone pages under five inbound links.
  const siblingZones = ZONES.filter((z) => z.slug !== zone.slug).map((z) => ({
    href: `/zones/${z.slug}`,
    label: `${z.abbr} – ${z.name}`,
  }));

  /* ------------------------------------------------------------------ FAQ */

  const faqs: FaqItem[] = [
    { q: `What is ${zone.abbr}?`, a: answer },
    {
      q: `What is the current ${zone.abbr} time?`,
      a: `${zone.abbr} is ${offsetText}. The live clock on this page shows the current ${zone.name} time, updated every second.`,
    },
  ];
  if (cp) {
    faqs.push({
      q: `What is the difference between ${zone.abbr} and ${cp.abbr}?`,
      a: `${cp.abbr} is one hour ${
        (cp.kind === "dst" ? 1 : -1) > 0 ? "ahead of" : "behind"
      } ${zone.abbr}. ${zone.kind === "std" || zone.kind === "fixed" ? `${zone.abbr} is the standard time; ${cp.abbr} is used during daylight saving time.` : `${zone.abbr} is used during daylight saving time; ${cp.abbr} is the standard time.`}`,
    });
  }
  const generic = ZONES.find((z) => z.kind === "generic" && z.iana === zone.iana);
  if (generic && generic.slug !== zone.slug) {
    faqs.push({
      q: `Is ${zone.abbr} the same as ${generic.abbr}?`,
      a: `${generic.abbr} (${generic.name}) is the year-round name. ${zone.abbr} is the exact name used ${
        zone.kind === "dst" ? "in summer" : "in winter"
      }. People often write ${generic.abbr} when they mean whichever one is in force today.`,
    });
  }
  faqs.push({
    q: `Which countries use ${zone.abbr}?`,
    a: `${zone.abbr} is used in ${zone.region}.`,
  });

  return {
    path,
    slug: zone.slug,
    title: titleText,
    description: clip(
      `${zone.name} (${zone.abbr}) is ${offsetText}. ${
        dst !== null && cp ? `It becomes ${cp.abbr} during daylight saving time.` : "It does not change for daylight saving time."
      } Live ${zone.abbr} clock, conversions and the regions that use it.`,
      155
    ),
    h1: `${zone.name} (${zone.abbr})`,
    answer,
    note: zone.note,
    inForceNote,
    crumbs: [
      { name: "Home", path: "/" },
      { name: "Time zones", path: "/time-zones" },
      { name: zone.abbr, path },
    ],
    side,
    zone,
    converterSides: [side, sideFor(zone.slug === "utc" ? "est" : "utc")!],
    regionText: zone.region,
    countries,
    cities,
    dstHeading: `${zone.abbr} and daylight saving time`,
    dstText,
    conversions,
    moreConversions,
    siblingZones,
    faqs,
    updatedDate: fmtDate(wallTime(zone.iana, now), true),
    offsetText,
  };
}

export { ZONE_BY_SLUG, familyName };
