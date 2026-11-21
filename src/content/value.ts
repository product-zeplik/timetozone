/**
 * Per-page computed value for pair and hour pages (template v2, behind src/seo/template-flags.ts).
 *
 * Every number and date here comes from the engine at render time (CLAUDE.md rule 1); every list comes from the
 * curated data. Nothing is prose that could be pasted onto another page: each block answers a question about this
 * pair or this hour that its siblings answer differently.
 *
 *   pair: the next two changes of the difference (or the fact that it never changes), the working-hours overlap in
 *         each period of the year, where each side's clock is used, and the indexed URLs that answer the identical
 *         question (Germany time and Berlin time are one clock), linked as each other's equivalent.
 *   hour: this hour on each side of every change in the year, where the hour falls in each side's day, the nearest
 *         hour that is a working hour for both, and links to the neighbouring hours only.
 */
import { ZONES } from "@/data/zones";
import type { Side } from "@/engine/side";
import { sideAbbr } from "@/engine/side";
import { convertAt, diffMinutes, diffPeriods, directionPhrase, wallOf, type Period } from "@/engine/pair";
import { fmtClock, fmtDate, fmtDuration, hourDisplay, hourLabel, transitionsInYear } from "@/engine/tz";
import {
  COUNTRIES,
  COUNTRY_BY_SLUG,
  PLACES,
  PLACE_BY_KEY,
  REGION_BY_KEY,
  pairFromKeys,
  type ParsedPair,
} from "@/engine/entities";
import { indexedPairs, isIndexedPair, volumeFor } from "@/seo/gate";
import { pairLabelFromSides, tLabel } from "./labels";

export interface LinkItem {
  href: string;
  label: string;
}

export interface PairValue {
  changesHeading: string;
  changes: string[];
  overlapHeading: string;
  overlapLead: string;
  overlapRows: { period: string; diff: string; core: string; extended: string }[];
  coverageHeading: string;
  coverage: { side: string; text: string; links: LinkItem[] }[];
  equivalentHeading: string | null;
  equivalentText: string | null;
  equivalents: LinkItem[];
}

export interface HourValue {
  yearHeading: string;
  yearRows: { period: string; text: string }[];
  dayHeading: string;
  dayText: string[];
  neighbours: LinkItem[];
}

const DAY = 86_400_000;
const sideAt = (s: Side) => (s.fixed !== undefined && s.fixed !== null ? null : s.tz);

/* ------------------------------------------------------------ difference changes */

interface Change {
  at: number;
  sides: { side: Side; fromAbbr: string; toAbbr: string; forward: boolean }[];
  before: number;
  after: number;
}

/** The instants within `horizonDays` at which either side changes its clocks, same-day changes merged (docs/14 #3). */
function upcomingChanges(from: Side, to: Side, now: number, horizonDays = 400): Change[] {
  const year = new Date(now).getUTCFullYear();
  const events: { at: number; side: Side; forward: boolean }[] = [];
  for (const side of [from, to]) {
    const tz = sideAt(side);
    if (!tz) continue;
    for (const y of [year, year + 1, year + 2])
      for (const t of transitionsInYear(tz, y)) if (t.at > now && t.at - now <= horizonDays * DAY) events.push({ at: t.at, side, forward: t.to > t.from });
  }
  events.sort((a, b) => a.at - b.at);
  const out: Change[] = [];
  for (const e of events) {
    const last = out[out.length - 1];
    const entry = { side: e.side, fromAbbr: sideAbbr(e.side, e.at - 60_000), toAbbr: sideAbbr(e.side, e.at + 60_000), forward: e.forward };
    if (last && e.at - last.at < 2 * DAY) {
      if (!last.sides.some((s) => s.side === e.side)) last.sides.push(entry);
      last.after = diffMinutes(from, to, e.at + 2 * DAY);
      continue;
    }
    out.push({ at: e.at, sides: [entry], before: diffMinutes(from, to, e.at - 60_000), after: diffMinutes(from, to, e.at + 2 * DAY) });
  }
  return out;
}

function diffPhrase(minutes: number, A: string, B: string): string {
  return minutes === 0 ? `${B} and ${A} show the same time` : `${B} is ${fmtDuration(minutes)} ${directionPhrase(minutes)} ${A}`;
}

/* -------------------------------------------------------------------- overlap */

/** Minutes of `from`'s day [start, end) that are also inside [start, end) on `to`'s clock, for a difference `d`. */
function windowOverlap(d: number, start: number, end: number): { fromStart: number; fromEnd: number } | null {
  const fromStart = Math.max(start, start - d);
  const fromEnd = Math.min(end, end - d);
  return fromEnd > fromStart ? { fromStart, fromEnd } : null;
}

const clockOf = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return fmtClock(Math.floor(m / 60), m % 60);
};

function overlapText(d: number, start: number, end: number, abbrA: string, abbrB: string): string {
  const o = windowOverlap(d, start, end);
  if (!o) return "none";
  return `${clockOf(o.fromStart)}–${clockOf(o.fromEnd)} ${abbrA} (${clockOf(o.fromStart + d)}–${clockOf(o.fromEnd + d)} ${abbrB}), ${fmtDuration(o.fromEnd - o.fromStart)}`;
}

/* ------------------------------------------------------------------- coverage */

function placeOf(side: Side) {
  const parts = (side.href ?? "").split("/").filter(Boolean); // ["time", country, city?]
  if (parts[0] !== "time") return null;
  if (parts.length === 2) return { country: COUNTRY_BY_SLUG.get(parts[1]) ?? null, city: null, region: null };
  const key = `${parts[1]}/${parts[2]}`;
  return { country: COUNTRY_BY_SLUG.get(parts[1]) ?? null, city: PLACE_BY_KEY.get(key) ?? null, region: REGION_BY_KEY.get(key) ?? null };
}

/** Countries whose main clock matches this side's every day of `year` (no difference in any period). */
function sameClockCountries(side: Side, year: number, exclude?: string): string[] {
  const out: { name: string; rank: number }[] = [];
  for (const c of COUNTRIES) {
    if (c.slug === exclude || c.multiZone) continue;
    const cs: Side = { key: c.slug, kind: "country", label: c.short, long: c.name, tz: c.primary };
    const p = diffPeriods(side, cs, year);
    if (p.length === 1 && p[0].minutes === 0) out.push({ name: c.short || c.name, rank: c.rank || 999 });
  }
  return out.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)).map((x) => x.name);
}

function citiesOn(tz: string, limit: number, exclude?: string): { name: string; href: string }[] {
  return PLACES.filter((p) => p.tz === tz && p.slug !== exclude)
    .sort((a, b) => b.pop - a.pop)
    .slice(0, limit)
    .map((p) => ({ name: p.name, href: `/time/${p.countrySlug}/${p.slug}` }));
}

function listText(xs: string[], max: number): string {
  const head = xs.slice(0, max);
  const more = xs.length - head.length;
  if (!head.length) return "";
  const joined = head.length === 1 ? head[0] : `${head.slice(0, -1).join(", ")} and ${head[head.length - 1]}`;
  return more > 0 ? `${joined}, plus ${more} more` : joined;
}

function coverageOf(side: Side, year: number): { side: string; text: string; links: LinkItem[] } {
  const label = tLabel(side);
  const tz = side.tz;
  if (side.fixed !== undefined && side.fixed !== null) {
    return { side: label, text: `${label} is read here as a fixed offset from UTC, the same every day of the year.`, links: [] };
  }
  const pl = placeOf(side);
  if (side.kind === "country" && pl?.country) {
    const c = pl.country;
    const cities = citiesOn(c.primary, 8);
    const zones = c.zones.length;
    const text =
      c.multiZone && zones > 1
        ? `${c.name} has ${zones} time zones; ${label} on this page is ${tz}, the zone of ${listText(cities.map((x) => x.name), 4) || c.name}.`
        : `${c.name} has one time zone, ${tz}. The same clock is the local time in ${listText(cities.map((x) => x.name), 8) || c.name}.`;
    return { side: label, text, links: cities.map((x) => ({ href: x.href, label: `Time in ${x.name}` })) };
  }
  if ((side.kind === "city" || side.kind === "region") && pl?.country) {
    const c = pl.country;
    const peers = sameClockCountries(side, year, c.slug);
    const whole = !c.multiZone;
    const text = `${side.label} is on ${tz}${whole ? `, the one time zone of all of ${c.name}` : `, one of the ${c.zones.length} time zones of ${c.name}`}.${
      peers.length ? ` Every day of ${year} the same clock is also kept in ${listText(peers, 8)}.` : ""
    }`;
    return { side: label, text, links: c.slug ? [{ href: `/time/${c.slug}`, label: `Time in ${c.short || c.name}` }] : [] };
  }
  // A zone side.
  const peers = sameClockCountries(side, year);
  const cities = citiesOn(tz, 6);
  const text = `${label} clocks (${tz}) keep the same time all ${year} as ${listText(peers, 10) || "no single-zone country"}${
    cities.length ? `; the largest cities on ${tz} itself are ${listText(cities.map((x) => x.name), 6)}` : ""
  }.`;
  return { side: label, text, links: cities.map((x) => ({ href: x.href, label: `Time in ${x.name}` })) };
}

/* ----------------------------------------------------------------- equivalents */

let equivIndex: Map<string, string[]> | null = null;
const clockKey = (s: Side) => `${s.tz}|${s.fixed ?? ""}`;

/** Indexed pairs grouped by the two clocks they convert between: the same key means the same answer every day. */
function equivalenceIndex(): Map<string, string[]> {
  if (equivIndex) return equivIndex;
  const m = new Map<string, string[]>();
  for (const slug of indexedPairs()) {
    const at = slug.indexOf("-to-");
    const q = pairFromKeys(slug.slice(0, at), slug.slice(at + 4));
    if (!q) continue;
    const k = `${clockKey(q.from)}>${clockKey(q.to)}`;
    const list = m.get(k);
    if (list) list.push(slug);
    else m.set(k, [slug]);
  }
  for (const list of m.values()) list.sort((a, b) => volumeFor(`/${b}`) - volumeFor(`/${a}`) || a.localeCompare(b));
  equivIndex = m;
  return m;
}

/* ------------------------------------------------------------------------ pair */

export function buildPairValue(p: ParsedPair, now: number): PairValue {
  const { from, to } = p;
  const A = tLabel(from);
  const B = tLabel(to);
  const year = wallOf(from, now).year;

  // 1. The next two changes of the difference.
  const changes: string[] = [];
  const up = upcomingChanges(from, to, now);
  for (const c of up.slice(0, 2)) {
    const date = fmtDate(wallOf(from, c.at), true);
    const who = c.sides.map((s) => `${tLabel(s.side)} clocks go ${s.forward ? "forward" : "back"} (${s.fromAbbr} to ${s.toAbbr})`).join(" and ");
    const effect =
      c.before === c.after
        ? `the gap does not change: ${diffPhrase(c.after, A, B)} before and after`
        : c.after === 0
          ? `${diffPhrase(c.before, A, B)} until then, and the two show the same time after`
          : `${diffPhrase(c.before, A, B)} until then, and ${fmtDuration(c.after)} ${directionPhrase(c.after)} ${A} after`;
    changes.push(`${date}: ${who}; ${effect}.`);
  }
  if (!up.length) {
    const d = diffMinutes(from, to, now);
    changes.push(`Neither ${A} nor ${B} changes its clocks in the next 400 days, so ${diffPhrase(d, A, B)} every day of ${year} and ${year + 1}.`);
  } else if (up.length === 1) {
    changes.push(`No other change follows within 400 days of today.`);
  }

  // 2. Working-hours overlap in each period of the year.
  const periods: Period[] = diffPeriods(from, to, year);
  const overlapRows = periods.map((pp) => {
    const mid = pp.start + Math.floor((pp.end - pp.start) / 2);
    const aA = sideAbbr(from, mid);
    const aB = sideAbbr(to, mid);
    return {
      period: periods.length === 1 ? `All of ${year}` : `${pp.startText} – ${pp.endText}`,
      diff: diffPhrase(pp.minutes, aA, aB),
      core: overlapText(pp.minutes, 540, 1020, aA, aB),
      extended: overlapText(pp.minutes, 480, 1200, aA, aB),
    };
  });

  // 3. Where each place side's clock is used. A zone side is described once already (intro, zone page), and the same
  // text on every pair that shares the zone would only be one more block its siblings repeat word for word.
  const coverage = [from, to].filter((s) => s.kind !== "zone").map((s) => coverageOf(s, year));

  // 4. Indexed URLs that answer the identical question.
  // Within those: a country before a zone, a region and a city, a bigger city before a smaller one.
  const weight = (s: string) => {
    const at = s.indexOf("-to-");
    const q = pairFromKeys(s.slice(0, at), s.slice(at + 4));
    if (!q) return 9e9;
    const other = s.startsWith(`${p.fromKey}-to-`) ? q.to : q.from;
    if (other.kind === "country") return 0;
    if (other.kind === "zone") return 1;
    if (other.kind === "region") return 2;
    const city = placeOf(other)?.city;
    return 3 + 1 / Math.max(1, city?.pop ?? 1);
  };
  // The pairs that keep one side's name first (PST to Germany Time beside PST to Berlin Time), then by measured demand.
  const keeps = (s: string) => (s.startsWith(`${p.fromKey}-to-`) || s.endsWith(`-to-${p.toKey}`) ? 0 : 1);
  const same = (equivalenceIndex().get(`${clockKey(from)}>${clockKey(to)}`) ?? [])
    .filter((s) => s !== p.slug)
    .map((s, i) => ({ s, i }))
    .sort((a, b) => keeps(a.s) - keeps(b.s) || weight(a.s) - weight(b.s) || a.i - b.i)
    .slice(0, 8)
    .map((x) => x.s);
  const equivalents = same.map((s) => {
    const at = s.indexOf("-to-");
    const q = pairFromKeys(s.slice(0, at), s.slice(at + 4));
    return { href: `/${s}`, label: q ? pairLabelFromSides(q.from, q.to) : s };
  });
  const equivalentText = equivalents.length
    ? `${A} to ${B} converts between the clocks of ${from.tz} and ${to.tz}. ${equivalents.length === 1 ? "This page answers" : `These ${equivalents.length} pages answer`} the identical question with the same numbers on every date, so use whichever name you search by:`
    : null;

  return {
    changesHeading: `When the ${A} to ${B} difference changes next`,
    changes,
    overlapHeading: `${A} and ${B} working-hours overlap through ${year}`,
    overlapLead: "",
    overlapRows,
    coverageHeading: coverage.length === 2 ? `Where the ${A} and ${B} clocks are used` : coverage.length ? `Where the ${coverage[0].side} clock is used` : "",
    coverage,
    equivalentHeading: equivalents.length ? `Pages with the same ${A} to ${B} answer` : null,
    equivalentText,
    equivalents,
  };
}

/* ------------------------------------------------------------------------ hour */

function partOfDay(h: number): string {
  if (h < 5) return "the middle of the night";
  if (h < 7) return "early morning";
  if (h < 9) return "morning, before a 9 AM start";
  if (h < 12) return "morning working hours";
  if (h < 14) return "midday";
  if (h < 17) return "afternoon working hours";
  if (h < 19) return "early evening, after a 5 PM finish";
  if (h < 22) return "evening";
  return "late night";
}

export function buildHourValue(p: ParsedPair, hour: number, now: number): HourValue {
  const { from, to } = p;
  const A = tLabel(from);
  const B = tLabel(to);
  const display = hourDisplay(hour);
  const w = wallOf(from, now);
  const year = w.year;

  // 1. This hour in each part of the year between clock changes on either side (changes within 2 days merged), read
  // on a date in the middle of each part: the abbreviations and, where the difference moves, the times change.
  const yStart = Date.UTC(year, 0, 1);
  const yEnd = Date.UTC(year + 1, 0, 1);
  const cuts: number[] = [yStart];
  for (const side of [from, to]) {
    const tz = sideAt(side);
    if (!tz) continue;
    for (const t of transitionsInYear(tz, year)) if (t.at > yStart && t.at < yEnd) cuts.push(t.at);
  }
  cuts.sort((a, b) => a - b);
  const starts = cuts.filter((t, i) => i === 0 || t - cuts[i - 1] >= 2 * DAY);
  const yearRows = starts.map((start, i) => {
    const end = i + 1 < starts.length ? starts[i + 1] : yEnd;
    const mid = wallOf(from, start + Math.floor((end - start) / 2));
    const c = convertAt(from, to, mid.year, mid.month, mid.day, hour, 0);
    const shift = c.shift === 1 ? " (next day)" : c.shift === -1 ? " (previous day)" : "";
    return {
      period: starts.length === 1 ? `Every day of ${year}` : `${fmtDate(wallOf(from, start))} – ${fmtDate(wallOf(from, end - DAY))}`,
      text: `${fmtClock(c.fromH, c.fromM)} ${c.fromAbbr} = ${fmtClock(c.toH, c.toM)} ${c.toAbbr}${shift}`,
    };
  });

  // 2. Where the hour falls in each side's day today, and the nearest hour that works for both.
  const c = convertAt(from, to, w.year, w.month, w.day, hour, 0);
  const work = (h: number) => h >= 9 && h < 17;
  const both = work(c.fromH) && work(c.toH);
  const dayText = [
    `${fmtClock(c.fromH, c.fromM)} ${c.fromAbbr} is ${partOfDay(c.fromH)} in ${A}; on the other side it is ${fmtClock(c.toH, c.toM)} ${c.toAbbr}, ${partOfDay(c.toH)} in ${B}.`,
  ];
  if (both) dayText.push(`It is inside 9 AM–5 PM on both clocks, so it works as a meeting hour for both sides.`);
  else {
    let best: { h: number; dist: number; to: number } | null = null;
    for (let h = 0; h < 24; h++) {
      const cc = convertAt(from, to, w.year, w.month, w.day, h, 0);
      if (!work(cc.fromH) || !work(cc.toH)) continue;
      const dist = Math.min(Math.abs(h - hour), 24 - Math.abs(h - hour));
      if (!best || dist < best.dist) best = { h, dist, to: cc.toH };
    }
    dayText.push(
      best
        ? `The nearest hour inside 9 AM–5 PM on both clocks is ${hourDisplay(best.h)} ${A}, which is ${fmtClock(best.to, 0)} in ${B}.`
        : `No hour today is inside 9 AM–5 PM on both clocks: the working days of ${A} and ${B} do not overlap.`
    );
  }

  // 3. The neighbouring hours only (the parent pair page lists all 24).
  const neighbours: LinkItem[] = [];
  for (const k of [-3, -2, -1, 1, 2, 3]) {
    const h = (hour + k + 24) % 24;
    neighbours.push({ href: `/${p.slug}/${hourLabel(h)}`, label: `${hourDisplay(h)} ${A} to ${B}` });
  }

  return {
    yearHeading: `${display} ${A} in ${B} through ${year}`,
    yearRows,
    dayHeading: `Is ${display} ${A} a good time to reach ${B}?`,
    dayText,
    neighbours,
  };
}

export { isIndexedPair, ZONES };
