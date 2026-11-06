# 02 — Architecture

## Stack (pin these)
| Piece | Choice | Notes |
|---|---|---|
| Runtime | **Node 22 LTS** | Pin in `engines` and the Dockerfile. Node's ICU ships tzdata (2026e at time of writing); log `process.versions.tz` in `/api/health`. |
| Framework | **Next.js 15.5.x**, App Router, React 19 | Use Next 15, not 16 (16 renames middleware to `proxy.ts`; don't mix). Route `params` are **Promises** (`const { pair } = await params`). |
| Language | TypeScript strict | `resolveJsonModule: true`, path alias `@/* → src/*`. |
| Styling | One `globals.css` with CSS variables (light/dark) | No Tailwind or CSS framework, no web fonts (system stack). |
| Maps | `d3-geo`, `topojson-client`, `topojson-simplify`, `world-atlas@2` (countries-110m), `us-atlas@3` (states-10m), `i18n-iso-countries` (numeric→alpha2) | **Runtime `dependencies`**, not dev. |
| Build-time data | `countries-and-timezones@3`, `city-timezones@1` | devDependencies; only used by `scripts/build-data.mjs`. |
| Cache (multi-replica) | `redis@4` via a custom `cacheHandler` | Enabled only when `REDIS_URL` is set. |
| Tests | `vitest@3` | Engine + content builders. |
| Extension bundler | `esbuild` | Bundles `src/engine` into the extension. |
| Hosting | **Railway** (Docker) + **Cloudflare** CDN in front | Railway has no edge cache, so Cloudflare serves cached HTML. |

## Repository layout
```
timetozone/
├─ CLAUDE.md                     ← this kit's CLAUDE.md
├─ docs/                         ← this kit's docs
├─ Dockerfile  railway.json  .dockerignore  .gitignore  .env.example
├─ next.config.mjs               output:'standalone', poweredByHeader:false, cacheHandler (if REDIS_URL), security headers
├─ cache-handler.mjs             Redis ISR cache (get/set/revalidateTag/resetRequestCache)
├─ cron/railway.json             Railway cron service (daily 00:05 UTC) -> scripts/dst-watch.mjs
├─ scripts/
│  ├─ build-data.mjs             generates src/data/generated/{countries,regions,places,keywords,meta}.json
│  ├─ seo-lint.mjs               lints .next/server/app/**/*.html
│  └─ dst-watch.mjs              revalidate + Cloudflare purge when a zone changes within 48h
├─ public/  icon.svg  ads.txt
├─ extension/  manifest.json popup.html icons/ src/{popup.ts,background.ts} build.mjs
├─ tests/engine.test.ts
└─ src/
   ├─ site.ts                    SITE.{name,url,adsenseClient,gaId,chromeStoreUrl,isProduction}
   ├─ middleware.ts              lowercase 301 (public host), X-Robots-Tag noindex off-production
   ├─ data/
   │  ├─ zones.ts                (from kit /data) curated 62 abbreviations
   │  ├─ keyword-map.csv         (from kit /data)
   │  └─ generated/*.json        (build output, gitignored or committed: your choice; must exist before next build)
   ├─ engine/                    PURE, no DOM, no big JSON: runs on server, client island, extension
   │  ├─ tz.ts                   offsets, wall time, zonedToUtc, transitions, formatting, parsing
   │  ├─ side.ts                 Side type, abbrFor, same-region rule, sideOffset, sideAbbr
   │  ├─ pair.ts                 convertAt, table24, diffPeriods, dstInfo, workOverlap
   │  └─ entities.ts             SERVER ONLY (imports generated JSON): registry, parsePair, aliases, searchIndex
   ├─ seo/  gate.ts (indexing + keywords)  meta.ts (title(), pageMeta(), ld.* JSON-LD builders)
   ├─ content/  pair.ts  place.ts  dst.ts  map.ts   (text + data builders per page type)
   ├─ components/
   │  ├─ Converter.tsx  ZoneSearch.tsx  LiveClock.tsx  AdSlot.tsx        ('use client' islands)
   │  ├─ tools/{WorldClock,MeetingPlanner,SmallTools}.tsx                 ('use client')
   │  └─ Blocks.tsx PairView.tsx PlaceView.tsx ToolPage.tsx Prose.tsx     (server)
   └─ app/
      ├─ layout.tsx  globals.css  page.tsx  not-found.tsx  sitemap.ts  robots.ts  manifest.ts
      ├─ [pair]/page.tsx            A + C
      ├─ [pair]/[hour]/page.tsx     B
      ├─ time/[...place]/page.tsx   D
      ├─ time-zone/[place]/page.tsx E
      ├─ zones/[abbr]/page.tsx      F
      ├─ time-zones/page.tsx
      ├─ daylight-saving-time/page.tsx  daylight-saving-time/[country]/page.tsx
      ├─ time-zone-map/[[...region]]/page.tsx   map/[name]/route.ts (SVG files)
      ├─ world-clock  meeting-planner  what-time-zone-am-i-in  military-time-converter
      ├─ unix-timestamp-converter  time-calculator  time-unit-converter
      ├─ about  contact  privacy  terms
      ├─ llms.txt/route.ts  og/route.tsx  api/{search,health,revalidate}/route.ts
```

## Rendering and caching
| Route | Strategy | `revalidate` | Pre-built at build |
|---|---|---|---|
| `/`, tools, `/time-zones`, trust pages | static | 86400 | all |
| `/[pair]` | SSG + ISR, `dynamicParams = true` | 86400 | measured pairs + full matrix of the 30 `top` zones (~880) |
| `/[pair]/[hour]` | SSG + ISR | 86400 | 40 HOUR_PAIRS × 24 = 960 |
| `/time/[...place]` | SSG + ISR | 86400 | ranked countries + US/CA/AU regions + top 200 cities (~320) |
| `/time-zone/[place]` | SSG, `dynamicParams = false` | 86400 | all multi-zone countries + regions (~49) |
| `/zones/[abbr]` | SSG, `dynamicParams = false` | 86400 | 62 |
| `/daylight-saving-time/[country]` | SSG, `dynamicParams = false` | 86400 | countries with DST (~70) |
| `/map/[name]` | route handler, static | 86400 | `world.svg`, `usa.svg` |
| `/api/search` | `force-static` | 604800 | — |
| `/og` | dynamic, `runtime = "nodejs"`, `next/og` ImageResponse | CDN-cached | — |

Reference build: ~2,375 pages pre-render in ~65 s on a 4-vCPU machine.

**Hard rule:** HTML may contain facts that change only at DST transitions (offsets, worked examples, tables, DST dates). It must **never** contain the current clock time. Client islands render `--:--` on the server and fill in after mount (`useEffect` → `setNow(Date.now())`), with `suppressHydrationWarning` on time nodes.

**DST correctness between revalidations:** each pair page passes `validUntil` (the next transition instant of either side) to the client island. If `Date.now() > validUntil`, the island's live values are authoritative and a small note appears. The cron job (`docs/12`) also revalidates and purges within 24 hours.

## Client islands (the only `'use client'` code)
- `Converter`: sides list, time text input, date input, Now button, 12/24 toggle (localStorage `ttz.h12`), Swap link, 15-minute slider, add/remove zones, "make reference" ↑, + My time zone, Copy, Share link, Add to calendar (.ics), deep links `?t=&d=`. Props: `initial: Side[]`, `reverseHref?`, `lockedMinutes?` (hour pages), `validUntil?`, `allowAdd`, `maxZones=6`, `autoLocal` (home page puts the visitor's zone first).
- `ZoneSearch`: lazily fetches `/api/search` **on focus only** (≈227 KB raw, ≈50 KB gzipped), then scores matches: exact 100, prefix 80, contains 50, sublabel 20, +5 for zones, +3 for countries. Shows the top 8 with keyboard navigation (ARIA combobox).
- `LiveClock`, `AdSlot`, `WorldClock` (saved list in localStorage `ttz.wc`), `MeetingPlanner`, plus small tools (MyZone, Military, Unix, Unit, Calc).

**Import boundary:** client code imports only `engine/tz.ts`, `engine/side.ts`, `engine/pair.ts` and `data/zones.ts`. It must **never** import `engine/entities.ts` (it pulls in ~1 MB of generated JSON).
