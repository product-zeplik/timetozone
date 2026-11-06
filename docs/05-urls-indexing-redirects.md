# 05 — URLs, indexing gate, redirects

## 5.1 URL patterns (lowercase, hyphenated, no trailing slash)
| Pattern | Example | Valid when | 404 when |
|---|---|---|---|
| `/{a}-to-{b}` | `/pst-to-est`, `/india-time-to-est` | `parsePair` succeeds | unknown entity, or a == b |
| `/{a}-to-{b}/{hour}` | `/pst-to-est/9am` | valid pair + hour ∈ `12am..11pm` | otherwise |
| `/time/{country}` · `/time/{country}/{city or region}` | `/time/uk/london`, `/time/usa/texas` | in countries / places / regions | > 2 segments or unknown |
| `/time-zone/{country or region entity}` | `/time-zone/texas`, `/time-zone/usa` | multi-zone only | single-zone places |
| `/zones/{slug}` | `/zones/est` | curated zone | — |
| `/daylight-saving-time/{country}` | `/daylight-saving-time/usa` | country with a transition this year or next | — |
| `/time-zone-map`, `/time-zone-map/usa` | | | other regions |

## 5.2 Redirects (all permanent)
| Input | Target | Where |
|---|---|---|
| Any uppercase path | lowercase | `middleware.ts`, 301. **Build the absolute URL from `x-forwarded-host`/`host` + `x-forwarded-proto`**, not `req.nextUrl`, or you'll redirect to `localhost:3000` behind Railway. |
| Pair alias / generic / DST-name side | canonical pair | page: `permanentRedirect()` (308) |
| Hour variants `9AM`, `09am`, `9-am` | `/…/9am` | hour page: normalise, then `permanentRedirect` |
| `/time/...` legacy city spellings | not needed at launch | — |

## 5.3 Indexing gate (`src/seo/gate.ts`)
`indexedPairs()` = the canonical slugs of:
1. Every pair URL in `keyword-map.csv` (including the parent pairs of hour URLs).
2. The full matrix of the 30 `top` zones (≈870).
3. TOP_PLACES × PLACE_TARGETS in both directions. TOP_PLACES = ranked countries with rank < 40 (as `{slug}-time`, US as `us-time`), plus the top 70 cities by population, plus the top 20 US cities, plus the top 30 cities in GB/CA/AU/IN/AE/DE/FR (deduplicated). PLACE_TARGETS = `est pst cst mst gmt utc ist aest cet jst bst sgt`.
4. TOP_PLACES[0..30] × each other.
Exclude any pair whose two sides resolve to the same IANA zone with no fixed offset (e.g. `india-time-to-ist`); that pair is noindex.

Pairs that are valid but not indexed still render (users can reach them through the picker or a shared link), with `robots: noindex, follow`, no sitemap entry, and no internal links pointing to them.

`staticPairs()` = (1) + (2): pre-built at build time. Everything else is generated on first request and then cached (ISR).

`HOUR_PAIRS` (40) = zone↔zone pairs ranked by total measured volume (pair + hour keywords), padded from this list:
`est-to-pst, pst-to-est, cst-to-est, est-to-cst, est-to-ist, ist-to-est, pst-to-ist, cst-to-pst, mst-to-est, utc-to-est, est-to-gmt, gmt-to-est, est-to-utc, utc-to-pst, pst-to-gmt, cet-to-est, est-to-cet, est-to-aest, aest-to-est, est-to-jst, jst-to-est, est-to-philippine-time, pst-to-philippine-time, bst-to-est, est-to-bst, pst-to-cst, cst-to-ist, ist-to-pst, ist-to-cst, mst-to-pst, est-to-mst, utc-to-ist, ist-to-utc, gmt-to-ist, ist-to-gmt, cet-to-ist, pst-to-utc, utc-to-cst, kst-to-est, est-to-kst`.
40 × 24 = **960 hour pages, all launched together**. Hour pages for other pairs render as noindex.

Place pages: all countries, regions and cities are indexable. Pre-build the ranked countries, the US/CA/AU regions and the top 200 cities; the rest are generated on demand.

## 5.4 Canonical rules
- Every indexable page has a self-referencing absolute canonical: `https://timetozone.com{path}`. The homepage canonical is `https://timetozone.com`.
- Query parameters (`?t=`, `?d=`, `?z=`) never change the canonical, and robots.txt disallows `/*?t=`, `/*?d=`, `/*?z=`.
- Non-production (`SITE_ENV !== "production"`): `X-Robots-Tag: noindex, nofollow` on every response, and robots.txt `Disallow: /`.

## 5.5 Internal linking (only to indexed URLs)
- Every page has a breadcrumb trail, a header nav (World clock, Time zones, Map, Meeting planner, My time zone) and a footer (10 popular conversions, 8 place clocks, all tools, trust pages).
- Pair page: reverse pair (if indexed), up to 8 same-source pairs over the top zones, up to 8 same-target pairs, all 24 hour pages (if an HOUR_PAIR), and the zone/place pages of both sides.
- Hour page: previous hour · parent pair · next hour, plus the parent pair's related blocks.
- Place page: its country, 10 comparison cities (linked to the pair page when that pair is indexed, else the city page), child regions and cities (country pages), and cities in the same country.
- Zone page: up to 24 indexed conversions involving the zone, countries sharing the same seasonal offsets, and major cities on that IANA id.
- Home: the top 48 pairs by measured volume, 18 hour pages, 40 city clocks.
- Hubs: `/time-zones` links every zone and every country, `/daylight-saving-time` every DST country, `/time-zone-map` every country (grouped by offset).
- Use `prefetch={false}` on all long link lists.
- Target: every indexed page has ≥ 5 internal inbound links and is ≤ 3 clicks from home.
