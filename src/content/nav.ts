/**
 * Site-wide navigation link sets. Server only (reads the gate).
 */
import { pairFromKeys, PLACES, COUNTRY_BY_SLUG } from "@/engine/entities";
import { isIndexedPair, rankedPairs } from "@/seo/gate";
import { pairLabelFromSides } from "./labels";

export const TOOL_LINKS = [
  { href: "/", label: "Time zone converter" },
  { href: "/world-clock", label: "World clock" },
  { href: "/meeting-planner", label: "Meeting planner" },
  { href: "/what-time-zone-am-i-in", label: "What time zone am I in?" },
  { href: "/time-zone-map", label: "Time zone map" },
  { href: "/time-zones", label: "Time zones and abbreviations" },
  { href: "/military-time-converter", label: "Military time converter" },
  { href: "/unix-timestamp-converter", label: "Unix timestamp converter" },
  { href: "/time-calculator", label: "Time calculator" },
  { href: "/time-unit-converter", label: "Time unit converter" },
  { href: "/daylight-saving-time", label: "Daylight saving time" },
];

/** Human label for a canonical pair slug. */
export function pairLabel(slug: string): string {
  const at = slug.indexOf("-to-");
  const p = pairFromKeys(slug.slice(0, at), slug.slice(at + 4));
  return p ? pairLabelFromSides(p.from, p.to) : slug;
}

export function pairLinks(slugs: string[]) {
  return slugs.map((s) => ({ href: `/${s}`, label: pairLabel(s) }));
}

/** The highest-volume indexed pairs, for the home page and footer. */
export function topPairLinks(limit: number) {
  return pairLinks(rankedPairs().slice(0, limit));
}

export const FOOTER_PAIRS = topPairLinks(6);

const FOOTER_PLACE_SLUGS: [string, string][] = [
  ["/time/india", "Time in India"],
  ["/time/uk/london", "Time in London"],
  ["/time/usa/new-york", "Time in New York"],
  ["/time/usa/los-angeles", "Time in Los Angeles"],
  ["/time/japan/tokyo", "Time in Tokyo"],
];
export const FOOTER_PLACES = FOOTER_PLACE_SLUGS.map(([href, label]) => ({ href, label }));

/** 40 city clock links for the home page. */
export function cityClockLinks(limit = 40) {
  const out: { href: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const p of PLACES) {
    if (out.length >= limit) break;
    const key = `${p.countrySlug}/${p.slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ href: `/time/${key}`, label: `Time in ${p.name}` });
  }
  return out;
}

/** Hour-page links for the home page. */
export function hourLinks(slugs: string[], hours: number[]) {
  const out: { href: string; label: string }[] = [];
  for (const slug of slugs) {
    if (!isIndexedPair(slug)) continue;
    for (const h of hours) {
      const label = `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;
      out.push({ href: `/${slug}/${label}`, label: `${label} ${pairLabel(slug)}` });
    }
  }
  return out;
}

export { COUNTRY_BY_SLUG };
