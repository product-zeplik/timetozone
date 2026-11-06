# 07 — Keyword map (`data/keyword-map.csv`)

## Format
`keyword,market,volume,kd,target_url,slot`: 351 rows from Semrush (US, IN, UK, AU, CA, PH databases, Nov 2026), mapping to 185 URLs.
- `market`: Semrush database. `volume`: average monthly searches. `kd`: Semrush KD% (blank if not reported).
- `slot`: where the keyword must appear on its page:
  - `primary`: title + H1 + URL + answer (lint-checked).
  - `synonym`: intro sentence 2 or FAQ wording (e.g. "pt to est" on `/pst-to-est`).
  - `secondary`: meta description or an H2.
  - `h2`: must be an H2 on that page (e.g. "what time zone is california" → H2 "Time zone of California").
  - `faq`: a FAQ question.
  - `intro`: the definition sentence (zone pages).
  - `title`: in the title tag (e.g. "est to ist converter").
  - `quarter-hour block`: the hour page's :15/:30/:45 list (e.g. "11:30 am pst to est").

The same keyword can appear in several markets (US and CA "pst to est"), always mapping to the **same URL**. There is one global URL per intent; English-language targeting is shared.

## Anti-cannibalisation rules
1. **Directional pairs are separate URLs** (`/pst-to-est` ≠ `/est-to-pst`). They are different SERPs (74K vs 22.2K). Each links to its reverse.
2. **Synonyms share a URL; spellings redirect.** pt/et, "pacific time to eastern time", "pst to est converter", "pst time to est" → `/pst-to-est`. Alias slugs 308 to the canonical (`docs/03`).
3. **"Time difference between A and B"** never gets its own page. It's an H2 + FAQ on the higher-volume direction's pair page.
4. **"{time} A to B"**: hour pages exist only for the 40 HOUR_PAIRS. Other pairs answer time-specific queries in their 24-hour table.
5. **"time in X" and "what time is it in X"** → place clock `/time/...`. **"what time zone is X"** → an H2 on the same place page, *unless* X spans several zones (Texas, Florida, Michigan, Indiana, Tennessee, Canada, USA, Australia…), in which case it's `/time-zone/{x}`.
6. **"EST time", "what is EST", "EST vs EDT"** → zone pages (`/zones/est`, `/zones/et`), never pair pages.
7. **Country-time vs zone pairs:** `india-time-to-est` (6.6K, "india time to est") and `ist-to-est` (18.1K, "ist to est") are both kept because they're distinct queries. Where a country's only zone already has a "-time" slug (Philippines), the country form redirects (`philippines-time` → `philippine-time`) to avoid near-duplicates.
8. **Never add a page whose primary keyword already exists in the CSV under another URL.** The SEO lint enforces this.

## Highest-value targets (from the CSV)
| URL | Primary (vol, KD) | Key secondaries |
|---|---|---|
| `/` | time zone converter (US 1.5M, 93) | time converter 40.5K, time zone calculator 12.1K, time difference 9.9K, current time 135K, time now 110K, what time is it 2.74M (local clock module) |
| `/time/india` | time in india (US 1.0M, 75) | india time (UK 135K, CA 201K, AU 135K), what time is it in india 135K |
| `/world-clock` | world clock (US 823K, 100) | world time 22.2K |
| `/time/usa/california` | what time is it in california (550K, 77) | time in california (PH 90.5K) |
| `/zones/ist` | ist time (368K, 67) | — |
| `/military-time-converter` | military time (301K, 50) | military time converter 22.2K |
| `/time/uk/london` | time in london (301K, 81) | what time is it in london 246K, london time (IN 201K) |
| `/time-zone-map` | time zone map (201K, 61) | world time zone map 12.1K |
| `/what-time-zone-am-i-in` | what time zone am i in (135K, 55) | time zone 40.5K |
| `/est-to-ist` | est to ist (IN 135K, 48; US 22.2K, 50) | est to ist converter 27.1K, est to india time 9.9K, et to ist 5.4K, edt to ist 4.4K |
| `/pst-to-est` | pst to est (74K, 41) | pt to est 33.1K, pacific time to eastern time 27.1K, pt to et 8.1K, pst to est converter 8.1K, pst time to est 8.1K |
| `/pst-to-est/9am` | 9am pst to est (33.1K, 53) | 9 am pst to est 12.1K |
| `/cst-to-est` | cst to est (74K, 26) | central time to eastern time 33.1K |
| `/utc-to-est` | utc to est (49.5K, 14) | — |
| `/est-to-philippine-time` | est to philippine time (PH 12.1K, 30) | est to pht 2.4K, est to ph time 1.3K, est to manila time 1.0K |

## Maintenance
- After launch, export GSC queries every month. Any query with ≥ 100 impressions that isn't in the CSV gets a row: map it to an **existing** URL, or (only when the intent is new) to a new URL that passes the indexing gate.
- Re-pull Semrush/Ahrefs volumes every quarter.
- Still to research before build freeze: the Pakistan, UAE, Nigeria and Germany databases, and Keyword Magic exports for every Tier 1 pair (done for PST→EST: 311.9K related keywords; its hour variants alone total ~205K/month).
