# 04 — Engine spec (`src/engine/`)

The engine is pure TypeScript on top of `Intl`. It runs unchanged on the server, in the client island and in the extension. **No dependencies, no DOM.** Cache `Intl.DateTimeFormat` instances per `tz|kind` in a `Map` (creating them is the expensive part).

## 4.1 `tz.ts`
| Function | Spec |
|---|---|
| `offsetMinutes(tz, ms=now)` | `new Intl.DateTimeFormat("en-US",{timeZone:tz,timeZoneName:"longOffset"})` → parse `"GMT-05:00"`, `"GMT+5:30"`; `"GMT"` → 0. Returns minutes (EST = −300). |
| `wallTime(tz, ms)` | `formatToParts` with `hourCycle:"h23"`, year/month/day/hour/minute/second/weekday:"short" → `{year,month(1-12),day,hour(0-23),minute,second,weekday}`. Apply `hour % 24` (some engines return "24"). |
| `zonedToUtc(tz,y,mo,d,h,mi)` | `asUtc = Date.UTC(...)`; `g1 = asUtc − off(asUtc)`; `g2 = asUtc − off(g1)`; return `min(g1,g2)` if they differ. In a spring-forward gap the time moves forward; in the fall-back overlap the first occurrence wins. |
| `fixedToUtc(off,…)` / `wallFromFixed(off, ms)` | The same, for a fixed offset. |
| `transitionsInYear(tz, year)` | Step through the UTC year one day at a time. When the offset changes, binary-search to **minute** precision. Returns `[{at, from, to}]`. Memoise by `tz|year`. |
| `nextTransition(tz, from)` | First transition after `from` in year, year+1 or year+2, else null. |
| `seasonalOffsets(tz, year)` | `jan = off(15 Jan)`, `jul = off(15 Jul)`. Equal → `{std:jan, dst:null}`, else `{std:min, dst:max}` (this works in both hemispheres). |
| `fmtOffset(min)` | `UTC−5`, `UTC+5:30`, `UTC+0` (Unicode minus sign "−"). |
| `fmtDuration(min)` | `3 hours`, `9 hours 30 minutes`, `45 minutes`, `1 hour`. |
| `fmtClock(h,m,h12=true)` | `9:00 AM`, `12:00 PM`, `12:00 AM`; 24h → `09:00`. |
| `hourLabel(h)` / `parseHourLabel(s)` | URL labels `12am, 1am … 11am, 12pm, 1pm … 11pm` ↔ 0–23. |
| `parseTimeInput(s)` | Accepts `9`, `9am`, `9 a`, `9:30 pm`, `9.30pm`, `21:15`, `2130`, `noon`, `midday`, `midnight`. With am/pm the hour must be 1–12; without it, 0–23; minutes 0–59. Returns minutes after midnight or null. |
| `dayShift(a,b)` | Calendar-day difference of two wall times (−1, 0, 1). |
| `fmtDate(w, long)` | `15 Jan 2027` / `15 January 2027`. |

## 4.2 `side.ts`
- `abbrFor(tz, ms)`: the abbreviation shown next to a time. Resolution order:
  1. A curated zone with the **same IANA id**, ignoring `generic` kinds.
  2. If the zone has **no DST**: a curated `std` zone with the same std offset on the same continent (`America/Phoenix` → MST, `America/Panama` → EST). Check this **before** step 3, otherwise Panama matches Colombia Time.
  3. Else a curated zone with the **same (std, dst) seasonal offsets** on the **same continent prefix** (`Europe/Paris` → CET/CEST, `America/Toronto` → EST/EDT). Ignore `Etc/*`.
  4. Else `fmtOffset` (e.g. `UTC+4`).
  Choose a base of kind std or fixed. If the zone is in DST, return the counterpart's abbreviation (EST → EDT). For Europe/London: BST in summer, GMT in winter.
- `zoneSide(z)` → `{ key: slug, kind:"zone", label: abbr, long: name, tz: iana, zoneSlug, href: /zones/slug }`.
- **Same-region rule** (`applySameRegionRule(a,b)`): if both sides are zones and share an IANA id, or are each other's counterparts (EDT/EST, CET/CEST, BST/GMT, AEDT/AEST), give each a `fixed` offset: std side = seasonal std, dst side = seasonal dst, `Etc/*` = 0. Result: `/edt-to-est` is always −1 h, all year.
- `sideOffset(s, ms)` = `s.fixed ?? offsetMinutes(s.tz, ms)`.
- `sideAbbr(s, ms)` = the fixed label when fixed; `fixed`-kind zones show their abbr; otherwise `abbrFor(zone.iana | s.tz, ms)`.

## 4.3 `pair.ts`
- `wallOf(side, ms)`, `instantOf(side, y,mo,d,h,mi)`: use the fixed variants when `side.fixed` is set.
- `diffMinutes(from,to,ms)` = `off(to) − off(from)`.
- `aheadBehind(from,to,ms)` → "EST is 3 hours ahead of PST", or "… are on the same time".
- `convertAt(from,to,y,mo,d,h,mi)` → `{fromH,fromM,toH,toM,shift,fromAbbr,toAbbr}`.
- `table24(from,to,ms)` → 24 rows for today's date in `from`.
- `rowText(r)` → "9:00 AM PST = 12:00 PM EST (next day)".
- `diffPeriods(from,to,year)`: cut the year at every transition of both sides, compute the difference in each segment, and merge equal neighbours. Then **drop segments shorter than 2 days** by merging them into the previous one. This is required because ET and PT both switch at 2 AM *local*, which creates a 3-hour sliver with a different difference. Without the merge, PST→EST looks like it varies, and page copy says "right now" when it shouldn't.
- `dstInfo(side, now)` → `{observes, next?:{at,dateText,fromAbbr,toAbbr,direction}}`. Ignore transitions more than 400 days away.
- `workOverlap(from,to,ms)`: with `d = diff`, `fromStart = max(540, 540−d)`, `fromEnd = min(1020, 1020−d)`; if `fromEnd ≤ fromStart`, return null. Else return the ranges in both zones and the minutes of overlap. When it's null, the page text suggests the first hour where both sides are between 7 AM and 10 PM.

## 4.4 Required test vectors (vitest, all must pass)
Use fixed instants `JAN = Date.UTC(2027,0,15,12)` and `JUL = Date.UTC(2027,6,15,12)`.
| Check | Expected |
|---|---|
| offset America/New_York JAN / JUL | −300 / −240 |
| offset Asia/Kolkata, Asia/Kathmandu, America/St_Johns (JAN) | 330, 345, −210 |
| `fmtOffset(330)` | `UTC+5:30` |
| US transitions 2027 | `2027-03-14T07:00:00Z`, `2027-11-07T06:00:00Z` |
| UK transitions 2027 | `2027-03-28T01:00:00Z`, `2027-10-31T01:00:00Z` |
| `zonedToUtc(NY, 2027-01-15 09:00)` | `2027-01-15T14:00:00Z` |
| `zonedToUtc(NY, 2027-03-14 02:30)` (gap) | a finite instant (moves forward) |
| `parseTimeInput` | 9am→540, "9:30 pm"→1290, 21:15→1275, noon→720, 12am→0, 9.30pm→1290, 25:00→null |
| every curated zone's IANA id | valid (no throw) |
| `nextTransition` LA / Kolkata | not null / null |
| `abbrFor` | NY JAN EST, NY JUL EDT, Toronto JUL EDT, Paris JUL CEST, London JAN GMT, London JUL BST, Phoenix JUL MST, Kolkata IST, Sydney JAN AEDT |
| `parsePair` canonical | pst-to-est→pst-to-est; pt-to-et→pst-to-est; edt-to-pst→est-to-pst; pdt-to-est→pdt-to-est; est-to-pht→est-to-philippine-time; india-time-to-est same; london-time-to-new-york-time same; usa-time-to-philippine-time→us-time-to-philippine-time; foo-to-est→null; est-to-est→null |
| PST→EST 9:00 on 2027-01-15 | 12:00, "PST", "EST"; 22:00 on 2027-07-15 → 01:00, next day, "PDT", "EDT" |
| EST→IST diff JAN / JUL | 630 / 570; `diffPeriods(2027)` length 3 |
| EDT→EST diff JAN and JUL | −60 and −60 |
| `workOverlap` PST→EST JAN | 300 minutes; EST→IST → null |
| `diffPeriods` PST→EST 2027 | length 1 (no 2 AM slivers) |
| `diffPeriods` EST→GMT 2027 | ≥ 3 |
| entities exist | india-time, uk-time, us-time, london-time, new-york-time, sydney-time, texas-time, toronto-time, dubai-time (dubai-time resolves through the alias → gst) |

Add a **matrix test**: for every pair of the 30 top zones, at both sides of each 2027 transition, check that `convertAt` equals a conversion done independently with `toLocaleString` in the target zone.
