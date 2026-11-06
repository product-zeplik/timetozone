# 11 — QA, tests, acceptance

## 11.1 Unit tests (`npm test`, vitest)
All the vectors in `docs/04 §4.4`, plus:
- A matrix test: 30 top zones × 30 × both sides of each 2027 transition, checked against `Date#toLocaleString` in the target zone.
- Content builders: `buildPair` for pst-to-est has title ≤ 60, h1 "PST to EST Converter", an answer containing "3 hours ahead", 24 rows and ≥ 6 FAQs. `buildHour(pst-to-est, 9)` has a title starting "9am PST to EST". `buildPlace(/time/uk/london)` has h1 "Current Time in London, United Kingdom".
- `parseSelection` (extension), per `docs/10`.

## 11.2 SEO lint (`scripts/seo-lint.mjs`, run after `next build`)
Walk `.next/server/app/**/*.html` (skip names starting with `_`). For each page, extract title, meta description, canonical, robots, H1 (strip `<!-- -->` and tags, decode entities) and every JSON-LD block.
**Errors (exit 1):** missing title/H1/description/canonical on indexable pages; a canonical that isn't self; JSON-LD that won't parse; **duplicate title, H1 or description across indexable pages**.
**Warnings:** title > 65 chars, description > 160 chars, HTML > 120 KB (except map pages), and a `primary` keyword from the CSV whose significant words (excluding to/in/the/is/what/time/zone) are missing from its page's title + H1. Normalise accents (NFKD) and punctuation before comparing.
The reference build's lint found real bugs: New York city vs state duplicates, a CRLF-broken CSV, and hour titles using "9 AM" where people search "9am". Keep it in CI.

## 11.3 Smoke test (against `node .next/standalone/server.js` with SITE_ENV=production)
Copy `public/` and `.next/static/` into `.next/standalone/` first. Then check:
| Request | Expect |
|---|---|
| `/`, `/pst-to-est`, `/est-to-ist`, `/pst-to-est/9am`, `/time/uk/london`, `/time/usa/texas`, `/time-zone/texas`, `/zones/est`, `/time/india`, `/india-time-to-est`, `/us-time-to-philippine-time`, `/est-to-philippine-time`, `/time-zone-map`, `/time-zone-map/usa`, `/daylight-saving-time/usa`, `/meeting-planner`, `/time/japan/osaka`, `/lagos-time-to-est` | 200 |
| `/sitemap/0.xml` … `/sitemap/4.xml`, `/robots.txt`, `/llms.txt`, `/api/search`, `/api/health`, `/og?t=Test`, `/map/world.svg`, `/map/usa.svg` | 200 |
| `/nonexistent-to-x`, `/time/narnia` | 404 |
| `/pt-to-et` → `/pst-to-est`; `/edt-to-pst` → `/est-to-pst`; `/est-to-pht` → `/est-to-philippine-time`; `/usa-time-to-philippine-time` → `/us-time-to-philippine-time`; `/japan-time-to-est` → `/jst-to-est`; `/pst-to-est/09am` → `/pst-to-est/9am` | 308 |
| `/PST-to-EST` with `x-forwarded-host: timetozone.com` | 301 → `https://timetozone.com/pst-to-est` (not localhost) |
| any page on a non-production host | `X-Robots-Tag: noindex, nofollow` |
| HTML sizes | pair ~60 KB, map pages < 80 KB |

## 11.4 Browser QA (Playwright, Chromium is preinstalled in most CI images)
At 375×812 and 1280×800, in light and dark: home, `/pst-to-est`, `/pst-to-est/9am`, `/time/uk/london`, `/zones/est`, `/meeting-planner`, `/time-zone-map`. Check:
- No console errors and no React hydration warnings.
- Converter: typing "9am" updates every row; the slider moves times in 15-minute steps; Now resets; 12/24h persists across reloads; Swap navigates to the reverse URL; add a city through search (keyboard + mouse); remove; ↑ makes that row the reference; Copy puts "9:00 AM PST / 12:00 PM EST" on the clipboard; Share copies a URL with `?t=09:00&d=YYYY-MM-DD` that restores the state; Add to calendar downloads a valid .ics.
- JS disabled: the answer, table and FAQ are visible.
- Lighthouse mobile on 10 template URLs: Performance ≥ 95, SEO 100, Accessibility ≥ 95, CLS 0.

## 11.5 Definition of Done, per URL
- [ ] 200, self-canonical, correct robots, in the right sitemap (or noindex + not in the sitemap)
- [ ] Title, meta, H1 and answer follow `docs/06` and contain the primary keyword from the CSV
- [ ] The answer is correct today and on both sides of the next transition
- [ ] All modules required for its type render; FAQ JSON-LD matches the visible FAQs
- [ ] ≥ 5 inbound internal links; ≤ 3 clicks from home
- [ ] Works at 320px, in dark mode, and without JS
- [ ] Ads only in reserved slots and only after consent
