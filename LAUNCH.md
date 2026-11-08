# Launch status

Live: **https://timetozone.com** · Repo: https://github.com/product-zeplik/timetozone
Railway project `timetozone` (production) · Cloudflare zone `timetozone.com`

Everything below reflects the state of the deployment, not a plan.

## Done

### Interface
The site was rebuilt around the answer after the first version was, fairly,
called exhausting to read. `npm run audit:visual` drives Playwright over 13
pages x 5 viewports x 2 themes: it went from **320 problems to 0**.

| | before | after |
|---|---|---|
| Pair page, laptop | 4,791px | 4,058px |
| 24-hour table, laptop | 1,187px | 337px |
| /time-zones, phone | 13,945px | 8,635px |
| /time-zone-map, phone | 11,914px | 7,809px |
| Lighthouse accessibility | 96 | **100** |
| CLS on a pair page | 0.062 | **0.001** |

Lighthouse mobile over 10 templates, run against the live domain:
**performance 95-99 (avg 98), accessibility 100, SEO 100**, CLS 0.000-0.009,
LCP 1.6-2.4s — measured immediately after a full cache purge, so every request
missed the edge; the same run locally averages 100. Best practices reads **75 with ads live and 100 without** — the gap
is entirely AdSense's own third-party cookies and console output, so
`audit:lighthouse` detects whether ads are live on the target and grades
against the right bar instead of failing for the wrong reason.

### Accounts — all live
| | account | state |
|---|---|---|
| **Google Analytics 4** | **product@zeplik.com** | Account `TimeToZone` → property `TimeToZone.com` → stream `TimeToZone.com web`, **`G-VQSH78G0GZ`**. Matches the one-account-per-project layout of Arteza, CalcMyWay, Inrick and the rest. **Confirmed receiving live traffic** with per-page titles. |
| **AdSense** | **asad@zeplik.com** | `pub-7026096193684009`, site **verified**, **review requested** ("Getting ready"). `ads.txt` carries the real publisher id. |
| **AdSense consent (EEA/UK/CH)** | asad@zeplik.com | `timetozone EEA consent` **published**, branded with the TZ lockup, privacy policy linked, **"Do not consent" enabled in every country**. |
| **Search Console** | **product@zeplik.com** *and* asadmalik901@gmail.com | Both verified by HTML tag; the layout takes a comma-separated list of tokens so each account owns the property independently. 5 sitemaps + the index submitted. |
| **Bing Webmaster Tools** | asadmalik901 session | Verified. **All 5 sitemaps Success, 0 errors, 12.2K URLs discovered.** |
| **GA4 ↔ Search Console** | product@zeplik.com | **Linked**, as the other projects are, so organic queries and landing pages appear inside GA4. |
| **IndexNow** | — | Key live, URLs submitted. |

Google Search Console shows **Success** on the sitemap index and "Couldn't
fetch" on the five children. That is Google's own lag, not a fault, and
Cloudflare's crawler log says why.

### Who is actually crawling (Cloudflare AI Crawl Control, first 7 days)
| Crawler | Requests | Blocked |
|---|---|---|
| ClaudeBot | **28.2k** | no |
| GPTBot | **11.5k** | no |
| Googlebot | **58** | no |
| BingBot | 8 | no |

Googlebot has made 58 requests in total, so it has simply not reached the
sitemaps yet — the files return 200 with valid XML to a Googlebot user agent
(12,209 URLs across the five), Bing fetched all five and found the same 12.2K,
and the index itself read Success. Nothing is blocked at the edge: **Bot Fight
Mode is off, AI Labyrinth is off, and every crawler's block toggle in AI Crawl
Control is off**, which was worth confirming because Cloudflare blocks AI
crawlers by default on newer zones and that would have silently undone the
AEO/GEO work. The AI crawlers are the ones reading the site today.

AdSense reports `Ads.txt status: Not found`. All three sites in that AdSense
account report the same while they are in review, and `/ads.txt` returns 200
with the right record to Google's own `Mediapartners-Google` agent, so this is
AdSense's crawl lag rather than a fault here.

### One site, one hostname
Railway gives every service a `*.up.railway.app` name, and ours was serving the
whole site: 200, `robots: index, follow`, its own crawlable robots.txt, and
bypassing Cloudflare, so nothing was cached and the origin was exposed. The
canonical tag pointed home, but a canonical is a hint rather than a directive,
and those names are published in certificate transparency logs. That hostname
and the redundant `www` custom domain are both removed from the service, and
middleware now marks any non-canonical host `noindex` so the next generated
name cannot become a second crawlable copy. It sets a header rather than
redirecting: an unexpected forwarded Host would make a host redirect loop and
take the site down, while a header cannot. A smoke check covers both
directions.

### Cloudflare — complete
Cache rule active (`cf-cache-status: HIT` verified), SSL **Full (Strict)**,
Brotli + HTTP/3 + Early Hints on, Rocket Loader off, and **`www` → apex 301
with the query string preserved** (so shared `?t=&d=` links survive).

### Internal linking — a Definition-of-Done failure, now fixed
docs/11 §11.5 requires every URL to have **at least 5 inbound internal links
and sit within 3 clicks of home**. It did not. `npm run audit:links` crawls the
real server and found **412 pages four or five clicks deep and 753 under five
inbound links**.

The cause was one capped list. A zone page is the only page two clicks from
home that can reach a pair, and it linked its top 150 pairs by volume. Only
twelve keys have more than 150 pairs — gmt, utc, mst, sgt, cst, jst, pst, aest,
est, ist, bst, cet — so a pair whose *both* sides were in that set, like
`/sgt-to-bst` or `/gmt-to-bst`, fell outside every cap at once and could only
be found by crawling from another pair.

| | before | after |
|---|---|---|
| Pages more than 3 clicks from home | 412 | **0** |
| Pages under 5 inbound links | 753 | **0** |
| Median inbound links | 15 | **20** |
| Pages reachable by crawling | 8,433 | **11,979** |

`npm run audit:links` now reports **no problems found**.

Zone pages carry every pair that touches them, with the popular ones in plain
sight and the tail behind a disclosure so a 591-link page still reads calmly —
both halves are server-rendered, so crawlers follow either way. The rest of the
gap was pages that only linked downwards: region pages had no sibling links,
small countries were reachable only from the map hub, DST country pages only
from their hub, and the generic zones (ET, CT, MT, PT) were linked by nothing
at all, because their pairs are filed under the alias (`est`, `cst`).

The last cases were cities such as Doha, Lusaka and Antananarivo, in countries
holding only a handful of cities. Two obvious fixes do not work on them:
linking by shared time zone fails because `Asia/Baku` has no other city on it,
and linking *from* sparse cities fails because the shortage is inbound, not
outbound. Each city now links to its **eight nearest by great-circle distance,
excluding its own countrymen — whom its country page already lists — and every
city it names links back**. Closing the relation both ways makes eight inbound
links a floor rather than a hope, and "Nearest cities" is worth having on a
time-zone site anyway.

That 3,546-page jump in what a crawler can reach matters more than usual here:
Cloudflare shows Googlebot has made 58 requests in total, so the sitemaps are
not doing this work yet.

### What ranking first actually requires (Ahrefs, Nov 2026)
Pulled through the Markhor Ahrefs seat. The headline is that **this category is
not authority-gated**:

**`pst to est` — 66K/mo US, 79K global, Keyword Difficulty 4, ~5 referring
domains to rank in the top ten.** The live SERP:

| # | Result | DR | Ref. domains | Words |
|---|---|---|---|---|
| 1 | **AI Overview** | — | — | — |
| 2 | worldtimebuddy.com/pst-to-est-converter | 82 | 31 | 888 |
| 3 | savvytime.com/converter/pst-to-est | 69 | 52 | 1,953 |
| 4 | freeconvert.com/time/pst-to-est | 77 | 7 | 1,039 |
| 5 | **currenttimeutc.com/pst-to-est/** | **5** | **1** | 541 |
| 6 | **watchisup.com/pst-to-est** | 27 | **0** | 760 |

A site with domain rating 5 and a single referring domain ranks fifth; one with
no backlinks at all ranks sixth. Every result is a Tool/Calculator page, and
every title is literally "PST to EST Converter", which is the shape our titles
already take. Our pages carry more than any of them — live clocks, the 24-hour
table, real DST handling, FAQ schema.

So the gates are not page quality and not backlinks in any great number:

1. **Being crawled at all.** Googlebot has made 58 requests (see above). This
   is the binding constraint today and it resolves with time.
2. **A handful of referring domains** — about five. That is a business task,
   not a code change.
3. **The AI Overview holds position one.** Answer-first copy, FAQ schema and
   `llms.txt` are aimed at exactly that, and ClaudeBot and GPTBot are already
   reading the site heavily.

`time difference calculator` (6.8K/mo US) is the other open seam: it is the top
keyword of three pages on the `time difference` SERP, one of which ranks sixth
on five backlinks. `/time-calculator` now carries that tool and the keyword.

### Every keyword re-measured in Ahrefs (2026-11-08)

All 364 rows of `keyword-map.csv` were re-measured against Ahrefs, market by
market. 362 returned data; `time difference between est and pst`,
`est to london time`, `philippine time to pst` and `utc to pht` return none
and were left untouched.

| market | seed claimed | Ahrefs measured |
|---|---|---|
| US | 17,002,030 | 7,313,800 |
| IN | 2,686,700 | 1,041,950 |
| UK | 747,240 | 280,700 |
| AU | 819,120 | 365,010 |
| CA | 827,320 | 229,100 |
| PH | 416,760 | 189,650 |
| **total** | **22,499,170** | **9,420,210** |

The seed data was **2.39x inflated**. Worst single rows: `time zone converter`
1,500,000 -> 77,000, `world clock` 823,000 -> 37,000, `what time is it`
2,740,000 -> 269,000. A few were understated: `military time` 301,000 ->
564,000, `est to ist` (IN) 49,500 -> 122,000. Volume and KD columns are now
Ahrefs figures throughout.

### The KD column was the more important error

The seed KD values bore no relation to reality, and they were hiding the whole
opportunity. Measured difficulty of the conversion pairs:

| band | rows | volume | share |
|---|---|---|---|
| KD 0-10 (trivial) | 217 | 2,084,810 | 22.1% |
| KD 11-20 (easy) | 9 | 198,050 | 2.1% |
| KD 21-40 (moderate) | 31 | 1,448,300 | 15.4% |
| KD 41-70 (hard) | 67 | 3,558,200 | 37.8% |
| KD 71+ (very hard) | 40 | 2,130,850 | 22.6% |

**2,091,000 searches a month sit at KD <= 20, across 92 keywords, and the site
already has a page for every one of them.** The seed file said `pst to est`
was KD 41; it is 4. `cst to est` is 1, `mst to est` is 0, `utc to pst` is 1,
`ist to est` (IN) is 0, `cst to ist` (IN) is 0.

The head terms are the opposite story and should not drive the plan:
`time zone converter` KD 87, `what time is it` KD 89, `world clock` KD 86,
`current time` KD 91, `world time` KD 95. A domain with no backlinks will not
take those, and they are only 22.6% of the demand.

Highest-value winnable rows, all already built:

| volume | KD | market | keyword | page |
|---|---|---|---|---|
| 165,000 | 12 | US | time change 2026 | /daylight-saving-time |
| 122,000 | 5 | IN | est to ist | /est-to-ist |
| 92,000 | 7 | US | time in israel | /time/israel |
| 82,000 | 9 | US | time in arizona | /time/usa/arizona |
| 66,000 | 4 | US | pst to est | /pst-to-est |
| 64,000 | 1 | US | cst to est | /cst-to-est |
| 64,000 | 3 | US | utc to est | /utc-to-est |
| 56,000 | 2 | IN | utc to ist | /utc-to-ist |
| 48,000 | 0 | IN | cst to ist | /cst-to-ist |
| 46,000 | 9 | US | time in nigeria | /time/nigeria |
| 45,000 | 0 | IN | ist to est | /ist-to-est |
| 43,000 | 1 | IN | cet to ist | /cet-to-ist |
| 43,000 | 8 | US | mountain time | /zones/mt |
| 42,000 | 8 | US | time in pakistan | /time/pakistan |

### What the traffic target can actually be

Every row measured in Ahrefs, then expanded: **487 rows summing to 11,225,610
searches a month across 249 target URLs**.

The honest split is by difficulty, not by total:

- **Winnable now (KD <= 20): 4,088,260 searches/month, 349 rows, 36% of the
  demand — and every one of those pages is already built.** At positions 1-3,
  with an AI Overview above some of them, that is roughly **1.2M-1.8M clicks a
  month**. This is the whole near-term plan.
- **Reachable with some authority (KD 21-40).**
- **Needs real backlinks (KD 41+)** — roughly half the remaining demand, not
  available to a domain with no link profile whatever the on-page work.

The unmapped long tail (7,695 pair pages, 2,859 cities, 960 hour pages) adds
to this rather than multiplying it.

**20-30M users per page is not reachable on this keyword set**, and neither is
20-40M site-wide: the entire measured market across six countries is about
11M searches a month, and no site takes all of it. The earlier estimate in
this file said otherwise because it was computed from seed volumes that were
2.39x too high.

The levers that raise the ceiling, in order:
1. **Win the KD <= 20 set.** 4.09M searches, pages already built, no backlinks
   required.
2. **Keep mining at KD <= 20.** The "time in X" family alone returns 46,581
   keywords under that threshold; 123 have been mapped so far. 249 URLs are
   mapped out of 11,979 indexable, so this seam is barely opened.
3. **More markets.** The map is heavily US. Germany, Brazil, Indonesia,
   Mexico, Nigeria and Japan are unmapped and the pages already exist.
4. **Backlinks**, without which the KD 41+ half of the demand stays shut.

### AdSense requirements are checked, not remembered
`npm run check:adsense` asserts the eighteen requirements that can be verified
from outside the console — the ads.txt record down to Google's certification
id, the tag in raw HTML rather than the hydrated DOM, 200s for
Mediapartners-Google and AdsBot-Google, robots.txt not disallowing them, the
four trust pages with real word counts, and the required disclosures in the
privacy policy. All eighteen pass. Approval status, the EEA consent message
and policy-centre notices are not visible from outside and stay manual.

**The account is shared.** `pub-7026096193684009` also carries optipix.art and
calcmyway.com, both of which have been "Getting ready" since 17 and 30 October.
AdSense reviews the publisher, not only the site, so a policy problem on either
of those holds up timetozone too.

### Build and content
- 2,375 pages pre-rendered; 7,695 indexable pair URLs; ISR (24 h) for everything else.
- `npm test` — 125 checks green (engine vectors, 870-pair matrix against `toLocaleString`
  at both sides of every 2027 transition, indexing gate, content builders, extension parser).
- `npm run seo:lint` — **0 errors** over 2,374 rendered pages (4 warnings, all deliberate: see below).
- `npm run smoke` — **162 checks green against https://timetozone.com**.
- `npm run audit:links` — **no problems found** (11,979 indexable pages crawled).
- `npm run audit:visual` — **no problems found** (130 page/viewport/theme combinations).
- Chrome extension builds: `popup.js` 17.0 KB, `background.js` 16.4 KB, zip 19.8 KB.

### Infrastructure
| Piece | State |
|---|---|
| Railway `web` | 2 replicas, us-east4, Dockerfile build (runs tests + SEO lint), health check `/api/health` |
| Railway `Redis` | provisioned; `REDIS_URL` wired to `web`, shared ISR cache active |
| Railway `cron-dst-watch` | own minimal Dockerfile, `5 0 * * *` UTC, `restartPolicy NEVER` |
| Custom domain | `timetozone.com` attached and serving (apex, proxied through Cloudflare) |
| Cloudflare cache rule | "Cache HTML at the edge (respect origin TTL)" — **active**, verified `cf-cache-status: HIT` |
| Cloudflare SSL | **Full (Strict)** |
| HTTP → HTTPS | 301, verified |
| Brotli / HTTP/3 / Early Hints | on (`content-encoding: br`, `alt-svc: h3`) |
| Rocket Loader | off (it breaks hydration) |
| IndexNow | key live at `/d286856505fee59961afcd64645ddf1d.txt`; 16 URLs submitted (202) |

A pair page is 63.7 KB of HTML and **10 KB over the wire** after Brotli; about
three quarters of the raw figure is React's RSC payload.

### Secrets already set on Railway
`SITE_URL`, `SITE_ENV=production`, `PORT=3000`, `REDIS_URL`, `REVALIDATE_SECRET`, `INDEXNOW_KEY`.

## Remaining

### 1. Wait for the AdSense review
The site is verified and in the queue; Google usually answers within a few days
to two weeks. Nothing else is needed — the publisher id is already live, so ads
begin serving on approval with no deploy.

Leave Auto ads **off** for the first 30 days, then A/B test "anchor + vignette
only". Slots are already reserved in the layout (3 on pair pages, 2 on hour and
place pages, 1 on zone and tool pages), at fixed heights so CLS stays 0, and
**never above the answer line**.

### 2. Chrome Web Store (needs your account)
`npm run ext:build` produces `extension/timetozone-extension-1.0.0.zip`. Load
`extension/dist` unpacked once to check the popup, `chrome.storage.sync` and the
right-click toast, then publish — it needs the one-time developer registration
fee, which is why I stopped here. Afterwards set
`NEXT_PUBLIC_CHROME_STORE_URL` on Railway: that switches on the site-wide
extension CTA and adds the listing to the Organization `sameAs`.

### 3. GA4 ↔ AdSense link (needs asad@zeplik.com)
The other product links are done, but this one cannot be made from
product@zeplik.com: the only publisher it administers is
`pub-2221739998993912`, not the site's `pub-7026096193684009`. Linking the one
on offer would have wired GA4 to the wrong AdSense account, so I left it
unlinked. To finish it, open GA4 → Admin → Product links → Google AdSense
links while signed in as **asad@zeplik.com**, or add that address as an
administrator on the TimeToZone GA4 property first. It only adds revenue
figures to GA4 reporting — no tracking depends on it.

### 4. Tidy-ups, none urgent
- A stray GA4 property `TimeToZone` (`G-Q1PZTJFKG1`) is left on
  **asadmalik901@gmail.com** from the first attempt. Nothing points at it;
  delete it when convenient so it cannot be confused with the live property.
- The Search Console property on asadmalik901 now duplicates the
  product@zeplik.com one. Harmless — both are genuine verified owners.
- `www.timetozone.com` is still attached as a custom domain on the Railway
  `web` service. Cloudflare answers that hostname at the edge and 301s it, so
  Railway never sees the traffic; it is an unused fallback.

## How the analytics are wired
`gtag('config')` only sends a page_view on the **initial document load**. On a
site built of cross-linked conversion pages that is almost nothing: a visitor
going `/pst-to-est` → `/est-to-pst` → `/pst-to-est/9am` counted as one view.

- Automatic page_view is off (`send_page_view: false`); a client island sends
  one per route change, with the real path and document title.
- Enhanced Measurement's **"page changes based on browser history events" is
  deliberately off** in the stream settings, or every SPA navigation would be
  counted twice.
- Interaction events are instrumented: `convert`, `swap`, `add_zone`, `copy`,
  `share`, `ics`.
- Both the gtag and AdSense tags are **plain async scripts rendered by the
  server layout**, not `next/script`. With `strategy="afterInteractive"` Next
  emits only a `<link rel="preload">` and injects the real tag on the client —
  invisible to the AdSense and Search Console crawlers, which is exactly why
  both verifications failed on the first attempt.

## Deviations from the spec, and why

1. **`zonedToUtc` does not use the spec's `min(g1, g2)`.** That formula resolves a spring-forward
   gap *backwards* (02:30 → 01:30, not 03:30) and returns the *second* occurrence for a
   Europe/London fall-back. The implementation validates offset candidates instead, which
   satisfies both stated rules across every 2027 transition in six zones. Tests cover it.
2. **`indexedPairs()` is 7,695, not the ~4–5K the spec estimated.** Same inputs, same rules
   (docs/05 §5.3) — the arithmetic simply lands higher. Pre-rendered page count is unchanged
   at 2,375; the extra pairs are ISR and each has genuinely distinct computed content.
3. **Indiana is multi-zone.** docs/03's expected list omits it, but docs/05 explicitly lists
   Indiana among states spanning several zones, and it factually does
   (`America/Indiana/Indianapolis` + `America/Indiana/Knox`). Went with reality and docs/05.
4. **HOUR_PAIR parent pages are ~62 KB, over the 60 KB budget**, because docs/05 requires all 24
   hour links on them. Non-hour pair pages are 58 KB. Over the wire both are ~10 KB after Brotli.
5. **Brand vs docs/09 tokens.** The brand kit is monochrome and dated after docs/09, so the
   accent is near-black/white rather than `#1f6feb`, and the radius is the brand's 12 px rather
   than 14 px. The functional `--biz` / `--night` row tints from docs/09 are kept because they
   carry meaning, but every tinted row also carries a text marker ("WORK HOURS", "NIGHT"), so
   nothing is communicated by colour alone — satisfying the brand's accessibility rule and
   docs/06's table spec at once. Fonts stay on the system stack: docs/09 budgets zero web fonts
   and the brand brief defers to it on exactly this point.
6. **`abbrFor` does not resolve by continent + offset.** docs/04 §4.2 picks a
   curated zone on the same continent with the same offset. Asked about an
   arbitrary country that returns whichever of the 62 curated zones sits on
   that offset, which labelled Libya "SAST", Fiji "NZST", Kazakhstan "PKT" and
   Bolivia "AST". It matches the platform's own CLDR name instead, which keeps
   every example the spec gives and falls back to the plain offset otherwise.
7. **Sitemap `lastmod` is the build date, not the render time.** docs/08 §8.3
   says build/revalidate time, which was `new Date()` at render; with
   `revalidate = 86400` that told Google all 7,695 pair URLs had changed
   seconds ago, every day, on one identical timestamp. Google ignores a
   lastmod it finds consistently inaccurate. It is now the data build date to
   the day, which is both stable and true.
8. **The daylight-savings cluster sits on the hub, and the titles carry both
   spellings.** This entry used to say the four SEO-lint warnings were
   unavoidable, because "a 60-character title cannot carry both PT and PST".
   That was wrong on both counts, and the measurements say why it mattered:
   - `1pm PST to EST – 1:00 PM PT is 4:00 PM ET | TimeToZone` is 54 characters
     and carries both. The hour titles now restate the conversion in the
     generic form (PT/ET), which is accurate because the two move together.
     `/pt-to-est/1pm` 308s here, so the page has to name the form a third of
     its searchers type.
   - "Daylight savings" is not a misspelling to avoid: measured in Ahrefs on
     2026-11-08, the colloquial cluster is 1.74M US searches a month
     (`daylight savings 2026` 688K, `daylight savings` 422K, `when is daylight
     savings` 244K, `daylight savings time` 179K, `time change 2026` 165K)
     against 209K for the formal spelling. The titles now use "Savings" and
     the H1s keep "Saving"; seo-lint matches on substrings, so one page
     satisfies both.
   - Ahrefs gives `daylight saving time` and `daylight savings` the same
     parent topic, and every US-named variant is tiny (`daylight savings usa`
     700, `daylight saving time usa` 500, `when do clocks change usa` 30).
     There is no separate US SERP to win, so docs/07 rule 2 applies and the
     generic cluster consolidated onto `/daylight-saving-time`, which until
     now had no mapped keyword at all. `/daylight-saving-time/usa` keeps the
     country-named variants and `when do clocks change`.
   SEO lint is now 0 errors and 0 warnings.
9. **robots.txt repeats the disallow list in every per-agent group.** A
   robots.txt group is not inherited: a crawler obeys the single most specific
   group that names it. `User-Agent: GPTBot` + `Allow: /` therefore told
   exactly the AI crawlers we most want on the site that `/api/` and the
   `?t=` / `?d=` / `?z=` state parameters were fair game, while the `*` group
   blocked them for everyone else.
10. **Two content defects the templates had been printing.** The DST country
   description read "back on 5 April 2026 in 2026", because the date already
   carried the year; and for southern-hemisphere countries it paired the two
   changes inside one calendar year, printing "forward on 4 October 2026 and
   back on 5 April 2026" — back before forward. The clocks that go forward in
   October go back the following April, and it now says so. The H1 also said
   "in United States" rather than "in the United States".

## Routine operations

```bash
npm run build && npm run seo:lint     # must be 0 errors before any deploy
npm run smoke -- https://timetozone.com
npm run audit:visual                  # 13 pages x 5 viewports x 2 themes
npm run audit:links                   # orphans, depth, inbound link counts
npm run audit:lighthouse              # perf/a11y/best-practices/SEO + CLS
npm run purge                         # after a deploy: Cloudflare caches for 24 h
npm run indexnow                      # ping Bing/Yandex with changed URLs
npm run dst:watch -- --force          # force a revalidate + purge cycle
```

**Always `npm run purge` after a deploy.** Cloudflare respects the origin's
24-hour `s-maxage`, so without a purge it keeps serving the previous build —
it served a stale 404 for 25 minutes during setup before this was noticed.

Monthly, per docs/07: export GSC queries, add any query with ≥100 impressions to
`src/data/keyword-map.csv` mapped to an **existing** URL, and re-run the build.
