/**
 * Conversion maths for a pair of Sides. docs/04-engine-spec.md §4.3.
 */
import {
  fixedToUtc,
  fmtClock,
  fmtDate,
  fmtDuration,
  dayShift,
  nextTransition,
  offsetMinutes,
  wallFromFixed,
  wallTime,
  zonedToUtc,
  transitionsInYear,
  type Wall,
} from "./tz";
import { sideAbbr, sideOffset, type Side } from "./side";

export function wallOf(side: Side, ms: number = Date.now()): Wall {
  return side.fixed !== undefined && side.fixed !== null ? wallFromFixed(side.fixed, ms) : wallTime(side.tz, ms);
}

export function instantOf(side: Side, y: number, mo: number, d: number, h: number, mi: number): number {
  return side.fixed !== undefined && side.fixed !== null
    ? fixedToUtc(side.fixed, y, mo, d, h, mi)
    : zonedToUtc(side.tz, y, mo, d, h, mi);
}

/** Minutes that `to` is ahead of `from` at instant `ms`. */
export function diffMinutes(from: Side, to: Side, ms: number = Date.now()): number {
  return sideOffset(to, ms) - sideOffset(from, ms);
}

export interface AheadBehind {
  minutes: number;
  direction: "ahead" | "behind" | "same";
  /** "EST is 3 hours ahead of PST" */
  text: string;
  duration: string;
}

export function aheadBehind(from: Side, to: Side, ms: number = Date.now()): AheadBehind {
  const d = diffMinutes(from, to, ms);
  const a = sideAbbr(from, ms);
  const b = sideAbbr(to, ms);
  if (d === 0) {
    return { minutes: 0, direction: "same", duration: "0 minutes", text: `${b} and ${a} are on the same time` };
  }
  const dir = d > 0 ? "ahead" : "behind";
  const duration = fmtDuration(d);
  return { minutes: d, direction: dir, duration, text: `${b} is ${duration} ${dir} of ${a}` };
}

export interface Converted {
  fromH: number;
  fromM: number;
  toH: number;
  toM: number;
  /** -1 previous day, 0 same day, +1 next day */
  shift: number;
  fromAbbr: string;
  toAbbr: string;
  fromWall: Wall;
  toWall: Wall;
  instant: number;
}

export function convertAt(
  from: Side,
  to: Side,
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number
): Converted {
  const instant = instantOf(from, y, mo, d, h, mi);
  const fromWall = wallOf(from, instant);
  const toWall = wallOf(to, instant);
  return {
    fromH: fromWall.hour,
    fromM: fromWall.minute,
    toH: toWall.hour,
    toM: toWall.minute,
    shift: dayShift(fromWall, toWall),
    fromAbbr: sideAbbr(from, instant),
    toAbbr: sideAbbr(to, instant),
    fromWall,
    toWall,
    instant,
  };
}

export interface Row extends Converted {
  biz: boolean; // 9-17 on both sides
  night: boolean; // target hour in 22..5
}

/** 24 rows covering one calendar day in `from`, for the date of `ms`. */
export function table24(from: Side, to: Side, ms: number = Date.now(), minute = 0): Row[] {
  const base = wallOf(from, ms);
  const rows: Row[] = [];
  for (let h = 0; h < 24; h++) {
    const c = convertAt(from, to, base.year, base.month, base.day, h, minute);
    const biz = c.fromH >= 9 && c.fromH < 17 && c.toH >= 9 && c.toH < 17;
    const night = c.toH >= 22 || c.toH < 6;
    rows.push({ ...c, biz, night });
  }
  return rows;
}

/** "9:00 AM PST = 12:00 PM EST (next day)" */
export function rowText(r: Converted, h12 = true): string {
  const shift = r.shift === 1 ? " (next day)" : r.shift === -1 ? " (previous day)" : "";
  return `${fmtClock(r.fromH, r.fromM, h12)} ${r.fromAbbr} = ${fmtClock(r.toH, r.toM, h12)} ${r.toAbbr}${shift}`;
}

/* -------------------------------------------------------------- difference periods */

export interface Period {
  start: number;
  end: number;
  minutes: number;
  startWall: Wall;
  endWall: Wall;
  startText: string;
  endText: string;
  duration: string;
  direction: "ahead" | "behind" | "same";
}

/**
 * Segments of `year` in which the difference is constant.
 * Segments shorter than 2 days are merged into the previous one: ET and PT both
 * switch at 2 AM local, which creates a 3-hour sliver. docs/04 §4.3, docs/14 #3.
 */
export function diffPeriods(from: Side, to: Side, year: number): Period[] {
  const yStart = Date.UTC(year, 0, 1);
  const yEnd = Date.UTC(year + 1, 0, 1);

  const cuts = new Set<number>([yStart, yEnd]);
  for (const side of [from, to]) {
    if (side.fixed !== undefined && side.fixed !== null) continue;
    for (const t of transitionsInYear(side.tz, year)) {
      if (t.at > yStart && t.at < yEnd) cuts.add(t.at);
    }
  }
  const points = [...cuts].sort((a, b) => a - b);

  type Seg = { start: number; end: number; minutes: number };
  const raw: Seg[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const minutes = diffMinutes(from, to, start + 60_000);
    const prev = raw[raw.length - 1];
    if (prev && prev.minutes === minutes) prev.end = end;
    else raw.push({ start, end, minutes });
  }

  // drop slivers (< 2 days) by merging into the previous segment
  const TWO_DAYS = 2 * 86_400_000;
  const merged: Seg[] = [];
  for (const seg of raw) {
    const prev = merged[merged.length - 1];
    if (prev && seg.end - seg.start < TWO_DAYS) {
      prev.end = seg.end;
      continue;
    }
    if (prev && prev.minutes === seg.minutes) {
      prev.end = seg.end;
      continue;
    }
    merged.push({ ...seg });
  }
  // second pass: equal neighbours after merging
  const final: Seg[] = [];
  for (const seg of merged) {
    const prev = final[final.length - 1];
    if (prev && prev.minutes === seg.minutes) prev.end = seg.end;
    else final.push({ ...seg });
  }

  return final.map((s) => {
    const startWall = wallOf(from, s.start);
    const endWall = wallOf(from, s.end - 86_400_000);
    return {
      start: s.start,
      end: s.end,
      minutes: s.minutes,
      startWall,
      endWall,
      startText: fmtDate(startWall),
      endText: fmtDate(endWall),
      duration: fmtDuration(s.minutes),
      direction: s.minutes === 0 ? "same" : s.minutes > 0 ? "ahead" : "behind",
    };
  });
}

/* ------------------------------------------------------------------ DST info */

export interface DstInfo {
  observes: boolean;
  next?: {
    at: number;
    dateText: string;
    dateTextLong: string;
    fromAbbr: string;
    toAbbr: string;
    direction: "forward" | "back";
    localHour: string;
    fromOffset: number;
    toOffset: number;
  };
}

/** Next transition for a side, ignoring anything more than 400 days away. */
export function dstInfo(side: Side, now: number = Date.now()): DstInfo {
  if (side.fixed !== undefined && side.fixed !== null) return { observes: false };
  const t = nextTransition(side.tz, now);
  if (!t || t.at - now > 400 * 86_400_000) return { observes: false };
  const before = wallTime(side.tz, t.at - 60_000);
  return {
    observes: true,
    next: {
      at: t.at,
      dateText: fmtDate(before),
      dateTextLong: fmtDate(before, true),
      fromAbbr: sideAbbr(side, t.at - 60_000),
      toAbbr: sideAbbr(side, t.at + 60_000),
      direction: t.to > t.from ? "forward" : "back",
      localHour: fmtClock(before.hour, before.minute, false),
      fromOffset: t.from,
      toOffset: t.to,
    },
  };
}

/* ------------------------------------------------------------ work overlap */

export interface Overlap {
  fromStart: number; // minutes after midnight in `from`
  fromEnd: number;
  toStart: number;
  toEnd: number;
  minutes: number;
}

/** Shared 9-5 window. null when the working days don't overlap at all. */
export function workOverlap(from: Side, to: Side, ms: number = Date.now()): Overlap | null {
  const d = diffMinutes(from, to, ms);
  const fromStart = Math.max(540, 540 - d);
  const fromEnd = Math.min(1020, 1020 - d);
  if (fromEnd <= fromStart) return null;
  return {
    fromStart,
    fromEnd,
    toStart: fromStart + d,
    toEnd: fromEnd + d,
    minutes: fromEnd - fromStart,
  };
}

/** When there is no 9-5 overlap, the first hour where both sides are 7:00-22:00. */
export function bestCompromise(from: Side, to: Side, ms: number = Date.now()): { fromMin: number; toMin: number } | null {
  const d = diffMinutes(from, to, ms);
  for (let m = 7 * 60; m <= 22 * 60; m += 60) {
    const t = ((m + d) % 1440 + 1440) % 1440;
    if (t >= 7 * 60 && t <= 22 * 60) return { fromMin: m, toMin: t };
  }
  return null;
}

export { offsetMinutes };
