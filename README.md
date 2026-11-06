# TimeToZone

**Time, translated.** The fastest, most correct time zone converter on the web.

A conversion-first time zone utility: Next.js 15 (App Router) + React 19, deployed on Railway behind
Cloudflare, with a Manifest V3 Chrome extension that reuses the same engine. Every offset, abbreviation,
daylight-saving date and conversion is computed at render time from the IANA tz database — nothing is
hard-coded.

Built to the specification in [`CLAUDE.md`](./CLAUDE.md) and [`docs/01`–`docs/15`](./docs).

## What it covers

| Page type | Example | Count |
|---|---|---|
| Zone ↔ zone / place ↔ place conversions | `/pst-to-est`, `/india-time-to-est`, `/london-time-to-new-york-time` | 7,695 indexable |
| Specific hour | `/pst-to-est/9am` | 960 (40 pairs × 24) |
| Place clock | `/time/india`, `/time/uk/london`, `/time/usa/texas` | 247 countries · 253 regions · 2,859 cities |
| Multi-zone place | `/time-zone/texas`, `/time-zone/usa` | 49 |
| Zone page | `/zones/est` | 62 |
| Daylight saving time | `/daylight-saving-time`, `/daylight-saving-time/usa` | 1 + 68 |
| Tools | `/`, `/world-clock`, `/meeting-planner`, `/what-time-zone-am-i-in`, `/time-zone-map`, `/time-zones`, `/military-time-converter`, `/unix-timestamp-converter`, `/time-calculator`, `/time-unit-converter` | 11 |

**2,375 pages are pre-rendered at build time**; every other valid combination is generated on first
request and cached (ISR, 24 h). Combinations outside the indexing gate render with `noindex, follow`
and stay out of the sitemaps. Unknown slugs return a real 404.

## Commands

```bash
npm run data        # generate src/data/generated/*.json from countries-and-timezones + city-timezones
npm run dev         # data + next dev
npm run build       # data + next build   (set SITE_ENV=production for real metadata)
npm test            # vitest: engine, indexing gate, content builders, extension parser
npm run seo:lint    # lint the rendered HTML in .next/server/app  (exits 1 on errors)
npm run smoke       # smoke-test a running server (statuses, redirects, headers, sizes)
npm run ext:build   # esbuild -> extension/dist + a zip for the Web Store
npm run typecheck   # tsc --noEmit
```

## Local development

```bash
cp .env.example .env
npm install
npm run dev          # http://localhost:3000
```

Leave `NEXT_PUBLIC_ADSENSE_CLIENT` and `NEXT_PUBLIC_GA_ID` empty in development: no ad or analytics code
is emitted at all when they are unset.

## Verifying a production build

```bash
SITE_ENV=production SITE_URL=https://timetozone.com npm run build
npm run seo:lint

cp -r public .next/standalone/ && mkdir -p .next/standalone/.next && cp -r .next/static .next/standalone/.next/
(cd .next/standalone && SITE_ENV=production PORT=3010 node server.js &)
SITE_ENV=production npm run smoke -- http://127.0.0.1:3010
```

## Architecture

```
src/
  engine/        PURE time maths on Intl — runs on the server, in the client island and in the extension
    tz.ts        offsets, wall time, zonedToUtc, transitions, formatting, free-text parsing
    side.ts      Side type, abbrFor, the same-region rule
    pair.ts      convertAt, table24, diffPeriods, dstInfo, workOverlap
    entities.ts  SERVER ONLY — registry, parsePair, aliases, search index
  seo/           gate.ts (what Google may index)  meta.ts (metadata + JSON-LD builders)
  content/       pair.ts  place.ts  dst.ts  map.ts  labels.ts  nav.ts   (text + data per page type)
  components/    server views + the four client islands (Converter, ZoneSearch, LiveClock, AdSlot)
  app/           App Router routes, sitemaps, robots, llms.txt, api/*, og
extension/       Manifest V3: popup world clock + a right-click converter
scripts/         build-data · seo-lint · smoke · dst-watch · indexnow
```

**Import boundary:** client code imports only `engine/tz.ts`, `engine/side.ts`, `engine/pair.ts` and
`data/zones.ts`. It must never import `engine/entities.ts`, which pulls in ~800 KB of generated JSON.

**Hard rule:** cached HTML may contain facts that change only at DST transitions (offsets, tables, DST
dates). It must never contain the current clock time — live clocks render `--:--` on the server and fill
in after mount.

## Deployment

Railway (Docker) + Cloudflare, per [`docs/12`](./docs/12-deploy-railway-cloudflare.md):

- **web** — this repo, `Dockerfile`, 2 replicas, health check `/api/health`
- **redis** — Railway Redis plugin; set `REDIS_URL` on web to share the ISR cache between replicas
- **cron** — same repo, `cron/railway.json`, `node scripts/dst-watch.mjs` daily at 00:05 UTC

Environment variables are documented in [`.env.example`](./.env.example). `NEXT_PUBLIC_*` values are
inlined at build time, so redeploy after changing them.

## Tests

`npm test` runs 125 checks: every DST vector in `docs/04 §4.4`, a matrix test comparing `convertAt`
against `Date#toLocaleString` for all 870 ordered pairs of the 30 top zones at both sides of every 2027
transition, the indexing gate, every content builder, and the extension's selection parser.

## Licence

Site code and copy © TimeToZone. Time zone data from the
[IANA time zone database](https://www.iana.org/time-zones) (public domain).
