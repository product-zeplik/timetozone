/**
 * Curated time-zone abbreviations used for /zones/{slug} pages and /{a}-to-{b} pair pages.
 * `iana` is the representative IANA zone. `kind`:
 *  - "generic"  : seasonal name (ET, PT) – follows DST
 *  - "std"      : standard-time name (EST, PST) – in pair pages follows the region's DST, labelled correctly
 *  - "dst"      : daylight-time name (EDT, PDT) – same as std in pair pages unless both sides share a region
 *  - "fixed"    : never changes (UTC, GMT, IST, JST...)
 * `pairAlias`: in pair URLs this slug is redirected to another slug (pt-to-et -> pst-to-est).
 */
export type ZoneKind = "generic" | "std" | "dst" | "fixed";
export interface Zone {
  slug: string;
  abbr: string;
  name: string;
  iana: string;
  kind: ZoneKind;
  region: string; // human list of where it is used
  counterpart?: string; // std <-> dst slug
  pairAlias?: string;
  note?: string;
  top?: boolean; // part of the indexed zone x zone matrix
}

export const ZONES: Zone[] = [
  { slug: "et", abbr: "ET", name: "Eastern Time", iana: "America/New_York", kind: "generic", region: "US East Coast (New York, Florida, Georgia, Ohio, Michigan), Ontario and Quebec in Canada", pairAlias: "est", note: "ET is EST (UTC−5) in winter and EDT (UTC−4) in summer." },
  { slug: "est", abbr: "EST", name: "Eastern Standard Time", iana: "America/New_York", kind: "std", counterpart: "edt", region: "New York, Washington DC, Florida, Georgia, Ohio, Michigan, Ontario, Quebec, Panama and Jamaica (all year)", top: true },
  { slug: "edt", abbr: "EDT", name: "Eastern Daylight Time", iana: "America/New_York", kind: "dst", counterpart: "est", region: "US and Canadian Eastern zone during daylight saving time" },
  { slug: "ct", abbr: "CT", name: "Central Time", iana: "America/Chicago", kind: "generic", region: "Texas, Illinois, Minnesota, Louisiana, Tennessee (west), Manitoba, much of Mexico", pairAlias: "cst", note: "CT is CST (UTC−6) in winter and CDT (UTC−5) in summer." },
  { slug: "cst", abbr: "CST", name: "Central Standard Time", iana: "America/Chicago", kind: "std", counterpart: "cdt", region: "Chicago, Dallas, Houston, Minneapolis, New Orleans, Winnipeg; Mexico City and Central America use UTC−6 all year", note: "CST here means North American Central Standard Time, not China Standard Time.", top: true },
  { slug: "cdt", abbr: "CDT", name: "Central Daylight Time", iana: "America/Chicago", kind: "dst", counterpart: "cst", region: "US and Canadian Central zone during daylight saving time" },
  { slug: "mt", abbr: "MT", name: "Mountain Time", iana: "America/Denver", kind: "generic", region: "Colorado, Utah, New Mexico, Montana, Wyoming, Alberta; Arizona stays on MST all year", pairAlias: "mst" },
  { slug: "mst", abbr: "MST", name: "Mountain Standard Time", iana: "America/Denver", kind: "std", counterpart: "mdt", region: "Denver, Salt Lake City, Albuquerque, Calgary, Edmonton; Phoenix (Arizona) all year", note: "Most of Arizona uses MST all year and does not switch to MDT.", top: true },
  { slug: "mdt", abbr: "MDT", name: "Mountain Daylight Time", iana: "America/Denver", kind: "dst", counterpart: "mst", region: "US and Canadian Mountain zone during daylight saving time (not Arizona)" },
  { slug: "pt", abbr: "PT", name: "Pacific Time", iana: "America/Los_Angeles", kind: "generic", region: "California, Washington, Oregon, Nevada, British Columbia", pairAlias: "pst" },
  { slug: "pst", abbr: "PST", name: "Pacific Standard Time", iana: "America/Los_Angeles", kind: "std", counterpart: "pdt", region: "Los Angeles, San Francisco, Seattle, Las Vegas, Portland, Vancouver", note: "PST here means Pacific Standard Time, not Philippine Standard Time.", top: true },
  { slug: "pdt", abbr: "PDT", name: "Pacific Daylight Time", iana: "America/Los_Angeles", kind: "dst", counterpart: "pst", region: "US and Canadian Pacific zone during daylight saving time" },
  { slug: "akst", abbr: "AKST", name: "Alaska Standard Time", iana: "America/Anchorage", kind: "std", counterpart: "akdt", region: "Most of Alaska (Anchorage, Fairbanks, Juneau)", top: true },
  { slug: "akdt", abbr: "AKDT", name: "Alaska Daylight Time", iana: "America/Anchorage", kind: "dst", counterpart: "akst", region: "Alaska during daylight saving time" },
  { slug: "hst", abbr: "HST", name: "Hawaii-Aleutian Standard Time", iana: "Pacific/Honolulu", kind: "fixed", region: "Hawaii (all year, no daylight saving time)", top: true },
  { slug: "at", abbr: "AST", name: "Atlantic Standard Time", iana: "America/Halifax", kind: "std", counterpart: "adt", region: "Nova Scotia, New Brunswick, PEI; Puerto Rico and the Eastern Caribbean (all year)", note: "AST here is Atlantic Standard Time, not Arabia Standard Time.", top: true },
  { slug: "adt", abbr: "ADT", name: "Atlantic Daylight Time", iana: "America/Halifax", kind: "dst", counterpart: "at", region: "Atlantic Canada during daylight saving time" },
  { slug: "nst", abbr: "NST", name: "Newfoundland Standard Time", iana: "America/St_Johns", kind: "std", counterpart: "ndt", region: "Newfoundland and southeastern Labrador (UTC−3:30)" },
  { slug: "ndt", abbr: "NDT", name: "Newfoundland Daylight Time", iana: "America/St_Johns", kind: "dst", counterpart: "nst", region: "Newfoundland during daylight saving time (UTC−2:30)" },
  { slug: "utc", abbr: "UTC", name: "Coordinated Universal Time", iana: "Etc/UTC", kind: "fixed", region: "The world's time standard; used in aviation, computing and science", top: true },
  { slug: "gmt", abbr: "GMT", name: "Greenwich Mean Time", iana: "Etc/GMT", kind: "fixed", region: "Same offset as UTC. The UK and Ireland use GMT in winter; Iceland, Ghana and Senegal all year", note: "The UK is on GMT only in winter; in summer it uses BST (UTC+1).", top: true },
  { slug: "bst", abbr: "BST", name: "British Summer Time", iana: "Europe/London", kind: "dst", counterpart: "gmt", region: "United Kingdom from late March to late October", note: "BST here means British Summer Time, not Bangladesh Standard Time.", top: true },
  { slug: "wet", abbr: "WET", name: "Western European Time", iana: "Europe/Lisbon", kind: "std", region: "Portugal, Canary Islands, Faroe Islands" },
  { slug: "cet", abbr: "CET", name: "Central European Time", iana: "Europe/Berlin", kind: "std", counterpart: "cest", region: "Germany, France, Italy, Spain, Netherlands, Belgium, Poland, Sweden, Norway, Austria, Switzerland and more", top: true },
  { slug: "cest", abbr: "CEST", name: "Central European Summer Time", iana: "Europe/Berlin", kind: "dst", counterpart: "cet", region: "Central Europe during daylight saving time" },
  { slug: "eet", abbr: "EET", name: "Eastern European Time", iana: "Europe/Athens", kind: "std", counterpart: "eest", region: "Greece, Finland, Romania, Bulgaria, Ukraine, Egypt, Israel (as IST), Baltic states", top: true },
  { slug: "eest", abbr: "EEST", name: "Eastern European Summer Time", iana: "Europe/Athens", kind: "dst", counterpart: "eet", region: "Eastern Europe during daylight saving time" },
  { slug: "msk", abbr: "MSK", name: "Moscow Standard Time", iana: "Europe/Moscow", kind: "fixed", region: "Moscow, St Petersburg and western Russia; Belarus", top: true },
  { slug: "trt", abbr: "TRT", name: "Turkey Time", iana: "Europe/Istanbul", kind: "fixed", region: "Türkiye (all year)" },
  { slug: "irst", abbr: "IRST", name: "Iran Standard Time", iana: "Asia/Tehran", kind: "fixed", region: "Iran (UTC+3:30)" },
  { slug: "gst", abbr: "GST", name: "Gulf Standard Time", iana: "Asia/Dubai", kind: "fixed", region: "United Arab Emirates and Oman", top: true },
  { slug: "pkt", abbr: "PKT", name: "Pakistan Standard Time", iana: "Asia/Karachi", kind: "fixed", region: "Pakistan", top: true },
  { slug: "ist", abbr: "IST", name: "India Standard Time", iana: "Asia/Kolkata", kind: "fixed", region: "India and Sri Lanka (UTC+5:30, no daylight saving time)", note: "IST here means India Standard Time, not Irish or Israel Standard Time.", top: true },
  { slug: "npt", abbr: "NPT", name: "Nepal Time", iana: "Asia/Kathmandu", kind: "fixed", region: "Nepal (UTC+5:45)" },
  { slug: "bangladesh-standard-time", abbr: "BST", name: "Bangladesh Standard Time", iana: "Asia/Dhaka", kind: "fixed", region: "Bangladesh (UTC+6)", top: true },
  { slug: "ict", abbr: "ICT", name: "Indochina Time", iana: "Asia/Bangkok", kind: "fixed", region: "Thailand, Vietnam, Cambodia, Laos", top: true },
  { slug: "wib", abbr: "WIB", name: "Western Indonesia Time", iana: "Asia/Jakarta", kind: "fixed", region: "Java and Sumatra, Indonesia (Jakarta)" },
  { slug: "sgt", abbr: "SGT", name: "Singapore Time", iana: "Asia/Singapore", kind: "fixed", region: "Singapore", top: true },
  { slug: "myt", abbr: "MYT", name: "Malaysia Time", iana: "Asia/Kuala_Lumpur", kind: "fixed", region: "Malaysia" },
  { slug: "philippine-time", abbr: "PHT", name: "Philippine Standard Time", iana: "Asia/Manila", kind: "fixed", region: "Philippines (Manila, Cebu, Davao)", top: true },
  { slug: "hkt", abbr: "HKT", name: "Hong Kong Time", iana: "Asia/Hong_Kong", kind: "fixed", region: "Hong Kong" },
  { slug: "china-standard-time", abbr: "CST", name: "China Standard Time", iana: "Asia/Shanghai", kind: "fixed", region: "Mainland China and Taiwan (Beijing, Shanghai, Shenzhen, Taipei)", top: true },
  { slug: "jst", abbr: "JST", name: "Japan Standard Time", iana: "Asia/Tokyo", kind: "fixed", region: "Japan", top: true },
  { slug: "kst", abbr: "KST", name: "Korea Standard Time", iana: "Asia/Seoul", kind: "fixed", region: "South Korea", top: true },
  { slug: "awst", abbr: "AWST", name: "Australian Western Standard Time", iana: "Australia/Perth", kind: "fixed", region: "Western Australia (Perth)", top: true },
  { slug: "acst", abbr: "ACST", name: "Australian Central Standard Time", iana: "Australia/Adelaide", kind: "std", counterpart: "acdt", region: "South Australia (Adelaide) and Northern Territory (Darwin, all year)" },
  { slug: "acdt", abbr: "ACDT", name: "Australian Central Daylight Time", iana: "Australia/Adelaide", kind: "dst", counterpart: "acst", region: "South Australia during daylight saving time" },
  { slug: "aest", abbr: "AEST", name: "Australian Eastern Standard Time", iana: "Australia/Sydney", kind: "std", counterpart: "aedt", region: "New South Wales, Victoria, Tasmania, ACT; Queensland (Brisbane) all year", note: "Queensland stays on AEST all year.", top: true },
  { slug: "aedt", abbr: "AEDT", name: "Australian Eastern Daylight Time", iana: "Australia/Sydney", kind: "dst", counterpart: "aest", region: "Sydney, Melbourne, Canberra, Hobart during daylight saving time" },
  { slug: "nzst", abbr: "NZST", name: "New Zealand Standard Time", iana: "Pacific/Auckland", kind: "std", counterpart: "nzdt", region: "New Zealand", top: true },
  { slug: "nzdt", abbr: "NZDT", name: "New Zealand Daylight Time", iana: "Pacific/Auckland", kind: "dst", counterpart: "nzst", region: "New Zealand during daylight saving time" },
  { slug: "sast", abbr: "SAST", name: "South Africa Standard Time", iana: "Africa/Johannesburg", kind: "fixed", region: "South Africa, Lesotho, Eswatini", top: true },
  { slug: "wat", abbr: "WAT", name: "West Africa Time", iana: "Africa/Lagos", kind: "fixed", region: "Nigeria, Cameroon, Angola, DR Congo (west)", top: true },
  { slug: "cat", abbr: "CAT", name: "Central Africa Time", iana: "Africa/Maputo", kind: "fixed", region: "Mozambique, Zambia, Zimbabwe, Malawi, Rwanda" },
  { slug: "eat", abbr: "EAT", name: "East Africa Time", iana: "Africa/Nairobi", kind: "fixed", region: "Kenya, Ethiopia, Tanzania, Uganda, Somalia", top: true },
  { slug: "brt", abbr: "BRT", name: "Brasília Time", iana: "America/Sao_Paulo", kind: "fixed", region: "Brasília, São Paulo, Rio de Janeiro", top: true },
  { slug: "art", abbr: "ART", name: "Argentina Time", iana: "America/Argentina/Buenos_Aires", kind: "fixed", region: "Argentina" },
  { slug: "cot", abbr: "COT", name: "Colombia Time", iana: "America/Bogota", kind: "fixed", region: "Colombia" },
  { slug: "pet", abbr: "PET", name: "Peru Time", iana: "America/Lima", kind: "fixed", region: "Peru" },
  { slug: "clt", abbr: "CLT", name: "Chile Standard Time", iana: "America/Santiago", kind: "std", region: "Continental Chile" },
  { slug: "sst", abbr: "SST", name: "Samoa Standard Time", iana: "Pacific/Pago_Pago", kind: "fixed", region: "American Samoa, Midway" },
  { slug: "chst", abbr: "ChST", name: "Chamorro Standard Time", iana: "Pacific/Guam", kind: "fixed", region: "Guam and the Northern Mariana Islands" },
];

export const ZONE_BY_SLUG = new Map(ZONES.map((z) => [z.slug, z]));
