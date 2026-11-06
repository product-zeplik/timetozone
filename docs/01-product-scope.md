# 01 — Product scope

## Goal
Rank #1–3 on Google, Bing and AI answer engines for time-conversion searches, and earn $20–30K/month from AdSense at 5.7–8.6M visits/month (planning maths in the strategy doc). Every page answers one question instantly, works without JavaScript, and is clean enough to become the mobile app's screens unchanged.

## What we build (complete list)

### A. Conversion pages (programmatic, the traffic engine)
| Type | Example URL | Answers |
|---|---|---|
| A. Zone ↔ zone | `/pst-to-est` | "pst to est", "pacific time to eastern time", "pt to et", "time difference pst est" |
| B. Hour page | `/pst-to-est/9am` | "9am pst to est", "what is 9 am pst in est" |
| C. Place ↔ zone / place ↔ place | `/india-time-to-est`, `/london-time-to-new-york-time`, `/us-time-to-philippine-time` | "india time to est", "time difference london new york" |
| D. Place clock | `/time/india`, `/time/usa/texas`, `/time/uk/london` | "time in india", "what time is it in london", "london time" |
| E. Multi-zone place | `/time-zone/texas`, `/time-zone/usa` | "what time zone is texas", "canada time zones" |
| F. Zone page | `/zones/est` | "est time", "what is est", "est vs edt" |
| G. DST | `/daylight-saving-time`, `/daylight-saving-time/usa` | "when do clocks change", "daylight saving time 2026" |

### B. Tools (hub pages)
`/` time zone converter (head terms: "time zone converter" 1.5M US) · `/world-clock` · `/meeting-planner` · `/what-time-zone-am-i-in` · `/time-zone-map` + `/time-zone-map/usa` · `/time-zones` (all abbreviations) · `/military-time-converter` · `/unix-timestamp-converter` · `/time-calculator` (duration between times; add/subtract) · `/time-unit-converter` (seconds ↔ minutes ↔ hours ↔ days…).

### C. Trust pages (required for AdSense approval)
`/about`, `/contact`, `/privacy`, `/terms`.

### D. Machine endpoints
`/sitemap/{0..4}.xml`, `/robots.txt`, `/llms.txt`, `/api/search` (zone/place index for the picker), `/api/health`, `/api/revalidate` (secret), `/og?t=` (Open Graph image), `/map/world.svg`, `/map/usa.svg`, `/manifest.webmanifest`, `/ads.txt`.

### E. Chrome extension (MV3)
Popup world clock with a slider, plus a right-click "Convert '3pm EST' to my time" action. See `docs/10`.

## Coverage requirements
- **All 247 ISO countries**, **all IANA zones** that Node's ICU supports (~418), **all cities ≥100K population** (~2,860), **US states, Canadian provinces, Australian states, plus Brazilian, Mexican, Russian and Indonesian regions** (~253).
- **62 curated abbreviations** (`data/zones.ts`): ET/EST/EDT, CT/CST/CDT, MT/MST/MDT, PT/PST/PDT, AKST/AKDT, HST, AST/ADT, NST/NDT, UTC, GMT, BST, WET, CET/CEST, EET/EEST, MSK, TRT, IRST, GST, PKT, IST, NPT, Bangladesh ST, ICT, WIB, SGT, MYT, Philippine Time, HKT, China ST, JST, KST, AWST, ACST/ACDT, AEST/AEDT, NZST/NZDT, SAST, WAT, CAT, EAT, BRT, ART, COT, PET, CLT, SST, ChST.
- **Every combination is valid at runtime.** Any entity can be converted to any other: abbreviation ↔ abbreviation, abbreviation ↔ place, place ↔ place. The indexing gate decides which ones Google sees (`docs/05`).
- **DST now and in future:** offsets and transition dates are computed from tzdata for the current and next year, automatically, forever. Nothing is year-hard-coded. Pages revalidate daily and right after a transition.
- **Every time format:** 12h/24h toggle, free-text input ("9", "9am", "9:30 pm", "21:15", "2130", "9.30pm", "noon", "midnight"), date picker, quarter-hour slider.

## Use cases the converter must handle (acceptance list)
1. Convert a time between 2 zones (the default page state).
2. Convert between up to 6 places at once (add or remove; the first row is the reference).
3. Convert on a future or past date, so the DST rules of that date apply.
4. Times that cross midnight, shown as "next day" / "previous day".
5. Times inside a DST gap (2:30 AM on spring-forward day) move forward; ambiguous fall-back times use the first occurrence.
6. Half- and quarter-hour zones (IST +5:30, NPT +5:45, NST −3:30, ACST +9:30).
7. Zones without DST (Arizona MST, Hawaii, India, Japan, Queensland AEST).
8. Southern-hemisphere DST (Sydney, Auckland, Santiago): DST in Northern-hemisphere winter.
9. US/EU mismatch weeks, when the US has changed and Europe hasn't (the difference is 1 hour different for ~3 weeks each spring and ~1 week each autumn).
10. Same-region pairs (EDT ↔ EST, CET ↔ CEST, BST ↔ GMT): always the fixed 1-hour difference.
11. "Is PT the same as PST?" (generic vs standard names).
12. Meeting overlap: shared 9–5 working hours, or the best compromise slot.
13. Share a link (`?t=HH:MM&d=YYYY-MM-DD`), copy as text, download a .ics calendar event.
14. Auto-detect the visitor's zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`), never their geolocation.
15. Works with JavaScript disabled: the answer line, 24-hour table and FAQ are all in the HTML.

## Explicitly out of scope
Weather, holidays, news, calendars of events, astrology, sunrise/sunset, flight tracking, user accounts, comments, blog posts not tied to a conversion intent, and AI-generated filler text.
