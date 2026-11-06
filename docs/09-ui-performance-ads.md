# 09 — UI, performance, ads

## 9.1 Design system (one `globals.css`, no framework)
Tokens on `:root`, overridden under `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }` and `:root[data-theme="dark"]`:
`--bg #fff/#0d1117 · --bg-soft #f5f7fa/#131a23 · --card #fff/#161d27 · --line #e3e8ef/#263140 · --text #0f1720/#e8edf3 · --muted #5b6777/#9aa6b5 · --accent #1f6feb/#5b9cff · --accent-soft · --biz #eaf6ef/#12291e (working-hour rows) · --night · --radius 14px`.
Font: the system stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, …`); `font-variant-numeric: tabular-nums` on all times.
Layout: `.wrap` max-width 980px with 16px side padding, mobile first, and a single column down to 320px. Touch targets ≥ 44px (`.btn`, inputs). A sticky header that's 56px tall.
Components: `.card`, `.conv` (converter), `.zrow` (zone row: name/sub on the left, big time 28px + date on the right), `.tbl` + `.tablewrap` (horizontal scroll), `.faq details`, `.links` (pill links), `.bigclock` (clamp 48–96px), `.ad` (reserved min-height 280px desktop / 250px mobile), `.legend`, `.search` (combobox dropdown).
Must look clean in light and dark, at 320/375/768/1280 widths. Nothing else above the fold except H1, answer and converter.

## 9.2 Performance budgets (p75 mobile, field data)
| Metric | Budget | How |
|---|---|---|
| TTFB | < 200 ms (Cloudflare hit < 50 ms) | static/ISR HTML + CDN cache |
| LCP | < 1.5 s | the LCP element is the H1/answer text; no images above the fold |
| CLS | 0.00 | reserved ad heights; clocks render fixed-width placeholders (`--:--`) |
| INP | < 100 ms | slider/state updates are cheap; no heavy work on input |
| Route JS | ≤ 15 KB per page on top of the framework | Next 15 + React 19 shared baseline is ~103 KB (gzip) and can't be avoided |
| HTML | ≤ 60 KB per pair/place page (reference build: 40–60 KB) | `prefetch={false}` on long link lists |
| Fonts | 0 | system fonts |
Measured in the reference build: pair page HTML ~58 KB, server response 8–20 ms on origin.

**Maps:** never inline the full SVG in a React page. React then embeds the paths twice (HTML + RSC payload), which made pages 330–540 KB. Generate the SVG in a route handler (`/map/world.svg`, `/map/usa.svg`, cached), simplify the topology (`topojson-simplify`: `simplify(presimplify(topo), 0.25)` for world-110m, `0.004` for us-10m), use `geoPath(...).digits(1)`, and embed with `<object type="image/svg+xml" data=…>`, with `target="_top"` on the SVG `<a>` links. Below the map, render a crawlable text list of countries/states grouped by offset. Result: page 40–72 KB, SVG 76–96 KB.

**Search index:** `/api/search` (~227 KB raw) loads only when the search box is focused.

## 9.3 AdSense
- Load `adsbygoogle.js?client=…` via `next/script strategy="afterInteractive"` only when `NEXT_PUBLIC_ADSENSE_CLIENT` is set. Add the `google-adsense-account` meta. `public/ads.txt` must hold the real `pub-` id before requesting ads.
- `AdSlot({slot, lazy})`: renders nothing until AdSense is configured; reserved height; `adsbygoogle.push({})` immediately (slot 1) or when within 400px of the viewport (IntersectionObserver).
- Positions: pair page 3 + mobile anchor (after the converter, after the table, before the FAQ); hour 2; place 2; zone 1; tools 1. **Never above the answer line.** Leave Auto ads off at launch; after 30 days, A/B test "anchor + vignette only".
- **Consent:** Google requires a certified CMP for EEA/UK/CH traffic. Turn on AdSense → Privacy & messaging → European regulations message (Google's own CMP). Ads must wait for consent; the AdSense script handles this when the message is enabled.
- Approval prerequisites: trust pages, original content (our computed copy), no "under construction" sections, working navigation, and a privacy policy that names AdSense cookies.

## 9.4 Analytics
GA4 via `next/script strategy="lazyOnload"` when `NEXT_PUBLIC_GA_ID` is set. Events to add: `convert` (time edited), `swap`, `add_zone`, `copy`, `share`, `ics`, `extension_click`.
