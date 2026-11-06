# 08 — Technical SEO, GEO and AEO

## 8.1 Metadata helper (`src/seo/meta.ts`)
`pageMeta({ title, description, path, index?, ogTitle? })` returns a Next `Metadata` object:
- `title: { absolute }`. The layout template is `"%s"`, so titles are never double-branded.
- `description` clipped to ≤ 155 characters at a word boundary, ending in "…".
- `alternates.canonical = SITE.url + path`.
- `robots`: indexable → `index, follow, max-snippet:-1, max-image-preview:large`; else `noindex, follow`.
- `openGraph` (website, url, title, description, siteName, image `SITE.url/og?t=…` 1200×630) and `twitter: summary_large_image`.
Layout: `metadataBase`, `icons: /icon.svg`, `formatDetection.telephone=false`, a `google-adsense-account` meta when configured, viewport `themeColor` for light/dark.

## 8.2 JSON-LD (one `<script type="application/ld+json">` per node group; escape `<` as `<`)
- Layout: `Organization` (`@id /#org`, logo, `sameAs` Chrome Web Store when known) + `WebSite` (`@id /#website`).
- `BreadcrumbList` on every page except home.
- `WebApplication` on pair, hour and tool pages (`applicationCategory: UtilitiesApplication`, `operatingSystem: Any`, `offers.price 0`, publisher → org).
- `FAQPage` with **exactly** the visible Q&As.
- `City`/`Place` on place pages (geo, `containedInPlace`, `additionalProperty` timeZone).
- `WebPage` with `dateModified` (today's date at render time) on pair, hour, place and zone pages.
- Don't use `HowTo` (rich result retired), and don't add `aggregateRating` until real reviews exist.

## 8.3 Sitemaps (`app/sitemap.ts` with `generateSitemaps`)
Five files, each ≤ 50K URLs: `/sitemap/0.xml` tools + zones + DST + multi-zone · `/sitemap/1.xml` indexed pairs · `/sitemap/2.xml` hour pages · `/sitemap/3.xml` countries + regions · `/sitemap/4.xml` cities. `lastModified` = build/revalidate time; changefreq daily; priority home 1.0, tools 0.8, pairs 0.8, zones/countries 0.7, the rest 0.5–0.6. Submit all five in GSC and Bing Webmaster Tools.

## 8.4 robots.txt (`app/robots.ts`)
Production: `User-agent: *` Allow `/`, Disallow `/api/`, `/*?t=`, `/*?d=`, `/*?z=`. Explicit Allow for GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, Claude-SearchBot, Google-Extended, Applebot-Extended and Bingbot. List the five sitemaps and the host. Non-production: `Disallow: /`.

## 8.5 llms.txt (`app/llms.txt/route.ts`, force-static)
A Markdown summary: what the site is; the URL patterns with examples; the tool list; the top 60 conversions; all 62 zone pages. This gives LLM crawlers a map of the site.

## 8.6 AEO/GEO content rules (how AI answers quote us)
1. **The answer sentence comes first**, in plain HTML, ≤ 25 words, with the numbers: "EST is 3 hours ahead of PST. 9:00 AM PST = 12:00 PM EST."
2. **Definitions ≤ 50 words** on zone pages ("Eastern Standard Time (EST) is UTC−5…").
3. **Entity clarity**: IANA id, UTC offset and official name visible on zone and place pages.
4. **Freshness**: a visible "Updated {date}" and `dateModified`; daily revalidation; correct DST dates for this year and next.
5. **Disambiguation notes** on ambiguous abbreviations (CST, IST, BST, AST, PST).
6. Tables use real `<table>`/`<th scope>` markup (AI engines and featured snippets parse them).
7. FAQ answers ≤ 40 words, leading with the fact.
8. After launch, track citations with Semrush AI Visibility (competitors: WTB 1.4K cited pages, timeanddate 44.3K).

## 8.7 Search Console / Bing / IndexNow (launch)
- Verify the domain property (DNS TXT) in GSC and Bing Webmaster Tools, then submit the 5 sitemaps.
- Add IndexNow: generate a key, serve `/{key}.txt`, and POST changed URLs after deploys and DST revalidations (Bing/Yandex; feeds ChatGPT search through Bing).
- In GSC, monitor Coverage, Core Web Vitals, Enhancements (Breadcrumbs, FAQ), and Performance queries → feed new keywords into the CSV (`docs/07`).

## 8.8 Content quality guardrails (for 6K+ programmatic pages)
- Every paragraph comes from page-specific computed facts (offsets, dates, overlaps, regions). Pages never differ only by a swapped noun in identical text.
- No page is indexable unless it passes the gate. Thin combinations are noindex.
- Unknown slugs return a real 404, never a soft one.
- The SEO lint blocks duplicate titles, H1s and descriptions (`docs/11`).
