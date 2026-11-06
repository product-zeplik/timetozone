# 06 — Page specs (exact templates)

Notation: `A`/`B` = title labels of from/to sides. `tLabel(side)`: zone → abbreviation (`PST`), except slugs ending in `-time`, which use the name minus " Standard" (`Philippine Time`, `China Time`, `Bangladesh Time`). Place → `{label} Time` (`India Time`, `UK Time`, `US Time`, `London Time`). `familyName(side)`: zone name with Standard/Daylight/Summer removed (`Pacific Time`, `India Time`); UTC/GMT stay as the abbreviation; place → `{label} time`. `abbrNow` = `sideAbbr(side, now)`. `title(core)` appends ` | TimeToZone` only if the total stays ≤ 60 characters.

All numbers in the copy come from the engine at render time. Each sentence below is a template; fill it with computed values.

---
## A/C. Pair page `/{a}-to-{b}`
**Title:** `title("{A} to {B} Converter – {familyName(from)} to {familyName(to)}")` if ≤ 60 characters, else `title("{A} to {B} Converter")`.
→ "PST to EST Converter – Pacific Time to Eastern Time"
**Meta:** `Convert {A} to {B}: {abbrTo} is {dur} {ahead of|behind} {abbrFrom}{ right now, only if the difference varies}. {example}. Live clocks, 24-hour table, DST dates and best meeting times.` (≤ 155 characters, clipped at a word boundary)
**H1:** `{A} to {B} Converter`
**Answer (server-rendered, bold, first paragraph):** `{abbrTo} is {dur} {ahead of|behind} {abbrFrom}. {9:00 AM X = … Y}.`

**Body, in this order:**
1. Breadcrumbs: Home › Time zones › {from abbr} › {A to B} (zone sides), or Home › {place} › {A to B}.
2. H1 + answer.
3. `<Converter initial={[from,to]} reverseHref="/{b}-to-{a}" validUntil={…}/>`
4. Ad slot 1 (not lazy).
5. Intro paragraph 1: `{abbrTo} is {dur} {ahead of|behind} {abbrFrom}{ at the moment}. To convert {A} to {B}, {add|subtract} {dur}: {example}.`
6. Intro paragraph 2: `{A} ({familyName}) is used in {zone.region | place long}. {B} (…) is used in {…}.`
7. **H2** `{A} to {B} time conversion table`, with a small note "Today's date. Green rows are 9 AM–5 PM in both places." and a 24-row table (`{fromTime} {fromAbbr}` | `{toTime} {toAbbr}` + "next day"/"previous day"). Rows inside working hours on both sides are green (`.biz`); target night hours (22–6) are shaded.
8. Ad slot 2 (lazy).
9. **H2** `How to convert {A} to {B}`: "Add/Subtract {dur} to the {A} time to get {B}." Then "Example: …", then a cross-midnight example if one exists.
10. **H2** `Time difference between {A} and {B}`: if constant, "The time difference between A and B is X all year – B is ahead/behind." If it varies, a lead-in sentence plus one bullet per period: `{d Mon yyyy} – {d Mon yyyy}: B is X ahead of/behind A.`
11. **H2** `{A} and {B} during daylight saving time`: one bullet per side, either `{tLabel} next changes on {date}: clocks go forward/back one hour, from X to Y.` or `{tLabel} does not observe daylight saving time; it stays on UTC±X all year.`
12. **H2** `Best time for a meeting between {A} and {B}`: the overlap sentence (from `workOverlap`) or the best compromise, plus a link to `/meeting-planner`.
13. Ad slot 3 (lazy).
14. **H2** `{A} to {B} FAQ` (`<details>` accordion), questions in this order:
    - What is the time difference between {A} and {B}?
    - What is 9 AM {A} in {B}?
    - What is 12 PM (noon) {A} in {B}?
    - Is {tLabel(to)} ahead of or behind {tLabel(from)}?
    - Does {tLabel(side)} change for daylight saving time? (one per side)
    - What is the best time for a meeting between {A} and {B}?
    - For PST/EST/CST/MST sides that aren't fixed: "Is PT the same as PST?" → "PST is the winter (standard) name of Pacific Time (PT). From March to November the same clocks are called PDT. This converter always uses the one in force on the date you choose."
15. **H2** `Related conversions` with H3 groups: `Convert {A} to other zones` (reverse first), `Convert other zones to {B}`, `{A} to {B} by hour` (24 links, if an HOUR_PAIR), `Learn more` (zone/place pages).
16. "Updated {d Month yyyy}. Time zone data: IANA tz database."
17. Chrome extension link (only when `NEXT_PUBLIC_CHROME_STORE_URL` is set).

**JSON-LD graph:** BreadcrumbList, WebApplication (`{A} to {B} converter`, UtilitiesApplication, price 0), FAQPage (exactly the visible FAQs), WebPage (dateModified = today). The Organization and WebSite nodes come from the layout.

---
## B. Hour page `/{a}-to-{b}/{h}`
**Title:** `title("{9am} {A} to {B} – {9:00 AM} {fromAbbr} is {12:00 PM} {toAbbr}")`, falling back to `title("{9am} {A} to {B}")`. **Use the compact searched form (`9am`, `12pm`) in the title** to match queries like "9am pst to est" (33.1K).
**H1:** `{9 AM}{ (noon)|(midnight)} {A} to {B}` (spaced display form).
**Meta:** `{9:00 AM} {fromAbbr} is {12:00 PM} {toAbbr}{ the next day}. See {9 AM} {A} in {4 zone labels} and more, plus quarter-hour conversions.`
**Answer:** `{9:00 AM} {fromAbbr} is {12:00 PM} {toAbbr}{ (next day)}.`
**Body:** Converter locked to that hour (`lockedMinutes = h*60`) → ad → **H2** `{9 AM} {A} in other time zones` (a table for 8 of: est cst mst pst utc gmt ist cet jst aest sgt philippine-time, excluding both sides) → **H2** `Quarter hours: …`, a list of :00, :15, :30, :45 (`rowText`) covering "11:30 am pst to est" style queries → prev/next/all-times links → ad → FAQ (What is 9 AM A in B? / Is 9 AM A the same day in B? / What is 9:30 AM A in B?) → parent's Related → Updated.

---
## D. Place clock `/time/{country}[/{city|region}]`
**Title:** first that fits within 60: `Time in {nameShort} Now – Current Local Time` → `Time in {nameShort} Now` → `Time in {name} Now`, where nameShort = city: `{city}, {UK|USA|UAE|country}`; country: `{UK|USA|UAE|name}`; region: name (+ " State" on clashes).
**H1:** city `Current Time in {city}{ (LA|NYC|DC|Saigon|Bombay|Calcutta|Madras|Peking)}, {country}`; others `Current Time in {full}`.
**Answer:** single-zone: `{name} is on {Intl long zone name} – {abbr} (UTC±X) right now. It switches to {abbr2} (UTC±Y) on {date}.` (or `{name} does not observe daylight saving time.`). Multi-zone: `{name} has more than one time zone. The main one (…) is {zone}, currently {abbr} (UTC±X).`
**Meta:** `Current local time in {full}: {abbr} (UTC±X). {next change sentence} Convert {name} time to your time zone.`
**Body:** Breadcrumbs (Home › Current time › Country › Place) → H1 → answer → big `LiveClock` card → (multi-zone) **H2** `Time zones in {name}` table (zone, offset now, live time, up to 6 main cities) + link to `/time-zone/{slug}` → **H2** `Convert {name} time`, with a Converter of [place, UTC for American places / EST otherwise] → ad → **H2** `Time zone of {name}` (zone name, abbreviation, offset, IANA id) → **H2** `Time difference between {name} and other cities`, a 10-row table from New York, Los Angeles, London, Paris, Dubai, India, Manila, Tokyo, Sydney, Toronto, Chicago, Singapore (difference + live time) → **H2** `Daylight saving time in {name}` with H3 for this year and next, each change: "Clocks go forward/back 1 hour at 02:00 local time, from EST (UTC−5) to EDT (UTC−4)." → ad → FAQ (What time is it in X right now? / What time zone is X in? / Does X observe DST? / Time difference between X and {first comparison}?) → children links (country: its regions + 40 cities; region: up to 30 cities; city: 12 more cities in the country) → Updated.
**JSON-LD:** BreadcrumbList, City (with geo) or Place, with `containedInPlace` Country and `additionalProperty` timeZone = IANA id, FAQPage, WebPage.

## E. Multi-zone `/time-zone/{slug}`
**Title:** country `{name} Time Zones – What Time Zone Is {name}?`; region `What Time Zone Is {name}? {abbr1, abbr2, abbr3}` (≤ 60).
**H1:** `What Time Zone Is {name}?`
**Body:** the same components as D, **minus** the comparison table and children lists (avoids duplicating D). The zones table is the main content.
**Meta:** `{name} uses {n} time zones ({abbrs}). See which areas use each zone, the current time in each and DST dates.`

## F. Zone page `/zones/{slug}`
**Title:** `{ABBR} Time Now – {Name} (UTC±X)`, falling back to `{ABBR} Time Now – {Name}`.
**H1:** `{Name} ({ABBR})`
**Answer (definition, ≤ 50 words; for featured snippets and AI answers):**
- generic: `{Name} ({ABBR}) is the local time on the clocks of {region}. {note}`
- fixed: `{Name} ({ABBR}) is UTC±X. It is used in {region} and does not change for daylight saving time.`
- std: `… is UTC±X. It is the standard (winter) time of {region}; in summer the same area uses {DST abbr} (UTC±Y).`
- dst: `… is the daylight saving (summer) time of {region}; in winter the area returns to {STD abbr} (UTC±X).`
**Body:** note → LiveClock → (if this std/dst name isn't in force now, a small note saying which one is) → **H2** `Convert {ABBR}`, a Converter of [zone, UTC (EST for the UTC page)] → ad → **H2** `Where {ABBR} is used` (region text + country links with matching seasonal offsets + major cities) → **H2** `{ABBR} and daylight saving time` (next change) → **H2** `Convert {ABBR} to other time zones` (up to 24 indexed pairs) → FAQ (What is X? / What is the current X time? / Difference between X and counterpart? / Is X the same as the generic name? / Which countries use X?) → Updated.

## G. DST `/daylight-saving-time` and `/daylight-saving-time/{country}`
Hub title: `Daylight Saving Time {Y} – When Do Clocks Change?`. Answer: the US/Canada, UK/EU and Australia dates for Y and Y+1. Then a list of DST countries. FAQ: US rule (second Sunday in March / first Sunday in November, 2:00 AM), UK/EU rule (last Sunday in March / October, 01:00 UTC), countries without DST.
Country page title: `Daylight Saving Time {Y} in {Country}`. H1: `Daylight Saving Time in {Country} ({Y}–{Y+1})`. One section per distinct DST schedule among its zones. FAQ: when clocks go forward / back, and whether the whole country observes it (if some zones don't).

## Tools (`ToolPage` wrapper: breadcrumbs, H1, answer, tool, ad, extra, FAQ, WebApplication + FAQPage JSON-LD)
| Path | Title | H1 | Tool behaviour | Extra content |
|---|---|---|---|---|
| `/` | Time Zone Converter – Convert Time Between Zones | Time Zone Converter | Converter [EST, PST, UK, India] with `autoLocal` | top 48 pairs, 18 hour pages, 40 city clocks, a "How it works" paragraph, extension CTA, 4 FAQs |
| `/world-clock` | World Clock – Current Time Around the World | World Clock | 12 default cities (NY, LA, Chicago, London, Paris, Dubai, India, Manila, Tokyo, Sydney, São Paulo, UTC); add/remove; saved in localStorage | 3 FAQs |
| `/meeting-planner` | Meeting Planner – Find the Best Time Across Time Zones | Meeting Planner Across Time Zones | up to 8 places, date, working-hour range; 24 rows; green where everyone is within working hours; "Best times" summary | 3 FAQs |
| `/what-time-zone-am-i-in` | What Time Zone Am I In? – Detect My Time Zone | What Time Zone Am I In? | detect via Intl: long name, abbreviation, offset, IANA id, local time, next change; privacy note | 3 FAQs |
| `/time-zone-map`, `/usa` | Time Zone Map – World Time Zones Right Now / US Time Zone Map – Eastern, Central, Mountain, Pacific | World / US Time Zone Map | `<object data="/map/world.svg">` (see `docs/09`) | a text list of countries/states grouped by offset (crawlable links), legend, FAQs |
| `/time-zones` | Time Zones – List of Time Zone Abbreviations | Time Zones and Abbreviations | table of 62 zones sorted by offset | links to all 247 countries |
| `/military-time-converter` | Military Time Converter – 24-Hour Time Chart | Military Time Converter | free-text → military/24h/12h | 24-row chart, 4 FAQs (1300, conversion rule, vs 24-hour, 2400) |
| `/unix-timestamp-converter` | Unix Timestamp Converter – Epoch to Date | Unix Timestamp Converter (Epoch Converter) | live epoch; timestamp → UTC + local (auto-detect s vs ms: > 1e11 is ms); datetime → s/ms | 3 FAQs (incl. the 2038 problem) |
| `/time-calculator` | Time Calculator – Add, Subtract and Time Between | Time Calculator | duration between two times (wraps midnight); date ± h:m | 2 FAQs |
| `/time-unit-converter` | Time Unit Converter – Seconds, Minutes, Hours, Days | Time Unit Converter | ms, s, min, h, day, week, month (30.44 d), year (365.24 d), h:mm:ss | 3 FAQs |

Trust pages (`/about`, `/contact`, `/privacy`, `/terms`): short and factual. The privacy page must name AdSense cookies, the Google Ads Settings opt-out, consent for EEA/UK/CH, and analytics. Get legal review before launch.
