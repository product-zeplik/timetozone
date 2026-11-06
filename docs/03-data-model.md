# 03 — Data model

## 3.1 Curated zones (`src/data/zones.ts`, provided in kit `/data`)
```ts
type ZoneKind = "generic" | "std" | "dst" | "fixed";
interface Zone { slug; abbr; name; iana; kind; region; counterpart?; pairAlias?; note?; top? }
```
- `generic` (ET, CT, MT, PT): seasonal name. `pairAlias` sends it to the std slug in pair URLs (`/pt-to-et` → `/pst-to-est`). It still has its own `/zones/pt` page.
- `std` (EST, PST, CET, AEST…): in pair pages it **follows its region's DST** and the label shows the abbreviation in force (EST in winter, EDT in summer).
- `dst` (EDT, PDT, CEST, BST, AEDT…): same as std in pair pages, unless both sides share a region (see the same-region rule in `docs/04`).
- `fixed` (UTC, GMT, IST, JST, SGT, HST…): never changes.
- `top: true` on 30 zones (est, cst, mst, pst, akst, hst, at, utc, gmt, bst, cet, eet, msk, gst, pkt, ist, bangladesh-standard-time, ict, sgt, philippine-time, china-standard-time, jst, kst, awst, aest, nzst, sast, wat, eat, brt). Their full 30×29 matrix is indexed and pre-built.
- Ambiguous abbreviations use the meaning English searchers intend: CST = US Central, IST = India, BST = British Summer Time, AST = Atlantic, PST = Pacific. The other meanings get spelled-out slugs: `china-standard-time`, `bangladesh-standard-time`, `philippine-time`. Each page carries a `note` that clears up the ambiguity.
- Slug rule: when people search a spelled form far more than the code, the slug uses the spelled form (Philippines: "est to philippine time" 12.1K vs "est to pht" 2.4K → `philippine-time`).

## 3.2 Generated data (`scripts/build-data.mjs` → `src/data/generated/`)
Runs before every `next build` (`npm run build` = `npm run data && next build`).

**countries.json** (247): `{ iso2, name, slug, zones[], primary, multiZone, rank }`
- Source: `countries-and-timezones.getAllCountries()`.
- Name/slug overrides: US → "United States"/`usa`; GB → "United Kingdom"/`uk`; AE → `uae`; KR → `south-korea`; KP → `north-korea`; CD → "DR Congo"/`dr-congo`; CG → `congo`; TR → "Turkey"/`turkey`; CZ → "Czech Republic".
- `primary` overrides: US America/New_York, CA America/Toronto, AU Australia/Sydney, RU Europe/Moscow, BR America/Sao_Paulo, MX America/Mexico_City, ID Asia/Jakarta, CN Asia/Shanghai (single zone), KZ Asia/Almaty, CL America/Santiago, AR Buenos_Aires (single), ES Europe/Madrid, PT Europe/Lisbon, NZ Pacific/Auckland, EC America/Guayaquil, MN Asia/Ulaanbaatar, UA Europe/Kyiv, DE/MY/UZ single. Otherwise the zone with the largest summed city population.
- `multiZone` = more than one distinct (January offset, July offset) signature among its zones, unless overridden as single.
- `rank` = position in the top-country list `IN US GB JP AU PH CA CN KR DE NG AE SG PK FR NZ IT ES MX BR KE IL TR TH ID ZA EG SA NL IE VN MY BD HK TW RU UA PL SE CH GH PT GR AR CO PE CL NP LK QA KW` (else 999).

**regions.json** (~253): US, CA, AU, BR, MX, RU, ID provinces from `city-timezones` `province`. `{ iso2, countrySlug, name, slug, entity, zones[] (by population), primary, multiZone }`. Add the known zone splits that city data misses: Florida+Chicago, Tennessee NY+Chicago, Kentucky+Chicago, Michigan+Chicago, Oregon+Boise, Idaho+LA, Nebraska/Kansas/N.Dakota/S.Dakota+Denver, Alaska+Adak, Arizona+Denver (Navajo). Expected multi-zone US states: AK, AZ, FL, ID, KS, KY, MI, NE, ND, OR, SD, TN, TX.

**places.json** (~2,860 cities, pop ≥ 100,000): `{ name (city_ascii), slug, entity, iso2, countrySlug, countryName, region, regionSlug, tz, pop, lat, lng }`, sorted by population.
- Skip a city whose slug equals its country slug (Singapore, Kuwait, Hong Kong): the country page covers it.
- If a slug repeats within the same country, suffix the province slug.
- `entity` (used in pair URLs as `{entity}-time`) must be **globally unique**. The largest city keeps the plain slug; others get `{slug}-{countrySlug}` (e.g. `hyderabad` for India, `hyderabad-pakistan`).
- A region slug that clashes with a city slug in the same country gets `-state` appended, and its display name gets " State": `/time/usa/new-york` is the city, `/time/usa/new-york-state` is the state.

**keywords.json**: parsed from `keyword-map.csv` → `{ keyword, market, volume, kd, url, slot }`. **Strip `\r`** before splitting lines (the CSV has CRLF endings).

**meta.json**: `{ builtAt, tzdata: process.versions.tz, node }`.

### Zone validity (important)
`Intl.supportedValuesOf("timeZone")` returns **ICU legacy names** (`Asia/Calcutta`, `Europe/Kiev`), so a lookup against that list wrongly drops `Asia/Kolkata`, `Europe/Kyiv` and others, which silently removes India. Validate with `try { new Intl.DateTimeFormat("en-US", { timeZone }) }` instead, and keep modern IANA names (resolve `aliasOf` from countries-and-timezones first).

## 3.3 Entities and pair slugs (`src/engine/entities.ts`, server only)
A **Side** is one end of a conversion (plain JSON, passed to the client):
```ts
interface Side { key; kind: "zone"|"country"|"region"|"city"; label; long; tz; fixed?: number|null; zoneSlug?; href? }
```
Registry keys (the strings that appear in pair URLs):
- Zone: `{zone.slug}` → `est`, `philippine-time`
- Country: `{country.slug}-time` → `india-time`, `uk-time` (label uses a short name: GB "UK", US "USA", AE "UAE")
- **US special case:** canonical key `us-time` (label "US"); `usa-time` and `united-states-time` are aliases.
- Region: `{region.entity}-time` → `texas-time`, `new-york-state-time`
- City: `{city.entity}-time` → `london-time`, `new-york-time` (not added if the key already exists)

**PAIR_ALIASES** (input slug → canonical slug, 308 redirect): `pht, philippines-time, ph-time, manila-time → philippine-time`; `pakistan-time → pkt`; `japan-time → jst`; `korea-time, south-korea-time → kst`; `china-time → china-standard-time`; `singapore-time → sgt`; `hong-kong-time → hkt`; `bangladesh-time → bangladesh-standard-time`; `nepal-time → npt`; `usa-time, united-states-time → us-time`; `eastern-time → est`, `central-time → cst`, `pacific-time → pst`, `mountain-time → mst`; `gulf-time, dubai-time, uae-time → gst`; `moscow-time → msk`; plus every zone's `pairAlias` (`et → est`, `ct → cst`, `mt → mst`, `pt → pst`).

**DST-name redirects:** in pair URLs `edt, cdt, mdt, pdt, akdt, adt, ndt, cest, eest, acdt, aedt, nzdt` → their std slug (`/edt-to-pst` → `/est-to-pst`). The exceptions are pairs in **DST_PAIR_KEEP**, which have their own measured demand: `pdt-to-est, edt-to-est, pdt-to-cst, pst-to-pdt, cdt-to-est, est-to-edt, edt-to-cst, cest-to-est, cest-to-ist, bst-to-est, bst-to-pst, bst-to-ist, bst-to-cet, bst-to-utc, bst-to-cst, est-to-bst, edt-to-bst, pst-to-bst, utc-to-bst, est-to-aedt, aedt-to-est, aedt-to-pst, gmt-to-edt, ist-to-edt, ist-to-pdt, pdt-to-ist, edt-to-ist, cdt-to-ist`. Same-region pairs (EDT ↔ EST) never redirect.

**parsePair(slug)**: try every `-to-` split position. Both halves (after aliasing) must exist in the registry. Return `{ from, to, slug, canonical }`. If both sides are the same key, return null (404). Apply the same-region rule (`docs/04`). Because slugs are checked against the registry, cities containing "to" (e.g. "toronto") are safe.

**searchIndex()** → array of `[key, label, sublabel, tz]` for zones ("EST – Eastern Standard Time", "Time zone"), countries ("Country"), regions (country name) and cities ("Region, Country"). Served at `/api/search`.
