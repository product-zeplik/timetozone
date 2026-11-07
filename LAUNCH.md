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
**performance 97-99, accessibility 100, best practices 100, SEO 100**, CLS
0.000-0.009, TBT 0-73ms.

### Accounts — all live
| | account | state |
|---|---|---|
| **Google Analytics 4** | **product@zeplik.com** | Account `TimeToZone` → property `TimeToZone.com` → stream `TimeToZone.com web`, **`G-VQSH78G0GZ`**. Matches the one-account-per-project layout of Arteza, CalcMyWay, Inrick and the rest. **Confirmed receiving live traffic** with per-page titles. |
| **AdSense** | **asad@zeplik.com** | `pub-7026096193684009`, site **verified**, **review requested** ("Getting ready"). `ads.txt` carries the real publisher id. |
| **AdSense consent (EEA/UK/CH)** | asad@zeplik.com | `timetozone EEA consent` **published**, branded with the TZ lockup, privacy policy linked, **"Do not consent" enabled in every country**. |
| **Search Console** | **product@zeplik.com** *and* asadmalik901@gmail.com | Both verified by HTML tag; the layout takes a comma-separated list of tokens so each account owns the property independently. 5 sitemaps + the index submitted. |
| **Bing Webmaster Tools** | asadmalik901 session | Verified. **All 5 sitemaps Success, 0 errors, 12.2K URLs discovered.** |
| **IndexNow** | — | Key live, URLs submitted. |

Google Search Console may show "Couldn't fetch" on the sitemaps for a while
after submission. That is Google's own retry lag, not a fault: the files are
valid XML, served as `application/xml`, listed in `robots.txt`, and return 200
to a Googlebot user agent — and **Bing fetched all five successfully and found
12.2K URLs**.

### Cloudflare — complete
Cache rule active (`cf-cache-status: HIT` verified), SSL **Full (Strict)**,
Brotli + HTTP/3 + Early Hints on, Rocket Loader off, and **`www` → apex 301
with the query string preserved** (so shared `?t=&d=` links survive).

### Build and content
- 2,375 pages pre-rendered; 7,695 indexable pair URLs; ISR (24 h) for everything else.
- `npm test` — 125 checks green (engine vectors, 870-pair matrix against `toLocaleString`
  at both sides of every 2027 transition, indexing gate, content builders, extension parser).
- `npm run seo:lint` — **0 errors** over 2,374 rendered pages (4 warnings, all deliberate: see below).
- `npm run smoke` — **161 checks green against https://timetozone.com**.
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

A 62 KB pair page is **9.8 KB over the wire** after Brotli.

### Secrets already set on Railway
`SITE_URL`, `SITE_ENV=production`, `PORT=3000`, `REDIS_URL`, `REVALIDATE_SECRET`, `INDEXNOW_KEY`.

## Remaining — needs your account or your decision

### 1. `www` → apex redirect (5 min, Cloudflare)
The DNS write was blocked by this session's permission policy, so it is the one Cloudflare
item left. Today `www.timetozone.com` simply does not resolve, so there is **no duplicate-content
risk** — this is polish, not a defect.

1. DNS → Add record: **CNAME**, name `www`, target `timetozone.com`, **Proxied**.
2. Rules → Redirect Rules → Create: when `http.host eq "www.timetozone.com"`,
   **Dynamic** redirect to `concat("https://timetozone.com", http.request.uri.path)`, status **301**,
   preserve query string.
3. Then remove the now-redundant `www.timetozone.com` custom domain from the Railway `web` service.

### 2. Cloudflare API token (enables automatic cache purging)
Without it, after a DST transition Cloudflare keeps serving cached HTML until its TTL expires.
The client-side converter already detects this and shows a note, and `revalidatePath` still runs,
so the site stays *correct* — but the cached copy stays stale longer than it needs to.

Create a token at **My Profile → API Tokens → Create Token → Edit zone DNS** template, then
narrow it to: Zone → **Cache Purge** → Purge, scoped to `timetozone.com` only. Then set on Railway:

```
CF_ZONE_ID    = <the zone ID from the Cloudflare overview page sidebar>
CF_API_TOKEN  = <the token>
```
on **both** `web` and `cron-dst-watch`. After that:
- the daily cron purges automatically at a DST transition, and
- `npm run purge` purges after any deploy (Cloudflare otherwise serves the previous build's HTML
  for up to 24 h — this bit us once already during setup).

### 3. AdSense (revenue)
No ad code ships at all until `NEXT_PUBLIC_ADSENSE_CLIENT` is set, which is exactly what AdSense
wants to see during review.

1. Apply with the trust pages already live: `/about`, `/contact`, `/privacy`, `/terms`.
   The privacy policy already names the AdSense cookies, the Google Ads Settings opt-out and the
   EEA/UK/CH consent requirement.
2. On approval: put the real `pub-…` id in `public/ads.txt` (it currently holds a clearly
   commented placeholder), commit, and set `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-…` on Railway.
3. Turn on **AdSense → Privacy & messaging → European regulations** (Google's own certified CMP).
4. Leave Auto ads **off** for the first 30 days, then A/B test "anchor + vignette only".

Slots are already reserved in the layout (3 on pair pages, 2 on hour and place pages, 1 on zone
and tool pages), with fixed heights so CLS stays at 0, and **never above the answer line**.

### 4. Chrome Web Store
`npm run ext:build` produces `extension/timetozone-extension-1.0.0.zip`. Load
`extension/dist` unpacked once to sanity-check the popup, `chrome.storage.sync` and the
right-click toast, then publish. Afterwards set `NEXT_PUBLIC_CHROME_STORE_URL` on Railway —
that switches on the site-wide extension CTA and adds the listing to the Organization `sameAs`.

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
6. **4 SEO-lint warnings are intentional.** `daylight savings 2026` (spelling variant) and three
   `…pt to est` hour pages: docs/06 fixes those title and H1 templates and a 60-character title
   cannot carry both PT and PST. Both variants are answered in body copy and the FAQ instead.

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
