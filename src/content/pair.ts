/**
 * Content builders for pair pages (A/C) and hour pages (B). docs/06.
 * Every sentence is filled with values computed by the engine at render time.
 */
import { ZONE_BY_SLUG } from "@/data/zones";
import type { Side } from "@/engine/side";
import { sideAbbr } from "@/engine/side";
import {
  aheadBehind,
  bestCompromise,
  convertAt,
  diffMinutes,
  diffPeriods,
  dstInfo,
  rowText,
  table24,
  wallOf,
  workOverlap,
  type Period,
  type Row,
} from "@/engine/pair";
import {
  fmtClock,
  fmtDate,
  fmtDuration,
  fmtOffset,
  hourDisplay,
  hourLabel,
  nextTransition,
  offsetMinutes,
} from "@/engine/tz";
import type { ParsedPair } from "@/engine/entities";
import { pairFromKeys } from "@/engine/entities";
import { hourPairs, isIndexedPair, pairsFrom, pairsTo, keywordsBySlot } from "@/seo/gate";
import { clip, firstThatFits, title as brandTitle } from "@/seo/meta";
import { familyName, pairLabelFromSides, regionText, tLabel, zoneNote } from "./labels";
import type { FaqItem, RelatedGroup } from "@/components/Blocks";

export interface PairContent {
  slug: string;
  path: string;
  indexed: boolean;
  inForceNotes: string[];
  from: Side;
  to: Side;
  A: string;
  B: string;
  title: string;
  description: string;
  h1: string;
  answer: string;
  crumbs: { name: string; path: string }[];
  intro1: string;
  intro2: string;
  tableHeading: string;
  tableNote: string;
  rows: Row[];
  tableDate: string;
  howToHeading: string;
  howTo: string[];
  diffHeading: string;
  diffConstant: boolean;
  diffLead: string;
  diffPeriodsList: Period[];
  dstHeading: string;
  dstBullets: string[];
  meetingHeading: string;
  meetingText: string;
  faqHeading: string;
  faqs: FaqItem[];
  related: RelatedGroup[];
  reverseHref: string | null;
  validUntil: number | null;
  updatedDate: string;
  isHourPair: boolean;
  diffMinutesNow: number;
}

const WORK_NOTE = "Today's date. Highlighted rows are 9 AM–5 PM in both places.";

function directionWord(min: number): string {
  return min > 0 ? "ahead of" : min < 0 ? "behind" : "the same as";
}

function shiftWord(shift: number): string {
  return shift === 1 ? " (next day)" : shift === -1 ? " (previous day)" : "";
}

/** The next transition instant of either side, used by the client island. */
export function validUntilFor(from: Side, to: Side, now: number): number | null {
  const times: number[] = [];
  for (const s of [from, to]) {
    if (s.fixed != null) continue;
    const t = nextTransition(s.tz, now);
    if (t) times.push(t.at);
  }
  return times.length ? Math.min(...times) : null;
}

function crumbsFor(p: ParsedPair, label: string): { name: string; path: string }[] {
  const out: { name: string; path: string }[] = [{ name: "Home", path: "/" }];
  if (p.from.kind === "zone") {
    out.push({ name: "Time zones", path: "/time-zones" });
    if (p.from.href) out.push({ name: tLabel(p.from), path: p.from.href });
  } else if (p.from.href) {
    out.push({ name: "Current time", path: "/world-clock" });
    out.push({ name: p.from.label, path: p.from.href });
  }
  out.push({ name: label, path: `/${p.slug}` });
  return out;
}

/** The example sentence: 9:00 AM on today's date. */
function exampleAt(from: Side, to: Side, now: number, hour = 9): string {
  const w = wallOf(from, now);
  const c = convertAt(from, to, w.year, w.month, w.day, hour, 0);
  return `${fmtClock(c.fromH, c.fromM)} ${c.fromAbbr} = ${fmtClock(c.toH, c.toM)} ${c.toAbbr}${shiftWord(c.shift)}`;
}

function crossMidnightExample(from: Side, to: Side, now: number): string | null {
  const w = wallOf(from, now);
  for (const h of [22, 23, 21, 20, 1, 2, 0]) {
    const c = convertAt(from, to, w.year, w.month, w.day, h, 0);
    if (c.shift !== 0) {
      return `${fmtClock(c.fromH, c.fromM)} ${c.fromAbbr} = ${fmtClock(c.toH, c.toM)} ${c.toAbbr}${shiftWord(c.shift)}`;
    }
  }
  return null;
}

function meetingSentence(from: Side, to: Side, now: number, A: string, B: string): string {
  const ov = workOverlap(from, to, now);
  const abbrA = sideAbbr(from, now);
  const abbrB = sideAbbr(to, now);
  if (ov) {
    return `${A} and ${B} share ${fmtDuration(ov.minutes)} of the 9 AM–5 PM working day. Any time between ${fmtClock(
      Math.floor(ov.fromStart / 60),
      ov.fromStart % 60
    )} and ${fmtClock(Math.floor(ov.fromEnd / 60), ov.fromEnd % 60)} ${abbrA} lands between ${fmtClock(
      Math.floor((((ov.toStart % 1440) + 1440) % 1440) / 60),
      ov.toStart % 60
    )} and ${fmtClock(
      Math.floor((((ov.toEnd % 1440) + 1440) % 1440) / 60),
      ov.toEnd % 60
    )} ${abbrB}, inside working hours for both.`;
  }
  const c = bestCompromise(from, to, now);
  if (c) {
    return `${A} and ${B} have no shared 9 AM–5 PM window. The earliest slot that is reasonable on both sides is ${fmtClock(
      Math.floor(c.fromMin / 60),
      c.fromMin % 60
    )} ${abbrA}, which is ${fmtClock(Math.floor(c.toMin / 60), c.toMin % 60)} ${abbrB}.`;
  }
  return `${A} and ${B} are too far apart for a comfortable shared slot: one side is always outside 7 AM–10 PM. Pick a time that suits the people who need to be there live.`;
}

function dstBulletsFor(sides: Side[], now: number): string[] {
  return sides.map((s) => {
    const label = tLabel(s);
    const info = dstInfo(s, now);
    if (!info.observes || !info.next) {
      return `${label} does not observe daylight saving time; it stays on ${fmtOffset(
        s.fixed ?? offsetMinutes(s.tz, now)
      )} all year.`;
    }
    const n = info.next;
    return `${label} next changes on ${n.dateText}: clocks go ${n.direction} one hour at ${n.localHour} local time, from ${n.fromAbbr} (${fmtOffset(
      n.fromOffset
    )}) to ${n.toAbbr} (${fmtOffset(n.toOffset)}).`;
  });
}

/* ---------------------------------------------------------------- buildPair */

export function buildPair(p: ParsedPair, now: number = Date.now()): PairContent {
  const { from, to } = p;
  const A = tLabel(from);
  const B = tLabel(to);
  const path = `/${p.slug}`;
  const indexed = isIndexedPair(p.slug);

  const ab = aheadBehind(from, to, now);
  const abbrFrom = sideAbbr(from, now);
  const abbrTo = sideAbbr(to, now);
  const example = exampleAt(from, to, now);

  const fromWall = wallOf(from, now);
  const periods = diffPeriods(from, to, fromWall.year);
  const varies = periods.length > 1;
  const nowWord = varies ? " right now" : "";

  const famFrom = familyName(from);
  const famTo = familyName(to);

  // e.g. /est-to-bst in winter: the UK is on GMT, not BST. Say so.
  const inForceNotes: string[] = [];
  for (const s of [from, to]) {
    if (s.kind !== "zone" || s.fixed != null || !s.zoneSlug) continue;
    const z = ZONE_BY_SLUG.get(s.zoneSlug);
    if (!z || (z.kind !== "std" && z.kind !== "dst")) continue;
    const live = sideAbbr(s, now);
    if (live === z.abbr) continue;
    inForceNotes.push(
      `${z.abbr} (${z.name}) is not in force right now: ${z.region.split(",")[0]} is currently on ${live}. This page uses whichever name applies on the date you pick, so the numbers below say ${live}.`
    );
  }

  const h1 = `${A} to ${B} Converter`;
  const longTitle = `${A} to ${B} Converter – ${famFrom} to ${famTo}`;
  const titleText = longTitle.length <= 60 ? brandTitle(longTitle) : brandTitle(`${A} to ${B} Converter`);

  const description = clip(
    `Convert ${A} to ${B}: ${ab.direction === "same" ? `${abbrTo} and ${abbrFrom} are on the same time` : `${abbrTo} is ${ab.duration} ${directionWord(ab.minutes)} ${abbrFrom}`}${nowWord}. ${example}. Live clocks, 24-hour table, DST dates and best meeting times.`,
    155
  );

  const answer =
    ab.direction === "same"
      ? `${abbrTo} and ${abbrFrom} are on the same time. ${example}.`
      : `${abbrTo} is ${ab.duration} ${directionWord(ab.minutes)} ${abbrFrom}. ${example}.`;

  const addSub = ab.minutes === 0 ? "add nothing to" : ab.minutes > 0 ? `add ${ab.duration} to` : `subtract ${ab.duration} from`;

  const intro1 =
    ab.direction === "same"
      ? `${abbrTo} and ${abbrFrom} are on the same time${varies ? " at the moment" : ""}. Converting ${A} to ${B} leaves the clock unchanged: ${example}.`
      : `${abbrTo} is ${ab.duration} ${directionWord(ab.minutes)} ${abbrFrom}${varies ? " at the moment" : ""}. To convert ${A} to ${B}, ${addSub} the ${A} time: ${example}.`;

  const synonyms = keywordsBySlot(path, "synonym").map((k) => k.keyword);
  const synonymTail = synonyms.length ? ` The same conversion is also searched as “${synonyms.slice(0, 2).join("” and “")}”.` : "";
  const intro2 = `${A} (${famFrom}) is used in ${regionText(from)}. ${B} (${famTo}) is used in ${regionText(to)}.${synonymTail}`;

  const rows = table24(from, to, now);
  const tableDate = fmtDate(fromWall);

  const howTo: string[] = [];
  howTo.push(
    ab.minutes === 0
      ? `${A} and ${B} show the same clock time, so no adjustment is needed.`
      : `${ab.minutes > 0 ? "Add" : "Subtract"} ${ab.duration} ${ab.minutes > 0 ? "to" : "from"} the ${A} time to get ${B}.`
  );
  howTo.push(`Example: ${example}.`);
  const cross = crossMidnightExample(from, to, now);
  if (cross) howTo.push(`Across midnight: ${cross}. The date changes, so always check the day as well as the hour.`);

  const diffConstant = !varies;
  const diffLead = diffConstant
    ? `The time difference between ${A} and ${B} is ${fmtDuration(ab.minutes)} all year${
        ab.direction === "same" ? "" : ` – ${abbrTo} is ${directionWord(ab.minutes)} ${abbrFrom}`
      }.`
    : `The time difference between ${A} and ${B} is not the same all year, because the two sides change for daylight saving time on different dates. In ${fromWall.year} it works out like this:`;

  const dstBullets = dstBulletsFor([from, to], now);
  const meetingText = meetingSentence(from, to, now, A, B);

  /* ------------------------------------------------------------------- FAQ */

  const faqs: FaqItem[] = [];
  faqs.push({
    q: `What is the time difference between ${A} and ${B}?`,
    a: diffConstant
      ? `${
          ab.direction === "same"
            ? `${abbrTo} and ${abbrFrom} are on the same time all year.`
            : `${abbrTo} is ${ab.duration} ${directionWord(ab.minutes)} ${abbrFrom} all year.`
        } ${example}.`
      : `Right now ${abbrTo} is ${ab.duration} ${directionWord(ab.minutes)} ${abbrFrom}. The gap changes ${
          periods.length
        } times in ${fromWall.year} because the two sides switch to daylight saving time on different dates.`,
  });
  for (const hour of [9, 12]) {
    const w = wallOf(from, now);
    const c = convertAt(from, to, w.year, w.month, w.day, hour, 0);
    faqs.push({
      q: `What is ${hourDisplay(hour)}${hour === 12 ? " (noon)" : ""} ${A} in ${B}?`,
      a: `${fmtClock(c.fromH, c.fromM)} ${c.fromAbbr} is ${fmtClock(c.toH, c.toM)} ${c.toAbbr}${shiftWord(c.shift)}.`,
    });
  }
  faqs.push({
    q: `Is ${B} ahead of or behind ${A}?`,
    a:
      ab.direction === "same"
        ? `Neither. ${abbrTo} and ${abbrFrom} keep the same clock time.`
        : `${abbrTo} is ${ab.duration} ${directionWord(ab.minutes)} ${abbrFrom}, so it is ${
            ab.minutes > 0 ? "later" : "earlier"
          } in ${B} than in ${A}.`,
  });
  for (const s of [from, to]) {
    const label = tLabel(s);
    const info = dstInfo(s, now);
    faqs.push({
      q: `Does ${label} change for daylight saving time?`,
      a: info.observes && info.next
        ? `Yes. ${label} next changes on ${info.next.dateText}, when clocks go ${info.next.direction} one hour from ${info.next.fromAbbr} to ${info.next.toAbbr}.`
        : `No. ${label} stays on the same offset all year, so conversions never shift for daylight saving time.`,
    });
  }
  faqs.push({
    q: `What is the best time for a meeting between ${A} and ${B}?`,
    a: meetingText,
  });
  for (const s of [from, to]) {
    const z = s.kind === "zone" && s.zoneSlug ? ZONE_BY_SLUG.get(s.zoneSlug) : undefined;
    if (!z || s.fixed != null) continue;
    if (!["est", "pst", "cst", "mst"].includes(z.slug)) continue;
    const generic = ZONE_BY_SLUG.get(z.slug === "est" ? "et" : z.slug === "pst" ? "pt" : z.slug === "cst" ? "ct" : "mt");
    const dst = z.counterpart ? ZONE_BY_SLUG.get(z.counterpart) : undefined;
    if (!generic || !dst) continue;
    faqs.push({
      q: `Is ${generic.abbr} the same as ${z.abbr}?`,
      a: `${z.abbr} is the winter (standard) name of ${generic.name} (${generic.abbr}). From March to November the same clocks are called ${dst.abbr}. This converter always uses the one in force on the date you choose.`,
    });
  }

  /* --------------------------------------------------------------- related */

  const reverseSlug = `${p.toKey}-to-${p.fromKey}`;
  const reverseIndexed = isIndexedPair(reverseSlug);
  const reverseHref = reverseIndexed ? `/${reverseSlug}` : null;

  const label = (slug: string) => {
    const q = pairFromKeys(slug.slice(0, slug.indexOf("-to-")), slug.slice(slug.indexOf("-to-") + 4));
    return q ? pairLabelFromSides(q.from, q.to) : slug;
  };
  const toItems = (slugs: string[]) => slugs.map((s) => ({ href: `/${s}`, label: label(s) }));

  const fromGroup = toItems(pairsFrom(p.fromKey, 8, p.slug));
  const toGroup = toItems(pairsTo(p.toKey, 8, p.slug));
  const hourPair = hourPairs().includes(p.slug);
  const hourGroup = hourPair
    ? Array.from({ length: 24 }, (_, h) => ({ href: `${path}/${hourLabel(h)}`, label: `${hourDisplay(h)} ${A} to ${B}` }))
    : [];

  const learnMore: { href: string; label: string }[] = [];
  for (const s of [from, to]) {
    if (s.href) learnMore.push({ href: s.href, label: s.kind === "zone" ? `${tLabel(s)} time zone` : `Current time in ${s.label}` });
  }

  const related: RelatedGroup[] = [];
  if (reverseHref) {
    related.push({ heading: `Convert ${B} to ${A}`, items: [{ href: reverseHref, label: `${B} to ${A}` }] });
  }
  if (fromGroup.length) related.push({ heading: `Convert ${A} to other time zones`, items: fromGroup });
  if (toGroup.length) related.push({ heading: `Convert other time zones to ${B}`, items: toGroup });
  if (hourGroup.length) related.push({ heading: `${A} to ${B} by hour`, items: hourGroup, cols: true });
  if (learnMore.length) related.push({ heading: "Learn more", items: learnMore });

  return {
    slug: p.slug,
    path,
    indexed,
    inForceNotes,
    from,
    to,
    A,
    B,
    title: titleText,
    description,
    h1,
    answer,
    crumbs: crumbsFor(p, `${A} to ${B}`),
    intro1,
    intro2,
    tableHeading: `${A} to ${B} time conversion table`,
    tableNote: WORK_NOTE,
    rows,
    tableDate,
    howToHeading: `How to convert ${A} to ${B}`,
    howTo,
    diffHeading: `Time difference between ${A} and ${B}`,
    diffConstant,
    diffLead,
    diffPeriodsList: periods,
    dstHeading: `${A} and ${B} during daylight saving time`,
    dstBullets,
    meetingHeading: `Best time for a meeting between ${A} and ${B}`,
    meetingText,
    faqHeading: `${A} to ${B} FAQ`,
    faqs,
    related,
    reverseHref,
    validUntil: validUntilFor(from, to, now),
    updatedDate: fmtDate(fromWall, true),
    isHourPair: hourPair,
    diffMinutesNow: ab.minutes,
  };
}

/* ---------------------------------------------------------------- buildHour */

export interface HourContent {
  slug: string;
  path: string;
  hour: number;
  label: string; // "9am"
  display: string; // "9 AM"
  indexed: boolean;
  from: Side;
  to: Side;
  A: string;
  B: string;
  title: string;
  description: string;
  h1: string;
  answer: string;
  crumbs: { name: string; path: string }[];
  otherHeading: string;
  otherRows: { href: string | null; label: string; time: string; abbr: string; shift: number }[];
  quarterHeading: string;
  quarters: string[];
  prevHref: string;
  nextHref: string;
  faqHeading: string;
  faqs: FaqItem[];
  related: RelatedGroup[];
  validUntil: number | null;
  updatedDate: string;
  lockedMinutes: number;
}

/** `9`, `12` — the 12-hour number for quarter-hour headings. */
function h12(h: number): number {
  const hh = ((h % 24) + 24) % 24;
  return hh % 12 === 0 ? 12 : hh % 12;
}

const OTHER_ZONE_SLUGS = [
  "est",
  "cst",
  "mst",
  "pst",
  "utc",
  "gmt",
  "ist",
  "cet",
  "jst",
  "aest",
  "sgt",
  "philippine-time",
];

export function buildHour(p: ParsedPair, hour: number, now: number = Date.now()): HourContent {
  const { from, to } = p;
  const A = tLabel(from);
  const B = tLabel(to);
  const label = hourLabel(hour);
  const display = hourDisplay(hour);
  const path = `/${p.slug}/${label}`;
  const w = wallOf(from, now);
  const c = convertAt(from, to, w.year, w.month, w.day, hour, 0);
  const fromClock = fmtClock(c.fromH, c.fromM);
  const toClock = fmtClock(c.toH, c.toM);
  const shift = shiftWord(c.shift);
  const noonTag = hour === 12 ? " (noon)" : hour === 0 ? " (midnight)" : "";

  const titleText = firstThatFits(
    [
      brandTitle(`${label} ${A} to ${B} – ${fromClock} ${c.fromAbbr} is ${toClock} ${c.toAbbr}`),
      `${label} ${A} to ${B} – ${fromClock} ${c.fromAbbr} is ${toClock} ${c.toAbbr}`,
      brandTitle(`${label} ${A} to ${B}`),
      `${label} ${A} to ${B}`,
    ],
    60
  );

  const otherRows = OTHER_ZONE_SLUGS.filter((s) => s !== p.fromKey && s !== p.toKey)
    .slice(0, 8)
    .map((slug) => {
      const q = pairFromKeys(p.fromKey, slug);
      if (!q) return null;
      const cc = convertAt(q.from, q.to, w.year, w.month, w.day, hour, 0);
      return {
        href: isIndexedPair(q.slug) ? `/${q.slug}` : null,
        label: tLabel(q.to),
        time: fmtClock(cc.toH, cc.toM),
        abbr: cc.toAbbr,
        shift: cc.shift,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const quarters = [0, 15, 30, 45].map((mi) => {
    const cq = convertAt(from, to, w.year, w.month, w.day, hour, mi);
    return rowText(cq);
  });

  const description = clip(
    `${display} ${A} to ${B}: ${fromClock} ${c.fromAbbr} is ${toClock} ${c.toAbbr}${shift}. Also see ${display} ${A} in ${otherRows
      .slice(0, 4)
      .map((r) => r.label)
      .join(", ")}, plus quarter-hour conversions.`,
    155
  );

  const faqs: FaqItem[] = [
    {
      q: `What is ${display} ${A} in ${B}?`,
      a: `${fromClock} ${c.fromAbbr} is ${toClock} ${c.toAbbr}${shift}.`,
    },
    {
      q: `Is ${display} ${A} the same day in ${B}?`,
      a:
        c.shift === 0
          ? `Yes. ${fromClock} ${c.fromAbbr} and ${toClock} ${c.toAbbr} fall on the same calendar day.`
          : `No. ${fromClock} ${c.fromAbbr} is ${toClock} ${c.toAbbr} on the ${c.shift === 1 ? "next" : "previous"} day.`,
    },
    {
      q: `What is ${display.replace(" ", ":30 ")} ${A} in ${B}?`,
      a: `${quarters[2]}.`,
    },
  ];

  // "1pm pt to est" and friends: the generic zone name for the same clocks.
  for (const s of [from, to]) {
    if (s.kind !== "zone" || !s.zoneSlug) continue;
    const generic = ZONE_BY_SLUG.get(
      { est: "et", pst: "pt", cst: "ct", mst: "mt" }[s.zoneSlug as "est" | "pst" | "cst" | "mst"] ?? ""
    );
    if (!generic) continue;
    faqs.push({
      q: `Is ${display} ${generic.abbr} the same as ${display} ${tLabel(s)}?`,
      a: `${generic.abbr} (${generic.name}) is the year-round name for these clocks, so ${display} ${generic.abbr} means ${display} ${sideAbbr(
        s,
        now
      )} on today's date. ${fromClock} ${c.fromAbbr} is ${toClock} ${c.toAbbr}${shift}.`,
    });
    break;
  }

  const prev = (hour + 23) % 24;
  const next = (hour + 1) % 24;

  const parent = buildPair(p, now);
  const related: RelatedGroup[] = [
    {
      heading: `All ${A} to ${B} times`,
      items: Array.from({ length: 24 }, (_, h) => ({
        href: `/${p.slug}/${hourLabel(h)}`,
        label: `${hourDisplay(h)} ${A} to ${B}`,
      })),
      cols: true,
    },
    ...parent.related.filter((g) => !g.heading.endsWith("by hour")),
  ];

  return {
    slug: p.slug,
    path,
    hour,
    label,
    display,
    indexed: isIndexedPair(p.slug) && hourPairs().includes(p.slug),
    from,
    to,
    A,
    B,
    title: titleText,
    description,
    h1: `${display}${noonTag} ${A} to ${B}`,
    answer: `${fromClock} ${c.fromAbbr} is ${toClock} ${c.toAbbr}${shift}.`,
    crumbs: [
      { name: "Home", path: "/" },
      { name: "Time zones", path: "/time-zones" },
      { name: `${A} to ${B}`, path: `/${p.slug}` },
      { name: `${display} ${A}`, path },
    ],
    otherHeading: `${display} ${A} in other time zones`,
    otherRows,
    quarterHeading: `Quarter hours: ${display}, ${h12(hour)}:15, ${h12(hour)}:30 and ${h12(hour)}:45 ${A}`,
    quarters,
    prevHref: `/${p.slug}/${hourLabel(prev)}`,
    nextHref: `/${p.slug}/${hourLabel(next)}`,
    faqHeading: `${display} ${A} to ${B} FAQ`,
    faqs,
    related,
    validUntil: validUntilFor(from, to, now),
    updatedDate: fmtDate(w, true),
    lockedMinutes: hour * 60,
  };
}

export { zoneNote };
