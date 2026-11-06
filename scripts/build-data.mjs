#!/usr/bin/env node
/**
 * Generates src/data/generated/{countries,regions,places,keywords,meta}.json
 * from countries-and-timezones + city-timezones + src/data/keyword-map.csv.
 *
 * Runs before every `next build`. See docs/03-data-model.md.
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ct from "countries-and-timezones";
import cityTimezones from "city-timezones";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "src", "data", "generated");
mkdirSync(OUT, { recursive: true });

const YEAR = new Date().getUTCFullYear();

/* ------------------------------------------------------------------ utils */

export function slugify(s) {
  return String(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[''`]/g, "")
    .replace(/&/g, "and")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Validate a zone by actually constructing a formatter.
 *  Intl.supportedValuesOf("timeZone") returns ICU legacy names
 *  (Asia/Calcutta, Europe/Kiev) and would silently drop India. docs/14 #1 */
const validCache = new Map();
function zoneIsValid(tz) {
  if (validCache.has(tz)) return validCache.get(tz);
  let ok = false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(0);
    ok = true;
  } catch {
    ok = false;
  }
  validCache.set(tz, ok);
  return ok;
}

/** Resolve a deprecated/alias IANA id to its modern name. */
function modernZone(tz) {
  const meta = ct.getTimezone(tz);
  const name = meta && meta.aliasOf ? meta.aliasOf : tz;
  return zoneIsValid(name) ? name : zoneIsValid(tz) ? tz : null;
}

const offCache = new Map();
function offsetMinutes(tz, ms) {
  const key = tz + "|" + ms;
  const hit = offCache.get(key);
  if (hit !== undefined) return hit;
  const s = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
    .formatToParts(ms)
    .find((p) => p.type === "timeZoneName").value;
  let v = 0;
  if (s !== "GMT") {
    const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(s);
    if (m) {
      const sign = m[1] === "-" ? -1 : 1;
      v = sign * (Number(m[2]) * 60 + Number(m[3] || 0));
    }
  }
  offCache.set(key, v);
  return v;
}

const JAN = Date.UTC(YEAR, 0, 15, 12);
const JUL = Date.UTC(YEAR, 6, 15, 12);
/** (January offset, July offset) signature; identifies a distinct clock. */
function signature(tz) {
  return offsetMinutes(tz, JAN) + ":" + offsetMinutes(tz, JUL);
}

/* ------------------------------------------------------------- city source */

/** every city in the dataset, zones normalised to modern IANA ids */
const ALL_CITIES = cityTimezones.cityMapping
  .filter((c) => c && c.iso2 && c.timezone)
  .map((c) => ({ ...c, timezone: modernZone(c.timezone) }))
  .filter((c) => c.timezone)
  .sort((a, b) => (b.pop || 0) - (a.pop || 0));

/** the cities that get their own page: population >= 100,000 */
const RAW_CITIES = ALL_CITIES.filter((c) => c.pop >= 100000);

/** city population summed per (iso2, tz) — used to pick a country's primary zone */
const popByCountryZone = new Map();
for (const c of ALL_CITIES) {
  const k = c.iso2 + "|" + c.timezone;
  popByCountryZone.set(k, (popByCountryZone.get(k) || 0) + (c.pop || 0));
}

/* ---------------------------------------------------------------- countries */

const NAME_OVERRIDE = {
  US: "United States",
  GB: "United Kingdom",
  CD: "DR Congo",
  TR: "Turkey",
  CZ: "Czech Republic",
};
const SLUG_OVERRIDE = {
  US: "usa",
  GB: "uk",
  AE: "uae",
  KR: "south-korea",
  KP: "north-korea",
  CD: "dr-congo",
  CG: "congo",
  TR: "turkey",
};
/** Short names used in titles and pair labels (docs/14 #9). */
const SHORT_NAME = { US: "USA", GB: "UK", AE: "UAE" };

const PRIMARY_OVERRIDE = {
  US: "America/New_York",
  CA: "America/Toronto",
  AU: "Australia/Sydney",
  RU: "Europe/Moscow",
  BR: "America/Sao_Paulo",
  MX: "America/Mexico_City",
  ID: "Asia/Jakarta",
  CN: "Asia/Shanghai",
  KZ: "Asia/Almaty",
  CL: "America/Santiago",
  AR: "America/Argentina/Buenos_Aires",
  ES: "Europe/Madrid",
  PT: "Europe/Lisbon",
  NZ: "Pacific/Auckland",
  EC: "America/Guayaquil",
  MN: "Asia/Ulaanbaatar",
  UA: "Europe/Kyiv",
  DE: "Europe/Berlin",
  MY: "Asia/Kuala_Lumpur",
  UZ: "Asia/Tashkent",
};
/** Treated as single-zone regardless of the zone list (docs/03). */
const FORCE_SINGLE = new Set(["CN", "AR", "DE", "MY", "UZ"]);

const RANKED = `IN US GB JP AU PH CA CN KR DE NG AE SG PK FR NZ IT ES MX BR KE IL TR TH ID ZA EG SA NL IE VN MY BD HK TW RU UA PL SE CH GH PT GR AR CO PE CL NP LK QA KW`.split(
  " "
);

const countries = [];
for (const raw of Object.values(ct.getAllCountries())) {
  const zones = [...new Set((raw.timezones || []).map(modernZone).filter(Boolean))];
  if (!zones.length) continue; // HM: Heard Island, no zones

  const iso2 = raw.id;
  const name = NAME_OVERRIDE[iso2] || raw.name;
  const slug = SLUG_OVERRIDE[iso2] || slugify(name);

  let primary = PRIMARY_OVERRIDE[iso2];
  if (!primary || !zones.includes(primary)) {
    primary = [...zones].sort(
      (a, b) =>
        (popByCountryZone.get(iso2 + "|" + b) || 0) - (popByCountryZone.get(iso2 + "|" + a) || 0) ||
        a.localeCompare(b)
    )[0];
  }

  const sigs = new Set(zones.map(signature));
  const multiZone = FORCE_SINGLE.has(iso2) ? false : sigs.size > 1;

  // zones ordered by city population, primary first
  const ordered = [...zones].sort(
    (a, b) =>
      (popByCountryZone.get(iso2 + "|" + b) || 0) - (popByCountryZone.get(iso2 + "|" + a) || 0) ||
      a.localeCompare(b)
  );
  const zonesOut = [primary, ...ordered.filter((z) => z !== primary)];

  const rank = RANKED.indexOf(iso2) === -1 ? 999 : RANKED.indexOf(iso2) + 1;

  countries.push({
    iso2,
    name,
    short: SHORT_NAME[iso2] || name,
    slug,
    zones: zonesOut,
    primary,
    multiZone,
    rank,
  });
}
countries.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
const countryBySlug = new Map(countries.map((c) => [c.slug, c]));
const countryByIso = new Map(countries.map((c) => [c.iso2, c]));

/* ------------------------------------------------------------------- cities */

/** Cities whose slug equals their country slug are covered by the country page. */
const cityRows = [];
const slugCountInCountry = new Map();
for (const c of RAW_CITIES) {
  const country = countryByIso.get(c.iso2);
  if (!country) continue;
  const base = slugify(c.city_ascii || c.city);
  if (!base) continue;
  if (base === country.slug) continue; // Singapore, Kuwait, Hong Kong...
  const k = c.iso2 + "|" + base;
  slugCountInCountry.set(k, (slugCountInCountry.get(k) || 0) + 1);
  cityRows.push({ raw: c, country, base });
}

const usedCitySlugInCountry = new Set();
const usedEntity = new Set();
const places = [];

for (const { raw, country, base } of cityRows) {
  // within-country duplicate -> suffix the province slug
  let slug = base;
  const dupKey = country.iso2 + "|" + base;
  if (slugCountInCountry.get(dupKey) > 1) {
    if (usedCitySlugInCountry.has(dupKey)) {
      const prov = slugify(raw.province || raw.state_ansi || "");
      slug = prov ? `${base}-${prov}` : base;
      let n = 2;
      while (usedCitySlugInCountry.has(country.iso2 + "|" + slug)) slug = `${base}-${prov}-${n++}`;
    }
  }
  usedCitySlugInCountry.add(country.iso2 + "|" + slug);

  // globally unique entity for pair URLs; the biggest city keeps the plain slug
  let entity = slug;
  if (usedEntity.has(entity)) entity = `${slug}-${country.slug}`;
  let n = 2;
  while (usedEntity.has(entity)) entity = `${slug}-${country.slug}-${n++}`;
  usedEntity.add(entity);

  places.push({
    name: raw.city_ascii || raw.city,
    slug,
    entity,
    iso2: country.iso2,
    countrySlug: country.slug,
    countryName: country.name,
    countryShort: country.short,
    region: raw.province || "",
    regionSlug: raw.province ? slugify(raw.province) : "",
    tz: raw.timezone,
    pop: raw.pop,
    lat: Math.round(raw.lat * 1e4) / 1e4,
    lng: Math.round(raw.lng * 1e4) / 1e4,
  });
}

/* ------------------------------------------------------------------ regions */

const REGION_COUNTRIES = ["US", "CA", "AU", "BR", "MX", "RU", "ID"];
/** Zone splits that city data misses (docs/03). */
const EXTRA_ZONES = {
  "US|Florida": ["America/Chicago"],
  "US|Tennessee": ["America/New_York", "America/Chicago"],
  "US|Kentucky": ["America/Chicago"],
  "US|Michigan": ["America/Chicago"],
  "US|Oregon": ["America/Boise"],
  "US|Idaho": ["America/Los_Angeles"],
  "US|Nebraska": ["America/Denver"],
  "US|Kansas": ["America/Denver"],
  "US|North Dakota": ["America/Denver"],
  "US|South Dakota": ["America/Denver"],
  "US|Alaska": ["America/Adak"],
  "US|Arizona": ["America/Denver"],
};

const regionAgg = new Map(); // "US|Texas" -> { iso2, name, zones: Map<tz, pop> }
for (const c of ALL_CITIES) {
  if (!REGION_COUNTRIES.includes(c.iso2) || !c.province) continue;
  const key = c.iso2 + "|" + c.province;
  let agg = regionAgg.get(key);
  if (!agg) regionAgg.set(key, (agg = { iso2: c.iso2, name: c.province, zones: new Map() }));
  agg.zones.set(c.timezone, (agg.zones.get(c.timezone) || 0) + (c.pop || 0));
}
for (const [key, extra] of Object.entries(EXTRA_ZONES)) {
  const agg = regionAgg.get(key);
  if (!agg) continue;
  for (const tz of extra) if (!agg.zones.has(tz)) agg.zones.set(tz, 0);
}

const regions = [];
for (const agg of regionAgg.values()) {
  const country = countryByIso.get(agg.iso2);
  if (!country) continue;
  const base = slugify(agg.name);
  if (!base) continue;

  // clash with a city slug in the same country -> "-state" + " State" (docs/14 #7)
  const clash = usedCitySlugInCountry.has(country.iso2 + "|" + base);
  const slug = clash ? `${base}-state` : base;
  const name = clash ? `${agg.name} State` : agg.name;

  let entity = slug;
  if (usedEntity.has(entity)) entity = `${slug}-${country.slug}`;
  let n = 2;
  while (usedEntity.has(entity)) entity = `${slug}-${country.slug}-${n++}`;
  usedEntity.add(entity);

  const zones = [...agg.zones.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map((e) => e[0]);
  const sigs = new Set(zones.map(signature));

  regions.push({
    iso2: country.iso2,
    countrySlug: country.slug,
    countryName: country.name,
    countryShort: country.short,
    name,
    rawName: agg.name,
    slug,
    entity,
    zones,
    primary: zones[0],
    multiZone: sigs.size > 1,
  });
}
regions.sort((a, b) => a.countrySlug.localeCompare(b.countrySlug) || a.name.localeCompare(b.name));

/* ----------------------------------------------------------------- keywords */

const csv = readFileSync(join(ROOT, "src", "data", "keyword-map.csv"), "utf8").replace(/\r/g, ""); // docs/14 #2
const lines = csv.split("\n").filter((l) => l.trim());
const header = lines.shift().split(",");
const idx = (n) => header.indexOf(n);
const keywords = lines.map((line) => {
  // no quoted commas in this file, but be safe
  const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").trim());
  const rawSlot = cells[idx("slot")] || "";
  return {
    keyword: cells[idx("keyword")],
    market: cells[idx("market")],
    volume: Number(cells[idx("volume")]) || 0,
    kd: cells[idx("kd")] === "" ? null : Number(cells[idx("kd")]),
    url: cells[idx("target_url")],
    slot: rawSlot,
    slotBase: rawSlot.split(/[\s(]/)[0].toLowerCase(),
  };
});

/* --------------------------------------------------------------------- write */

const meta = {
  builtAt: new Date().toISOString(),
  tzdata: process.versions.tz || "unknown",
  node: process.version,
  year: YEAR,
};

const write = (name, data) => {
  writeFileSync(join(OUT, name), JSON.stringify(data));
  return (JSON.stringify(data).length / 1024).toFixed(0);
};

const sizes = {
  countries: write("countries.json", countries),
  regions: write("regions.json", regions),
  places: write("places.json", places),
  keywords: write("keywords.json", keywords),
  meta: write("meta.json", meta),
};

const multiUS = regions
  .filter((r) => r.iso2 === "US" && r.multiZone)
  .map((r) => {
    const c = cityTimezones.cityMapping.find((x) => x.iso2 === "US" && x.province === r.rawName && x.state_ansi);
    return c ? c.state_ansi : r.slug;
  })
  .sort();

console.log(
  `${countries.length} countries, ${regions.length} regions, ${places.length} cities, ${keywords.length} keywords, tzdata ${meta.tzdata}`
);
console.log(`multi-zone US states: ${multiUS.join(" ")}`);
console.log(
  `sizes(KB): countries ${sizes.countries}, regions ${sizes.regions}, places ${sizes.places}, keywords ${sizes.keywords}`
);
