# 13 — Build plan for Claude Code (do these in order)

Each milestone ends with its acceptance check. Don't start the next one until it passes. Commit after each milestone.

## M0 — Scaffold
- `npm init`; install `next@15.5 react@19 react-dom@19 redis@4 d3-geo@3 topojson-client@3 topojson-simplify@3 world-atlas@2 us-atlas@3 i18n-iso-countries@7`; dev: `typescript@5 @types/react@19 @types/node@22 @types/d3-geo @types/topojson-client @types/chrome vitest@3 esbuild countries-and-timezones@3 city-timezones@1`. Add `src/types.d.ts` with `declare module "topojson-simplify";`.
- `tsconfig.json` (strict, bundler resolution, resolveJsonModule, `@/*` alias), `vitest.config.mts` (alias `@`), `.gitignore`, `.env.example` (`docs/12`), the npm scripts from CLAUDE.md, `engines.node ">=22 <23"`.
- Copy the kit's `data/zones.ts` → `src/data/zones.ts` and `data/keyword-map.csv` → `src/data/keyword-map.csv`.
**Accept:** `npm run typecheck` passes on an empty app.

## M1 — Data pipeline (`docs/03`)
Write `scripts/build-data.mjs`.
**Accept:** `npm run data` prints about `247 countries, 253 regions, 2859 cities, 351 keywords, tzdata 2026x`. `countries.json` contains India (`Asia/Kolkata`). The multi-zone US states are AK AZ FL ID KS KY MI NE ND OR SD TN TX. `/usa/new-york` is the city and `/usa/new-york-state` the state. Keywords include the `slot` field.

## M2 — Engine (`docs/04`)
`src/engine/tz.ts`, `side.ts`, `pair.ts`, `entities.ts` + `tests/engine.test.ts` with every vector from §4.4 and the matrix test.
**Accept:** `npm test` is all green.

## M3 — SEO core
`src/site.ts`, `src/seo/meta.ts` (title(), clip(), pageMeta(), ld.*, graph()), `src/seo/gate.ts` (`docs/05`).
**Accept:** in a unit test, `indexedPairs().size` is ~4–5K, `staticPairs()` ~880, and `HOUR_PAIRS` has length 40 and includes pst-to-est, est-to-ist and cst-to-est.

## M4 — Layout + design system
`app/layout.tsx` (header nav, footer, Organization/WebSite JSON-LD, AdSense/GA loaders), `globals.css` (`docs/09`), `Blocks.tsx` (JsonLd, Crumbs, Faq, Related, Updated), `not-found.tsx`.
**Accept:** dev server renders the layout in light and dark at 320px with no horizontal scroll.

## M5 — Client islands
`Converter`, `ZoneSearch`, `LiveClock`, `AdSlot` (`docs/02` + use cases in `docs/01`).
**Accept:** on a test page every behaviour in `docs/11 §11.4` works, with no hydration warnings.

## M6 — Pair + hour pages
`content/pair.ts` (buildPair, buildHour, tLabel, familyName), `components/PairView.tsx`, `app/[pair]/page.tsx`, `app/[pair]/[hour]/page.tsx` (`docs/06`).
**Accept:** `/pst-to-est` title "PST to EST Converter – Pacific Time to Eastern Time", answer "EST is 3 hours ahead of PST. 9:00 AM PST = 12:00 PM EST." (in winter); `/est-to-ist` lists 3 difference periods; `/pst-to-est/9am` title starts "9am PST to EST"; all redirects in `docs/11 §11.3` work.

## M7 — Place, multi-zone, zone, DST pages
`content/place.ts`, `PlaceView.tsx`, `app/time/[...place]`, `app/time-zone/[place]`, `app/zones/[abbr]`, `app/time-zones`, `content/dst.ts`, `app/daylight-saving-time` (+ `[country]`).
**Accept:** `/time/uk/london`, `/time/usa/texas` (zones table: Central + Mountain), `/time-zone/texas`, `/zones/est`, `/daylight-saving-time/usa` (2026/2027 dates correct) all render; there are no duplicate H1s between city and state pages.

## M8 — Tools + trust pages
Home, world clock, meeting planner, what-time-zone-am-i-in, military, unix, time calculator, unit converter, time-zone-map (+ `/map/[name]` SVG route, `content/map.ts`), about/contact/privacy/terms.
**Accept:** every tool works per `docs/06`; map pages are < 80 KB HTML and their SVGs < 100 KB.

## M9 — Machine endpoints + middleware
`sitemap.ts` (5 files), `robots.ts`, `llms.txt`, `api/search`, `api/health`, `api/revalidate`, `og`, `manifest.ts`, `public/icon.svg`, `public/ads.txt`, `middleware.ts` (lowercase 301 using the forwarded host; noindex off-production).
**Accept:** the smoke-test table in `docs/11 §11.3` passes.

## M10 — Production build + SEO lint
`next.config.mjs`, `cache-handler.mjs`, `scripts/seo-lint.mjs`.
**Accept:** `SITE_ENV=production npm run build` pre-renders ~2,375 pages; `npm run seo:lint` reports 0 errors; Lighthouse targets met.

## M11 — Chrome extension (`docs/10`)
**Accept:** `npm run ext:build` produces `extension/dist` + a zip; the unpacked extension loads in Chrome; popup, sync and context-menu toast all work.

## M12 — Deploy (`docs/12`)
Dockerfile, railway.json, cron service, Cloudflare rules; deploy staging first, then production; work through the launch checklist.
**Accept:** production health check green, sitemaps submitted, robots allowing crawl, a Cloudflare cache HIT on a second request (`cf-cache-status: HIT`).

## M13 — Post-launch loop (ongoing)
Weekly: GSC queries → keyword-map rows → content tweaks (titles/FAQs) through the CSV. Quarterly: re-pull volumes; extend HOUR_PAIRS from GSC demand; add localisation (es, pt-BR, de, fr, ja) with `hreflang` only once English pages rank.
