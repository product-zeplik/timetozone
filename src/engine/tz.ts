/**
 * Pure time-zone math on top of the platform Intl API (IANA tzdata).
 * No dependencies, no DOM: runs on the server, in client islands and in the
 * Chrome extension unchanged. See docs/04-engine-spec.md.
 */

export const MINUS = "−"; // Unicode minus sign, used in all offset text

export interface Wall {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
  weekday: string; // "Mon"
}

export interface Transition {
  at: number; // UTC instant
  from: number; // offset minutes before
  to: number; // offset minutes after
}

/* ------------------------------------------------------- formatter caching */

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string, kind: "offset" | "wall" | "long" | "generic"): Intl.DateTimeFormat {
  const key = `${tz}|${kind}`;
  let f = fmtCache.get(key);
  if (f) return f;
  if (kind === "offset") {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" });
  } else if (kind === "wall") {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
  } else if (kind === "long") {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "long", year: "numeric" });
  } else {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortGeneric", year: "numeric" });
  }
  fmtCache.set(key, f);
  return f;
}

/* ------------------------------------------------------------------ offsets */

const offsetCache = new Map<string, number>();

/** Offset of `tz` from UTC in minutes at instant `ms`. EST = -300. */
export function offsetMinutes(tz: string, ms: number = Date.now()): number {
  const key = `${tz}|${ms}`;
  const hit = offsetCache.get(key);
  if (hit !== undefined) return hit;
  const parts = formatter(tz, "offset").formatToParts(ms);
  const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  let v = 0;
  if (raw !== "GMT") {
    const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(raw);
    if (m) {
      const sign = m[1] === "-" ? -1 : 1;
      v = sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
    }
  }
  if (offsetCache.size > 50_000) offsetCache.clear();
  offsetCache.set(key, v);
  return v;
}

/** Wall-clock fields of `tz` at instant `ms`. */
export function wallTime(tz: string, ms: number = Date.now()): Wall {
  const parts = formatter(tz, "wall").formatToParts(ms);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24, // some engines return "24"
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: parts.find((p) => p.type === "weekday")?.value ?? "",
  };
}

/** Wall-clock fields for a plain fixed offset (minutes east of UTC). */
export function wallFromFixed(offset: number, ms: number = Date.now()): Wall {
  const d = new Date(ms + offset * 60_000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()],
  };
}

/**
 * The UTC instant of a wall-clock time in `tz`.
 * Two-pass resolution. Inside a spring-forward gap the time moves forward;
 * in a fall-back overlap the first (earlier) occurrence wins.
 */
export function zonedToUtc(tz: string, y: number, mo: number, d: number, h: number, mi: number): number {
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, 0, 0);
  const DAY = 86_400_000;
  const before = offsetMinutes(tz, asUtc - DAY);
  const at = offsetMinutes(tz, asUtc);
  const after = offsetMinutes(tz, asUtc + DAY);

  // An offset candidate is real only when the instant it produces actually has
  // that offset. Normally exactly one candidate survives.
  const valid: number[] = [];
  for (const off of new Set([before, at, after])) {
    const t = asUtc - off * 60_000;
    if (offsetMinutes(tz, t) === off && !valid.includes(t)) valid.push(t);
  }
  // Fall-back overlap: two valid instants -> the first occurrence.
  if (valid.length) return Math.min(...valid);
  // Spring-forward gap: the wall time does not exist. Using the pre-transition
  // offset lands after the transition, i.e. the time moves forward.
  return asUtc - Math.min(before, after) * 60_000;
}

/** The UTC instant of a wall-clock time at a fixed offset. */
export function fixedToUtc(offset: number, y: number, mo: number, d: number, h: number, mi: number): number {
  return Date.UTC(y, mo - 1, d, h, mi, 0, 0) - offset * 60_000;
}

/* -------------------------------------------------------------- transitions */

const transCache = new Map<string, Transition[]>();

/** All offset transitions of `tz` during the UTC year `year`, to minute precision. */
export function transitionsInYear(tz: string, year: number): Transition[] {
  const key = `${tz}|${year}`;
  const hit = transCache.get(key);
  if (hit) return hit;

  const out: Transition[] = [];
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  const DAY = 86_400_000;

  let prevAt = start;
  let prevOff = offsetMinutes(tz, start);
  for (let t = start + DAY; t <= end; t += DAY) {
    const off = offsetMinutes(tz, t);
    if (off !== prevOff) {
      // binary search to the minute
      let lo = prevAt;
      let hi = t;
      while (hi - lo > 60_000) {
        const mid = lo + Math.floor((hi - lo) / 2 / 60_000) * 60_000;
        if (mid <= lo || mid >= hi) break;
        if (offsetMinutes(tz, mid) === prevOff) lo = mid;
        else hi = mid;
      }
      out.push({ at: hi, from: prevOff, to: off });
      prevOff = off;
    }
    prevAt = t;
  }
  transCache.set(key, out);
  return out;
}

/** The first transition of `tz` strictly after `from`, within 3 years. */
export function nextTransition(tz: string, from: number = Date.now()): Transition | null {
  const y = new Date(from).getUTCFullYear();
  for (let i = 0; i <= 2; i++) {
    const t = transitionsInYear(tz, y + i).find((x) => x.at > from);
    if (t) return t;
  }
  return null;
}

/** The last transition of `tz` at or before `from`, within 3 years back. */
export function previousTransition(tz: string, from: number = Date.now()): Transition | null {
  const y = new Date(from).getUTCFullYear();
  for (let i = 0; i <= 2; i++) {
    const list = transitionsInYear(tz, y - i).filter((x) => x.at <= from);
    if (list.length) return list[list.length - 1];
  }
  return null;
}

/** Standard and daylight offsets of `tz` in `year`. Works in both hemispheres. */
export function seasonalOffsets(tz: string, year: number): { std: number; dst: number | null } {
  const jan = offsetMinutes(tz, Date.UTC(year, 0, 15, 12));
  const jul = offsetMinutes(tz, Date.UTC(year, 6, 15, 12));
  if (jan === jul) return { std: jan, dst: null };
  return { std: Math.min(jan, jul), dst: Math.max(jan, jul) };
}

/** True when `tz` is currently on its daylight offset. */
export function isDst(tz: string, ms: number = Date.now()): boolean {
  const { std, dst } = seasonalOffsets(tz, wallTime(tz, ms).year);
  if (dst === null) return false;
  return offsetMinutes(tz, ms) === dst;
}

/** The long Intl zone name, e.g. "Eastern Standard Time". */
export function longZoneName(tz: string, ms: number = Date.now()): string {
  const v = formatter(tz, "long").formatToParts(ms).find((p) => p.type === "timeZoneName")?.value;
  return v ?? "";
}

/** The generic Intl zone name, e.g. "ET". */
export function genericZoneName(tz: string, ms: number = Date.now()): string {
  const v = formatter(tz, "generic").formatToParts(ms).find((p) => p.type === "timeZoneName")?.value;
  return v ?? "";
}

/* ------------------------------------------------------------- formatting */

/** `UTC-5`, `UTC+5:30`, `UTC+0` (with a Unicode minus). */
export function fmtOffset(min: number): string {
  const sign = min < 0 ? MINUS : "+";
  const a = Math.abs(min);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `UTC${sign}${h}${m ? ":" + String(m).padStart(2, "0") : ""}`;
}

/** Just the signed offset: `-5`, `+5:30`. */
export function fmtOffsetShort(min: number): string {
  const sign = min < 0 ? MINUS : "+";
  const a = Math.abs(min);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `${sign}${h}${m ? ":" + String(m).padStart(2, "0") : ""}`;
}

/** `3 hours`, `9 hours 30 minutes`, `45 minutes`, `1 hour`. */
export function fmtDuration(min: number): string {
  const a = Math.abs(min);
  const h = Math.floor(a / 60);
  const m = a % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} ${h === 1 ? "hour" : "hours"}`);
  if (m) parts.push(`${m} ${m === 1 ? "minute" : "minutes"}`);
  return parts.length ? parts.join(" ") : "0 minutes";
}

/** `9:00 AM`, `12:00 PM`, `12:00 AM`; 24h -> `09:00`. */
export function fmtClock(h: number, m: number, h12 = true): string {
  const hh = ((h % 24) + 24) % 24;
  const mm = String(m).padStart(2, "0");
  if (!h12) return `${String(hh).padStart(2, "0")}:${mm}`;
  const ap = hh < 12 ? "AM" : "PM";
  const h12v = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12v}:${mm} ${ap}`;
}

/** URL hour label: 0 -> `12am`, 13 -> `1pm`. */
export function hourLabel(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  const ap = hh < 12 ? "am" : "pm";
  const h12v = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12v}${ap}`;
}

/** `9am` -> 9, `12am` -> 0, `1pm` -> 13. null when not a valid label. */
export function parseHourLabel(s: string): number | null {
  const m = /^(\d{1,2})(am|pm)$/.exec(s.trim().toLowerCase());
  if (!m) return null;
  const h = Number(m[1]);
  if (h < 1 || h > 12) return null;
  const pm = m[2] === "pm";
  if (h === 12) return pm ? 12 : 0;
  return pm ? h + 12 : h;
}

/** Display form of an hour label: `9 AM`, `12 PM (noon)` handled by callers. */
export function hourDisplay(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  const ap = hh < 12 ? "AM" : "PM";
  const h12v = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12v} ${ap}`;
}

/**
 * Free-text time input -> minutes after midnight, or null.
 * Accepts `9`, `9am`, `9 a`, `9:30 pm`, `9.30pm`, `21:15`, `2130`, `noon`,
 * `midday`, `midnight`.
 */
export function parseTimeInput(s: string): number | null {
  const t = s.trim().toLowerCase().replace(/\./g, ":").replace(/\s+/g, " ");
  if (!t) return null;
  if (t === "noon" || t === "midday" || t === "12 noon") return 720;
  if (t === "midnight") return 0;

  const m = /^(\d{1,2})(?::(\d{1,2}))?\s*(a|am|p|pm|a:m|p:m|a:m:|p:m:)?$/.exec(t);
  if (m) {
    let h = Number(m[1]);
    const mi = m[2] === undefined ? 0 : Number(m[2]);
    const ap = m[3];
    if (mi > 59) return null;
    if (ap) {
      if (h < 1 || h > 12) return null;
      const pm = ap[0] === "p";
      if (h === 12) h = pm ? 12 : 0;
      else if (pm) h += 12;
    } else {
      if (h > 23) return null;
    }
    return h * 60 + mi;
  }

  // 2130 / 930 / 0930
  const digits = /^(\d{3,4})\s*(a|am|p|pm)?$/.exec(t);
  if (digits) {
    const n = digits[1];
    let h = Number(n.slice(0, n.length - 2));
    const mi = Number(n.slice(-2));
    if (mi > 59) return null;
    const ap = digits[2];
    if (ap) {
      if (h < 1 || h > 12) return null;
      const pm = ap[0] === "p";
      if (h === 12) h = pm ? 12 : 0;
      else if (pm) h += 12;
    } else if (h > 23) return null;
    return h * 60 + mi;
  }
  return null;
}

/** Calendar-day difference between two wall times: -1, 0 or 1 (clamped). */
export function dayShift(a: Wall, b: Wall): number {
  const da = Date.UTC(a.year, a.month - 1, a.day);
  const db = Date.UTC(b.year, b.month - 1, b.day);
  const diff = Math.round((db - da) / 86_400_000);
  return diff === 0 ? 0 : diff > 0 ? 1 : -1;
}

/** Exact calendar-day difference between two wall times. */
export function dayShiftExact(a: Wall, b: Wall): number {
  const da = Date.UTC(a.year, a.month - 1, a.day);
  const db = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((db - da) / 86_400_000);
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** `15 Jan 2027` / `15 January 2027`. */
export function fmtDate(w: Wall, long = false): string {
  const m = (long ? MONTHS_LONG : MONTHS_SHORT)[w.month - 1];
  return `${w.day} ${m} ${w.year}`;
}

/** `Mon 15 Jan`. */
export function fmtDayDate(w: Wall): string {
  return `${w.weekday} ${w.day} ${MONTHS_SHORT[w.month - 1]}`;
}

/** `2027-01-15` */
export function isoDate(w: Wall): string {
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

/** Parse `YYYY-MM-DD`, returning null when malformed or out of range. */
export function parseIsoDate(s: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/** The visitor's IANA zone, with a safe fallback. */
export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Ordinal weekday-in-month description, e.g. "second Sunday in March". */
export function describeRule(ms: number, tz: string): string {
  const w = wallTime(tz, ms);
  const nth = Math.floor((w.day - 1) / 7) + 1;
  const names = ["first", "second", "third", "fourth", "fifth"];
  const dow = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    new Date(Date.UTC(w.year, w.month - 1, w.day)).getUTCDay()
  ];
  // last occurrence?
  const daysInMonth = new Date(Date.UTC(w.year, w.month, 0)).getUTCDate();
  const isLast = w.day + 7 > daysInMonth;
  return `${isLast ? "last" : names[nth - 1]} ${dow} in ${MONTHS_LONG[w.month - 1]}`;
}
