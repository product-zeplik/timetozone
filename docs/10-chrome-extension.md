# 10 — Chrome extension (Manifest V3)

## Files
```
extension/
  manifest.json   popup.html   icons/icon{16,32,48,128}.png
  src/popup.ts    src/background.ts   build.mjs (esbuild → extension/dist, then zip)
```
The extension bundles `src/engine/tz.ts`, `src/engine/side.ts` and `src/data/zones.ts` directly (no network calls, works offline). Reference bundle: popup.js ≈ 15 KB, background.js ≈ 15 KB.

## manifest.json
`manifest_version 3`, name "Time Zone Converter – TimeToZone", short_name "TimeToZone", action popup `popup.html`, background `service_worker: background.js` (type module), **permissions `storage`, `contextMenus`, `activeTab`, `scripting`**, `minimum_chrome_version "116"`, PNG icons (Chrome requires PNG, not SVG).

## Popup (340px wide, light/dark)
- Header "TimeToZone" with a 12h/24h toggle.
- Slider −12 h … +12 h in 15-minute steps ("Now" / "+3h 15m from now").
- Pinned rows: label, `abbrFor` + UTC offset + weekday, big time, × remove. Defaults: My time (detected), Eastern (ET), UTC, India (IST).
- Add box with a `<datalist>` of the 62 curated zones plus every `Intl.supportedValuesOf("timeZone")` city. Max 8 pins.
- Footer: Reset to now · "Open full converter ↗" → `https://timetozone.com/?utm_source=chrome-extension&utm_medium=popup`.
- State in `chrome.storage.sync` (`pins`, `h12`), so it syncs across the user's Chrome profiles. The popup re-renders every second.

## Context menu
On install, create `{ id: "ttz-convert", title: "Convert “%s” to my time", contexts: ["selection"] }`.
On click: parse the selection with `/(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)\s*\(?\s*([A-Za-z]{2,5})\b/`. Resolve the code through the curated zones (ET/CT/MT/PT → est/cst/mst/pst). Convert today's date in that zone to the user's local zone. Inject a toast with `chrome.scripting.executeScript`, fixed bottom-right, removed after 6 s: "3pm EST = 12:00 PM PST (your time, Tue)". If parsing fails: "Couldn't read a time and zone. Try selecting something like '3pm EST'."

## Web Store listing (SEO)
Title "Time Zone Converter – TimeToZone"; short description leads with "time zone converter, world clock"; 5 screenshots (popup light/dark, context-menu toast, slider, many zones); category Productivity; privacy disclosure "no data collected". Ask for a review after the 10th popup open (store a counter in storage). Add the listing URL to `NEXT_PUBLIC_CHROME_STORE_URL` (site CTA + Organization `sameAs`).

## Tests
Unit-test `parseSelection` with "3pm EST", "15:30 CET", "9:00 a.m. PT", "10 am IST", "noon"→null, "lunch"→null. Load the unpacked `extension/dist` in Chrome and verify the popup, sync and context menu manually before each release.
