/**
 * Shared label helpers. docs/06 notation.
 */
import { ZONES, ZONE_BY_SLUG } from "@/data/zones";
import type { Side } from "@/engine/side";

/** Abbreviations that mean only one thing inside the curated set. */
const ABBR_COUNT = new Map<string, number>();
for (const z of ZONES) ABBR_COUNT.set(z.abbr, (ABBR_COUNT.get(z.abbr) ?? 0) + 1);

/** Title label: zone -> abbreviation, except `-time` slugs which spell it out. */
export function tLabel(side: Side): string {
  if (side.kind === "zone") {
    const z = side.zoneSlug ? ZONE_BY_SLUG.get(side.zoneSlug) : undefined;
    if (!z) return side.label;
    if (z.slug.endsWith("-time")) {
      const spelled = z.name.replace(" Standard", "");
      // "Philippine Time (PHT)" also answers "est to pht"; skipped for CST and
      // BST, where the code means two different zones (docs/03 §3.1).
      return ABBR_COUNT.get(z.abbr) === 1 ? `${spelled} (${z.abbr})` : spelled;
    }
    return z.abbr;
  }
  return `${side.label} Time`;
}

/** Family name: the seasonal-neutral name. `Pacific Time`, `India Time`, `UTC`. */
export function familyName(side: Side): string {
  if (side.kind === "zone") {
    const z = side.zoneSlug ? ZONE_BY_SLUG.get(side.zoneSlug) : undefined;
    if (!z) return side.label;
    if (z.iana.startsWith("Etc/")) return z.abbr;
    return z.name.replace(/\s(Standard|Daylight|Summer)\s/g, " ").trim();
  }
  return `${side.label} time`;
}

/** Where this side is used, as prose. */
export function regionText(side: Side): string {
  if (side.kind === "zone") {
    const z = side.zoneSlug ? ZONE_BY_SLUG.get(side.zoneSlug) : undefined;
    return z ? z.region : side.long;
  }
  return side.long;
}

export function zoneNote(side: Side): string | undefined {
  if (side.kind !== "zone" || !side.zoneSlug) return undefined;
  return ZONE_BY_SLUG.get(side.zoneSlug)?.note;
}

/** The short pair label used in link lists: `PST to EST`. */
export function pairLabelFromSides(from: Side, to: Side): string {
  return `${tLabel(from)} to ${tLabel(to)}`;
}
