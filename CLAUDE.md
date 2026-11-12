# CLAUDE.md — TimeToZone.com

You are building **timetozone.com**: the fastest, most correct time zone converter on the web, monetised with AdSense, deployed on **Railway** with **Next.js 15 (App Router)** behind **Cloudflare**, plus a **Chrome extension** (MV3) and, later, a mobile app that reuses the same engine.

This file is the entry point. Read it fully, then read the docs in order. **Every requirement lives in `docs/`. Do not invent scope; do not skip scope.**

## Read in this order

| # | File | What it decides |
|---|------|-----------------|
| 1 | `docs/01-product-scope.md` | What we build, what we never build |
| 2 | `docs/02-architecture.md` | Stack, repo layout, rendering/caching, Railway + Cloudflare |
| 3 | `docs/03-data-model.md` | Zones, countries, regions, cities, entity slugs, aliases |
| 4 | `docs/04-engine-spec.md` | Time math: offsets, DST, conversions, every edge case + test vectors |
| 5 | `docs/05-urls-indexing-redirects.md` | Every URL pattern, which pages are indexed/pre-built, all redirects |
| 6 | `docs/06-page-specs.md` | Each page type: modules, exact title/meta/H1/answer templates, FAQ, schema, links |
| 7 | `docs/07-keyword-map.md` | How `data/keyword-map.csv` drives pages; anti-cannibalisation rules |
| 8 | `docs/08-seo-geo-aeo.md` | Metadata, JSON-LD, sitemaps, robots, llms.txt, AI-answer optimisation |
| 9 | `docs/09-ui-performance-ads.md` | Design system, Core Web Vitals budgets, AdSense + consent |
| 10 | `docs/10-chrome-extension.md` | Extension spec |
| 11 | `docs/11-qa-tests-acceptance.md` | Unit tests, SEO lint, e2e, Definition of Done |
| 12 | `docs/12-deploy-railway-cloudflare.md` | Dockerfile, railway.json, env vars, cron, Cloudflare rules, launch checklist |
| 13 | `docs/13-build-plan.md` | **Ordered milestones with acceptance criteria. Work through them in order.** |
| 14 | `docs/14-pitfalls.md` | Bugs already found in a reference build. Read before writing code. |

Seed data in `data/`:
- `data/zones.ts`: the 62 curated time zone abbreviations (copy to `src/data/zones.ts`, keep as-is).
- `data/keyword-map.csv`: 351 researched keyword × market rows, each mapped to exactly one URL (source of truth for titles and the SEO lint).
- `data/pairs-tier1.json`: the 90 pair pages with measured demand and every keyword each one owns.

## Non-negotiable rules

1. **Correctness first.** All time math goes through the engine (`src/engine/`), which uses the platform `Intl` API (IANA tzdata). Never hard-code offsets, DST dates or "EST = UTC−5" in page text; compute them.
2. **One keyword → one URL.** `keyword-map.csv` is the contract. Never create a second page that targets a keyword already mapped elsewhere. Synonym slugs **redirect** (308/301) to the canonical slug.
3. **Answer first.** On every page, the first text after the H1 is a server-rendered answer sentence that contains the numbers (for example "EST is 3 hours ahead of PST. 9:00 AM PST = 12:00 PM EST."). Never bake the *current clock time* into cached HTML; live clocks render on the client after mount.
4. **Conversion-only product.** No weather, holidays, news, calendars, horoscopes or blog fluff. Only time conversion and time tools (see scope).
5. **Speed is a feature.** Meet the budgets in `docs/09`. React Server Components everywhere except the small client islands listed there.
6. **No soft-404s.** Unknown slugs return a real 404. Non-indexed but valid combinations render with `noindex, follow` and stay out of sitemaps.
7. **Never ship a page that fails the SEO lint or the engine tests** (`docs/11`). CI blocks the deploy.
8. **Don't call a milestone done until its acceptance criteria in `docs/13` pass**, including running the production build and checking real HTML output.

## Commands (create these in package.json)

```
npm run data        # node scripts/build-data.mjs  -> src/data/generated/*.json
npm run dev         # data + next dev
npm run build       # data + next build  (SITE_ENV=production for real metadata)
npm test            # vitest (engine + content)
npm run seo:lint    # node scripts/seo-lint.mjs  (run after build; exits 1 on errors)
npm run ext:build   # esbuild -> extension/dist (+ zip)
npm run typecheck   # tsc --noEmit
```

## Definition of Done (whole project)

- `npm run build` succeeds and pre-renders ≈ 2,350+ pages (zone-pair matrix, measured pairs, 960 hour pages, top places, zones, DST pages, tools).
- `npm test` passes, including all DST test vectors in `docs/04`.
- `npm run seo:lint` reports **0 errors** (no duplicate title, H1 or meta among indexable pages; self-canonicals; valid JSON-LD; primary keywords present).
- Smoke checks in `docs/11` pass against the production server (`node .next/standalone/server.js`): statuses, redirects, sizes, no hydration errors.
- Deployed to Railway staging with `SITE_ENV=staging` (noindex), then production per the launch checklist in `docs/12`.

## SEO rules for this repo (do not remove)
- When you add, rename or remove a user-facing page or tool, update seo/manifest.json in the same commit.
- Use @zeplik/seo-kit for every page head, JSON-LD, tool page shell, CTA and ad slot. Never hand-write meta tags or schema.
- Server-render all explanatory text. The interactive tool may run client-side.
- Never change an existing URL. If it is unavoidable, add a 301 in the redirects config and say so in the commit message.
- Never add noindex, robots.txt changes, canonical overrides or new ad slots unless the task says so explicitly.
- Never write blog, guide or marketing copy in this repo. Copy lives in the content hub.
- Run `npx seo-check` before every commit and fix every error.

How this block sits with the rest of this file (engine integration, 12 Nov 2026):
- Existing heads (`src/seo/meta.ts` `pageMeta`) and the existing JSON-LD graph are grandfathered: they pass seo-check and `npm run seo:lint`, and moving them onto seo-kit is a template change that ships behind a per-site flag on a canary (manual 11.2 rule 7). New schema comes from `@zeplik/seo-kit/jsonld` (see `src/seo/page-jsonld.ts`).
- Where docs/ and the engine rulebook disagree, the rulebook wins for NEW markup: no FAQPage or HowTo on new pages, dates from `seo/content-dates.json` (git), never "today". Existing FAQPage markup stays (Google says it causes no harm) and is listed in `seo/seo-check.allow.json` `legacySchema`.
- `npx seo-check` here means: `npm run build`, serve the standalone build, then `npx seo-check crawl --base http://127.0.0.1:3000 --origin https://timetozone.com --ad-site --manifest seo/manifest.json --max-pages 20000` (what `.github/workflows/seo-check.yml` runs). Also run `npm run content-dates` before committing content, and keep `npm run seo:lint` at 0 errors.
