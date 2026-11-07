/**
 * Time zone maps. The SVG is generated in a route handler and embedded with
 * <object>, never inlined into a React page (docs/09 §9.2, docs/14 #5).
 */
import { geoAlbersUsa, geoEqualEarth, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import { presimplify, simplify } from "topojson-simplify";
import countryCodes from "i18n-iso-countries";
import worldTopo from "world-atlas/countries-110m.json";
import usTopo from "us-atlas/states-10m.json";
import { COUNTRIES, COUNTRY_BY_ISO, REGIONS } from "@/engine/entities";
import { abbrFor } from "@/engine/side";
import { fmtOffset, offsetMinutes } from "@/engine/tz";

export type MapName = "world" | "usa";

interface Shape {
  d: string;
  name: string;
  href?: string;
  title: string;
  /** IANA id, so the page can show this shape's live local time on hover. */
  tz?: string;
}

/** Build the SVG document for one map. Pure string output, cacheable. */
export function renderMapSvg(name: MapName, now: number = Date.now()): string {
  return name === "usa" ? usaSvg(now) : worldSvg(now);
}

function svgDocument(width: number, height: number, shapes: Shape[], label: string): string {
  const body = shapes
    .map((s) => {
      // data-* so the parent page can render a readout with a live clock. The
      // <title> stays for the no-JS and <img> fallbacks.
      const data = `data-name="${esc(s.name)}"${s.tz ? ` data-tz="${esc(s.tz)}"` : ""}`;
      const path = `<path d="${s.d}" class="g" ${data}><title>${esc(s.title)}</title></path>`;
      return s.href
        ? `<a href="${esc(s.href)}" target="_top" aria-label="${esc(s.title)}">${path}</a>`
        : path;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(
    label
  )}" preserveAspectRatio="xMidYMid meet">
<style>
svg{background:#fff}
.g{fill:#eceff3;stroke:#c9c9c9;stroke-width:.5;vector-effect:non-scaling-stroke}
a:hover .g,a:focus .g{fill:#080808}
a:focus{outline:2px solid #080808}
@media (prefers-color-scheme:dark){
svg{background:#080808}
.g{fill:#202020;stroke:#3d3d3d}
a:hover .g,a:focus .g{fill:#f7f7f7}
a:focus{outline:2px solid #fff}
}
</style>
${body}
</svg>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * "Kenya — EAT (UTC+3)", or just "Fiji — UTC+12" when the zone has no
 * abbreviation of its own: abbrFor falls back to the offset, and printing it
 * twice reads like a mistake.
 */
function labelFor(name: string, tz: string, now: number): string {
  const offset = fmtOffset(offsetMinutes(tz, now));
  const abbr = abbrFor(tz, now);
  return abbr === offset ? `${name} — ${offset}` : `${name} — ${abbr} (${offset})`;
}

function worldSvg(now: number): string {
  const width = 1000;
  const height = 500;
  const simplified = simplify(presimplify(worldTopo as never), 0.25);
  const fc = feature(simplified as never, (simplified as never as { objects: { countries: unknown } }).objects
    .countries as never) as unknown as GeoJSON.FeatureCollection;

  const projection = geoEqualEarth().fitSize([width, height - 20], fc);
  const path = geoPath(projection).digits(1);

  const shapes: Shape[] = [];
  for (const f of fc.features) {
    const d = path(f as never);
    if (!d) continue;
    const numeric = String((f as { id?: string | number }).id ?? "");
    const iso2 = numeric ? countryCodes.numericToAlpha2(numeric) : undefined;
    const country = iso2 ? COUNTRY_BY_ISO.get(iso2) : undefined;
    const geoName = (f.properties as { name?: string } | null)?.name ?? country?.name ?? "";
    const title = country ? labelFor(country.name, country.primary, now) : geoName;
    shapes.push({
      d,
      name: country?.name ?? geoName,
      href: country ? `/time/${country.slug}` : undefined,
      title,
      tz: country?.primary,
    });
  }
  return svgDocument(width, height, shapes, "World time zone map");
}

function usaSvg(now: number): string {
  const width = 1000;
  const height = 620;
  const simplified = simplify(presimplify(usTopo as never), 0.004);
  const fc = feature(simplified as never, (simplified as never as { objects: { states: unknown } }).objects
    .states as never) as unknown as GeoJSON.FeatureCollection;

  const projection = geoAlbersUsa().fitSize([width, height - 20], fc);
  const path = geoPath(projection).digits(1);

  const shapes: Shape[] = [];
  for (const f of fc.features) {
    const d = path(f as never);
    if (!d) continue;
    const stateName = (f.properties as { name?: string } | null)?.name ?? "";
    const region = REGIONS.find((r) => r.iso2 === "US" && r.rawName === stateName);
    const title = region ? labelFor(region.name, region.primary, now) : stateName;
    shapes.push({
      d,
      name: region?.name ?? stateName,
      href: region ? `/time/usa/${region.slug}` : undefined,
      title,
      tz: region?.primary,
    });
  }
  return svgDocument(width, height, shapes, "US time zone map");
}

/* ------------------------------------------------------- crawlable text list */

export interface OffsetGroup {
  offset: number;
  offsetText: string;
  abbrs: string[];
  items: { href: string; label: string }[];
}

/** Countries grouped by their current UTC offset — the crawlable map alternative. */
export function worldOffsetGroups(now: number = Date.now()): OffsetGroup[] {
  const groups = new Map<number, OffsetGroup>();
  for (const c of COUNTRIES) {
    const off = offsetMinutes(c.primary, now);
    let g = groups.get(off);
    if (!g) groups.set(off, (g = { offset: off, offsetText: fmtOffset(off), abbrs: [], items: [] }));
    const abbr = abbrFor(c.primary, now);
    if (!g.abbrs.includes(abbr)) g.abbrs.push(abbr);
    g.items.push({ href: `/time/${c.slug}`, label: c.name });
  }
  return [...groups.values()].sort((a, b) => a.offset - b.offset).map((g) => ({
    ...g,
    items: g.items.sort((a, b) => a.label.localeCompare(b.label)),
  }));
}

/** US states and territories grouped by their current UTC offset. */
export function usaOffsetGroups(now: number = Date.now()): OffsetGroup[] {
  const groups = new Map<number, OffsetGroup>();
  for (const r of REGIONS.filter((r) => r.iso2 === "US")) {
    const off = offsetMinutes(r.primary, now);
    let g = groups.get(off);
    if (!g) groups.set(off, (g = { offset: off, offsetText: fmtOffset(off), abbrs: [], items: [] }));
    const abbr = abbrFor(r.primary, now);
    if (!g.abbrs.includes(abbr)) g.abbrs.push(abbr);
    g.items.push({ href: `/time/usa/${r.slug}`, label: r.name });
  }
  return [...groups.values()].sort((a, b) => a.offset - b.offset).map((g) => ({
    ...g,
    items: g.items.sort((a, b) => a.label.localeCompare(b.label)),
  }));
}
