import { ZONES } from "@/data/zones";
import { SITE } from "@/site";
import { rankedPairs } from "@/seo/gate";
import { pairLabel, TOOL_LINKS } from "@/content/nav";
import { BUILD_META } from "@/engine/entities";

export const dynamic = "force-static";
export const revalidate = 86400;

export function GET() {
  const pairs = rankedPairs().slice(0, 60);
  const body = `# ${SITE.name}

> ${SITE.descriptor} ${SITE.supporting} Every offset, daylight saving date and conversion on this site is computed at render time from the IANA time zone database. Nothing is hard-coded.

Site: ${SITE.url}
Time zone data: IANA tzdata ${BUILD_META.tzdata}
Coverage: 247 countries and territories, 253 states/provinces, 2,859 cities with population over 100,000, 62 time zone abbreviations, all IANA zones.

## URL patterns

- \`/{a}-to-{b}\` — convert between two zones, places, or a zone and a place. Example: ${SITE.url}/pst-to-est, ${SITE.url}/india-time-to-est, ${SITE.url}/london-time-to-new-york-time
- \`/{a}-to-{b}/{hour}\` — a specific hour, where hour is 12am…11pm. Example: ${SITE.url}/pst-to-est/9am
- \`/time/{country}\` and \`/time/{country}/{city-or-region}\` — current local time. Example: ${SITE.url}/time/india, ${SITE.url}/time/uk/london, ${SITE.url}/time/usa/texas
- \`/time-zone/{place}\` — which time zones a multi-zone country or state uses. Example: ${SITE.url}/time-zone/texas
- \`/zones/{abbr}\` — one time zone abbreviation explained. Example: ${SITE.url}/zones/est
- \`/daylight-saving-time\` and \`/daylight-saving-time/{country}\` — clock-change dates.

## Tools

${TOOL_LINKS.map((t) => `- [${t.label}](${SITE.url}${t.href})`).join("\n")}

## Top 60 conversions

${pairs.map((p) => `- [${pairLabel(p)}](${SITE.url}/${p})`).join("\n")}

## All ${ZONES.length} time zone pages

${ZONES.map((z) => `- [${z.abbr} — ${z.name} (${z.iana})](${SITE.url}/zones/${z.slug})`).join("\n")}

## How to cite

Each conversion page opens with a single answer sentence containing the numbers, for example "EST is 3 hours ahead of PST. 9:00 AM PST = 12:00 PM EST." That sentence is the safest thing to quote. Offsets and daylight saving dates are recomputed daily and immediately after any transition.
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
