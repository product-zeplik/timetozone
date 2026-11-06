# 14 — Pitfalls already found (read before coding)

These came up while building and testing a reference implementation of this spec on Node 22.23 / Next 15.5.28. Each one cost real debugging time.

1. **ICU legacy zone names drop India.** `Intl.supportedValuesOf("timeZone")` returns `Asia/Calcutta`, `Europe/Kiev`, … Checking zones against that set removed Asia/Kolkata and silently deleted India (and others) from the data. Validate by constructing `Intl.DateTimeFormat` in a try/catch, and keep modern names.
2. **CRLF in keyword-map.csv.** The last column (`slot`) came through as `undefined` until `\r` was stripped. Always `.replace(/\r/g, "")` before splitting.
3. **DST "slivers".** ET and PT both switch at 2 AM *local*, so for 3 hours the PST→EST difference is 2 or 4 hours. Without merging periods shorter than 2 days, every same-rule pair looks as if it "varies", and the copy says "right now" when it shouldn't.
4. **Never render the current time on the server.** Cached HTML would show a stale time and cause hydration mismatches. Render `--:--`, fill it in on mount, and mark time nodes `suppressHydrationWarning`.
5. **Inline SVG maps double in size.** React serialises server-component output into the RSC payload as well as the HTML (330–540 KB pages). Serve the SVG from a route handler and embed it with `<object>`.
6. **Redirects leaked the internal host.** `NextResponse.redirect(req.nextUrl.clone())` behind Railway produced `http://localhost:3000/...`. Build the URL from `x-forwarded-proto` + `x-forwarded-host`.
7. **City/region name collisions** (New York city vs New York state, Washington, Quebec) gave duplicate H1s and descriptions. Suffix the region slug with `-state` and its display name with " State".
8. **Hour titles must use the searched form.** People search "9am pst to est" (33.1K), not "9 AM". Titles use `9am`; the H1 can use "9 AM".
9. **Country display names** from datasets ("United States of America", "United Kingdom") don't match search wording ("usa time", "uk time"). Use short names (USA/UK/UAE) in titles and pair labels, and make `us-time` the canonical US slug.
10. **Same-key pairs** (`/est-to-est`) and same-zone pairs (`/india-time-to-ist`) must be a 404 and noindex respectively. Otherwise you get infinite near-duplicates.
11. **Stale dev servers.** When re-testing, kill any `next-server` process first. A previous build kept serving on the port (EADDRINUSE in the log) and made fixed bugs look unfixed.
12. **Client bundle hygiene.** Importing `engine/entities.ts` (or anything that imports the generated JSON) from a `'use client'` file pulls ~1 MB into the browser. Keep the boundary in `docs/02`.
13. **Map runtime deps must be `dependencies`** (d3-geo, topojson-*, world-atlas, us-atlas, i18n-iso-countries). The standalone output and Docker install depend on it.
14. **Next 15 params are Promises** in pages, `generateMetadata` and route handlers (`{ params }: { params: Promise<{…}> }`).
15. **Abbreviation fallback for zones without DST.** Matching only by seasonal offsets mapped `America/Panama` to Colombia Time. Prefer the continent-scoped standard-offset match (`docs/04 §4.2`), which gives EST.
