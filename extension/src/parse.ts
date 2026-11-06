/**
 * Parse a selected string like "3pm EST" into a time and a zone.
 * Shared by the context menu and the unit tests. docs/10.
 */
import { ZONES } from "../../src/data/zones";
import { parseTimeInput } from "../../src/engine/tz";

export interface Selection {
  minutes: number; // minutes after midnight
  code: string; // the zone code as written, uppercased
  tz: string; // resolved IANA id
  abbr: string; // the curated abbreviation
}

/** Codes that are not time zones and would otherwise match the regex. */
const NOT_A_ZONE = new Set(["AM", "PM", "A", "P", "ET AL", "AT", "ON", "IN", "TO", "BY"]);

/** code -> curated zone slug. Generic names resolve to their standard slug. */
const CODE_TO_SLUG = new Map<string, string>();
for (const z of ZONES) {
  const code = z.abbr.toUpperCase();
  if (!CODE_TO_SLUG.has(code)) CODE_TO_SLUG.set(code, z.slug);
}
// explicit generic -> standard mappings, which win over the loop above
for (const [code, slug] of [
  ["ET", "est"],
  ["CT", "cst"],
  ["MT", "mst"],
  ["PT", "pst"],
  ["EST", "est"],
  ["EDT", "edt"],
  ["CST", "cst"],
  ["CDT", "cdt"],
  ["MST", "mst"],
  ["MDT", "mdt"],
  ["PST", "pst"],
  ["PDT", "pdt"],
  ["GMT", "gmt"],
  ["UTC", "utc"],
  ["BST", "bst"],
  ["CET", "cet"],
  ["CEST", "cest"],
  ["EET", "eet"],
  ["IST", "ist"],
  ["JST", "jst"],
  ["KST", "kst"],
  ["SGT", "sgt"],
  ["HKT", "hkt"],
  ["PHT", "philippine-time"],
  ["AEST", "aest"],
  ["AEDT", "aedt"],
  ["AWST", "awst"],
  ["NZST", "nzst"],
  ["MSK", "msk"],
  ["PKT", "pkt"],
  ["GST", "gst"],
  ["SAST", "sast"],
  ["WAT", "wat"],
  ["EAT", "eat"],
  ["BRT", "brt"],
] as const) {
  CODE_TO_SLUG.set(code, slug);
}

const RE = /(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?)\s*\(?\s*([A-Za-z]{2,5})\b/;

export function parseSelection(input: string): Selection | null {
  if (!input) return null;
  const m = RE.exec(input.replace(/ /g, " ").trim());
  if (!m) return null;

  const minutes = parseTimeInput(m[1].replace(/\./g, "").replace(/\s+/g, ""));
  if (minutes === null) return null;

  const code = m[2].toUpperCase();
  if (NOT_A_ZONE.has(code)) return null;

  const slug = CODE_TO_SLUG.get(code);
  if (!slug) return null;
  const zone = ZONES.find((z) => z.slug === slug);
  if (!zone) return null;

  return { minutes, code, tz: zone.iana, abbr: zone.abbr };
}
