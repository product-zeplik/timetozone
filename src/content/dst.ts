/**
 * Daylight saving time hub and country pages (type G). docs/06.
 * Nothing is year-hard-coded: every date comes from tzdata at render time.
 */
import { COUNTRIES, COUNTRY_BY_SLUG, PLACES, type Country } from "@/engine/entities";
import { abbrFor } from "@/engine/side";
import { describeRuleOn, fmtClock, fmtDate, fmtOffset, seasonalOffsets, transitionWall, transitionsInYear, wallTime } from "@/engine/tz";
import { clip, firstThatFits, title as brandTitle } from "@/seo/meta";
import { dstCountries } from "@/seo/gate";
import type { FaqItem } from "@/components/Blocks";

export interface Change {
  at: number;
  dateText: string;
  direction: "forward" | "back";
  localHour: string;
  fromAbbr: string;
  toAbbr: string;
  fromOffset: number;
  toOffset: number;
  rule: string;
}

export function changesFor(tz: string, year: number): Change[] {
  return transitionsInYear(tz, year).map((t) => {
    const before = transitionWall(t);
    return {
      at: t.at,
      dateText: fmtDate(before, true),
      direction: t.to > t.from ? "forward" : "back",
      localHour: fmtClock(before.hour, before.minute, false),
      fromAbbr: abbrFor(tz, t.at - 60_000),
      toAbbr: abbrFor(tz, t.at + 60_000),
      fromOffset: t.from,
      toOffset: t.to,
      rule: describeRuleOn(before),
    };
  });
}

export function observesDst(tz: string, year: number): boolean {
  return seasonalOffsets(tz, year).dst !== null;
}

/**
 * "United States" reads as an error without its article, and the DST pages put
 * a country name straight after "in". Only the handful of names that take one
 * are listed; everything else is returned unchanged.
 */
const TAKES_THE = new Set([
  "United States",
  "United Kingdom",
  "Netherlands",
  "Philippines",
  "Bahamas",
  "Czech Republic",
  "Dominican Republic",
  "United Arab Emirates",
]);
function theName(name: string): string {
  return TAKES_THE.has(name) ? `the ${name}` : name;
}

/* ------------------------------------------------------------------ the hub */

export interface DstHubContent {
  year: number;
  title: string;
  description: string;
  h1: string;
  answer: string;
  crumbs: { name: string; path: string }[];
  blocks: { heading: string; rows: { label: string; forward: string; back: string }[] }[];
  countries: { href: string; label: string }[];
  noDst: string[];
  faqs: FaqItem[];
}

const HUB_REGIONS: { label: string; tz: string }[] = [
  { label: "United States & Canada", tz: "America/New_York" },
  { label: "United Kingdom & Ireland", tz: "Europe/London" },
  { label: "European Union (CET/CEST)", tz: "Europe/Berlin" },
  { label: "Australia (NSW, Victoria, Tasmania, ACT)", tz: "Australia/Sydney" },
  { label: "New Zealand", tz: "Pacific/Auckland" },
  { label: "Chile", tz: "America/Santiago" },
];

export function buildDstHub(now: number = Date.now()): DstHubContent {
  const year = wallTime("UTC", now).year;

  const blocks = [year, year + 1].map((y) => ({
    heading: `Clock changes in ${y}`,
    rows: HUB_REGIONS.map((r) => {
      const list = changesFor(r.tz, y);
      const fwd = list.find((c) => c.direction === "forward");
      const back = list.find((c) => c.direction === "back");
      return {
        label: r.label,
        forward: fwd ? `${fwd.dateText} at ${fwd.localHour} local` : "No change",
        back: back ? `${back.dateText} at ${back.localHour} local` : "No change",
      };
    }),
  }));

  const us = changesFor("America/New_York", year);
  const uk = changesFor("Europe/London", year);
  const au = changesFor("Australia/Sydney", year);
  const usF = us.find((c) => c.direction === "forward");
  const usB = us.find((c) => c.direction === "back");
  const ukF = uk.find((c) => c.direction === "forward");
  const ukB = uk.find((c) => c.direction === "back");
  const auF = au.find((c) => c.direction === "forward");
  // Same southern-hemisphere pairing as the country pages: the change that
  // ends the period starting in October falls in the following April, so
  // reading the two out of one calendar year listed a date that had already
  // passed and left out the October move entirely.
  const auNext = changesFor("Australia/Sydney", year + 1);
  const auBack =
    auF && au.find((c) => c.direction === "back" && c.at > auF.at)
      ? au.find((c) => c.direction === "back" && c.at > auF.at)
      : auNext.find((c) => c.direction === "back") ?? au.find((c) => c.direction === "back");

  // The answer leads with the dates, per CLAUDE.md rule 3. The closing gloss is
  // there because "daylight savings" is not a typo to most readers: it is the
  // form roughly eight times more people search for than the formal one.
  const answer = `The ${year} time change dates: US clocks go forward on ${
    usF?.dateText ?? "—"
  } and back on ${usB?.dateText ?? "—"}. UK and EU clocks go forward on ${ukF?.dateText ?? "—"} and back on ${
    ukB?.dateText ?? "—"
  }. Australian clocks (NSW, Victoria, Tasmania, ACT) go forward on ${
    auF?.dateText ?? "—"
  } and back on ${auBack?.dateText ?? "—"}. Daylight saving time is also written “daylight savings”.`;

  const dstSlugs = new Set(dstCountries());
  const countries = COUNTRIES.filter((c) => dstSlugs.has(c.slug))
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
    .map((c) => ({ href: `/daylight-saving-time/${c.slug}`, label: c.name }));

  const noDst = COUNTRIES.filter((c) => !dstSlugs.has(c.slug) && c.rank < 40).map((c) => c.name);

  const faqs: FaqItem[] = [
    {
      q: `When do the clocks change in the United States?`,
      a: `US clocks go forward on the ${usF?.rule ?? "second Sunday in March"} at 2:00 AM local time and back on the ${
        usB?.rule ?? "first Sunday in November"
      } at 2:00 AM local time. In ${year} that is ${usF?.dateText ?? "—"} and ${usB?.dateText ?? "—"}.`,
    },
    {
      q: `When do the clocks change in the UK and the EU?`,
      a: `The UK and EU change on the ${ukF?.rule ?? "last Sunday in March"} and the ${
        ukB?.rule ?? "last Sunday in October"
      }, both at 01:00 UTC. In ${year} that is ${ukF?.dateText ?? "—"} and ${ukB?.dateText ?? "—"}.`,
    },
    {
      q: `Why do the US and Europe change on different dates?`,
      a: `The US switches two to three weeks earlier in spring and one week earlier in autumn. For those weeks the difference between US and European time is one hour smaller or larger than usual, which is why a converter must compute each date rather than use a fixed offset.`,
    },
    {
      q: `Which countries do not use daylight saving time?`,
      a: `Most of Asia, Africa and South America stay on one offset all year, including ${noDst
        .slice(0, 8)
        .join(", ")}. Within the US, Hawaii and most of Arizona do not change their clocks.`,
    },
    {
      q: `Do clocks change in the southern hemisphere at the same time?`,
      a: `No. Australia, New Zealand, Chile and Paraguay are on daylight saving time during the northern-hemisphere winter, so their clocks go forward in October and back in April.`,
    },
    {
      q: `When is daylight savings ${year}?`,
      a: `“Daylight savings” is the everyday spelling of daylight saving time, and it means the same thing. In ${year} it begins in the US on ${
        usF?.dateText ?? "—"
      } and ends on ${usB?.dateText ?? "—"}; in the UK and EU it begins on ${ukF?.dateText ?? "—"} and ends on ${
        ukB?.dateText ?? "—"
      }.`,
    },
    {
      q: `What is daylight saving time?`,
      a: `Daylight saving time moves the clock forward one hour for part of the year, so that summer evenings keep an extra hour of daylight. The offset from UTC changes with it: New York is UTC−5 on standard time and UTC−4 on daylight time, which is why a conversion is only correct for a given date.`,
    },
    {
      q: `Why do we have daylight saving time?`,
      a: `It was adopted during the First World War to save fuel and kept, in most of Europe and North America, to shift an hour of daylight from the early morning to the evening. Countries near the equator gain almost nothing from it and generally do not use it at all.`,
    },
  ];

  return {
    year,
    title: firstThatFits(
      // "Savings" in the title, "Saving" in the H1. Both spellings are in wide
      // use and they rank as separate terms; the colloquial one carries the
      // far larger share of the searches, so it earns the title.
      [
        brandTitle(`Daylight Savings Time ${year} – Time Change Dates`),
        `Daylight Savings Time ${year} – When Do Clocks Change?`,
        `Daylight Savings Time ${year}`,
      ],
      60
    ),
    description: clip(
      `Daylight savings ${year} and ${year + 1}: the exact time change dates for the US, UK, EU, Australia and New Zealand, the local time each clock moves, and the countries that never change.`,
      155
    ),
    h1: `Daylight Saving Time ${year}: When Do the Clocks Change?`,
    answer,
    crumbs: [
      { name: "Home", path: "/" },
      { name: "Daylight saving time", path: "/daylight-saving-time" },
    ],
    blocks,
    countries,
    noDst,
    faqs,
  };
}

/* ------------------------------------------------------------ country pages */

/** DST countries with almost no DST neighbours in their own IANA area. */
let isolatedCache: Country[] | null = null;
function isolatedDstCountries(): Country[] {
  if (isolatedCache) return isolatedCache;
  const dstSet = new Set(dstCountries());
  const byArea = new Map<string, Country[]>();
  for (const c of COUNTRIES) {
    if (!dstSet.has(c.slug)) continue;
    const area = c.primary.split("/")[0];
    byArea.set(area, [...(byArea.get(area) ?? []), c]);
  }
  isolatedCache = [...byArea.values()].filter((list) => list.length < 4).flat();
  return isolatedCache;
}


export interface DstCountryContent {
  country: Country;
  year: number;
  path: string;
  title: string;
  description: string;
  h1: string;
  answer: string;
  crumbs: { name: string; path: string }[];
  schedules: {
    heading: string;
    zones: string[];
    areas: string[];
    years: { year: number; changes: Change[] }[];
  }[];
  nonObserving: { tz: string; abbr: string; areas: string[] }[];
  related: { heading: string; items: { href: string; label: string }[] }[];
  faqs: FaqItem[];
}

export function resolveDstCountry(slug: string): Country | null {
  const c = COUNTRY_BY_SLUG.get(slug);
  if (!c) return null;
  const year = new Date().getUTCFullYear();
  const any = c.zones.some((tz) => observesDst(tz, year) || observesDst(tz, year + 1));
  return any ? c : null;
}

export function buildDstCountry(country: Country, now: number = Date.now()): DstCountryContent {
  const year = wallTime(country.primary, now).year;

  // group zones by their transition signature so each distinct schedule is one section
  const groups = new Map<string, string[]>();
  const nonObserving: { tz: string; abbr: string; areas: string[] }[] = [];
  for (const tz of country.zones) {
    if (!observesDst(tz, year) && !observesDst(tz, year + 1)) {
      nonObserving.push({ tz, abbr: abbrFor(tz, now), areas: areasFor(country, tz) });
      continue;
    }
    const sig = transitionsInYear(tz, year)
      .map((t) => `${t.at}:${t.from}>${t.to}`)
      .join("|");
    const list = groups.get(sig);
    if (list) list.push(tz);
    else groups.set(sig, [tz]);
  }

  const schedules = [...groups.values()].map((zones) => {
    const lead = zones[0];
    const abbrs = [...new Set(zones.map((tz) => abbrFor(tz, now)))];
    const areas = zones.flatMap((tz) => areasFor(country, tz)).slice(0, 8);
    return {
      heading: abbrs.length === 1 ? `${abbrs[0]} schedule` : `${abbrs.join(" / ")} schedule`,
      zones,
      areas,
      years: [year, year + 1].map((y) => ({ year: y, changes: changesFor(lead, y) })).filter((x) => x.changes.length),
    };
  });

  const first = schedules[0]?.years[0]?.changes ?? [];
  const fwd = first.find((c) => c.direction === "forward");
  let back = first.find((c) => c.direction === "back");
  // In the southern hemisphere the two changes inside one calendar year belong
  // to different daylight-saving periods: Australia's clocks go back in April
  // and forward in October. Pairing them as they fall in the year produced
  // "forward on 4 October 2026 and back on 5 April 2026" -- back before
  // forward. The change that ends the period beginning at `fwd` is next year's.
  if (fwd && back && back.at < fwd.at) {
    const following = schedules[0]?.years[1]?.changes ?? [];
    back = following.find((c) => c.direction === "back") ?? back;
  }

  const answer = `${theName(country.name)} ${
    schedules.length ? "observes daylight saving time" : "does not observe daylight saving time"
  } (often written “daylight savings”). In ${year} clocks go forward on ${fwd?.dateText ?? "—"} and back on ${
    back?.dateText ?? "—"
  }${nonObserving.length ? `, except ${nonObserving.map((n) => n.abbr).join(", ")}, which never change` : ""}.`;

  const faqs: FaqItem[] = [
    {
      q: `When do the clocks go forward in ${country.name}?`,
      a: fwd
        ? `On ${fwd.dateText} at ${fwd.localHour} local time, clocks go forward one hour from ${fwd.fromAbbr} (${fmtOffset(
            fwd.fromOffset
          )}) to ${fwd.toAbbr} (${fmtOffset(fwd.toOffset)}). The rule is the ${fwd.rule}.`
        : `${country.name} has no spring-forward change in ${year}.`,
    },
    {
      q: `When do the clocks go back in ${country.name}?`,
      a: back
        ? `On ${back.dateText} at ${back.localHour} local time, clocks go back one hour from ${back.fromAbbr} (${fmtOffset(
            back.fromOffset
          )}) to ${back.toAbbr} (${fmtOffset(back.toOffset)}). The rule is the ${back.rule}.`
        : `${country.name} has no autumn change in ${year}.`,
    },
    {
      q: `Does the whole of ${country.name} observe daylight saving time?`,
      a: nonObserving.length
        ? `No. ${nonObserving
            .map((n) => `${n.areas.slice(0, 3).join(", ") || n.tz} (${n.abbr})`)
            .join(" and ")} stay on the same offset all year.`
        : `Yes. Every time zone in ${country.name} changes its clocks on the same dates.`,
    },
  ];

  /* -------------------------------------------------------------- related */

  // A country's DST page was reachable from the hub and from its own city
  // pages only, which left 43 of them under the five inbound links docs/11
  // asks for. Countries sharing an IANA area are its natural neighbours, and
  // their clocks usually change on the same dates, so the block earns its
  // place for a reader as well as for a crawler.
  const area = country.primary.split("/")[0];
  const dstSet = new Set(dstCountries());
  const sameArea = COUNTRIES.filter(
    (c) => c.slug !== country.slug && dstSet.has(c.slug) && c.primary.split("/")[0] === area
  );
  // Antarctica, Bermuda, the Faroes and Norfolk Island have almost no
  // DST-observing neighbours in their IANA area, so top up from the
  // best-known ones rather than leave those four pages short.
  const picked = new Map(sameArea.map((c) => [c.slug, c]));
  // Antarctica, Bermuda, the Faroes and Norfolk Island sit almost alone in
  // their IANA area, so an area-peer list gives them almost no inbound links.
  // Every DST page carries the isolated ones, which costs four links here and
  // lifts each of them to the five docs/11 asks for. Topping a short list up
  // with the best-known countries fixes this page's outbound list too.
  for (const c of isolatedDstCountries()) {
    if (c.slug !== country.slug) picked.set(c.slug, c);
  }
  if (picked.size < 8) {
    for (const c of COUNTRIES.filter((c) => c.slug !== country.slug && dstSet.has(c.slug)).sort(
      (a, b) => a.rank - b.rank
    )) {
      if (picked.size >= 8) break;
      picked.set(c.slug, c);
    }
  }
  const peers = [...picked.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ href: `/daylight-saving-time/${c.slug}`, label: c.name }));

  const related: { heading: string; items: { href: string; label: string }[] }[] = [
    {
      heading: `Time in ${country.short}`,
      items: [{ href: `/time/${country.slug}`, label: `Current time in ${country.name}` }],
    },
  ];
  if (peers.length) {
    related.push({ heading: `Daylight saving time in other countries`, items: peers });
  }

  return {
    country,
    year,
    path: `/daylight-saving-time/${country.slug}`,
    title: firstThatFits(
      // "When Clocks Change" is what the page actually answers, and it carries
      // the clock-change wording that the country pages own now that the
      // generic daylight-savings cluster has consolidated on the hub.
      [
        `Daylight Savings Time ${year} in ${country.short} – When Clocks Change`,
        brandTitle(`Daylight Savings Time ${year} in ${country.short}`),
        `Daylight Savings Time ${year} in ${country.name}`,
        `Daylight Savings Time ${year} in ${country.short}`,
      ],
      60
    ),
    description: clip(
      // dateText already carries the year, so the old trailing "in ${year}"
      // printed "back on 5 April 2026 in 2026" on every one of these pages.
      `Daylight savings in ${theName(country.name)}: clocks go forward on ${
        fwd?.dateText ?? "—"
      } and back on ${back?.dateText ?? "—"}. Exact local times, offsets and ${year + 1} dates.`,
      155
    ),
    h1: `Daylight Saving Time in ${theName(country.name)} (${year}–${year + 1})`,
    answer,
    crumbs: [
      { name: "Home", path: "/" },
      { name: "Daylight saving time", path: "/daylight-saving-time" },
      { name: country.short, path: `/daylight-saving-time/${country.slug}` },
    ],
    schedules,
    nonObserving,
    related,
    faqs,
  };
}

function areasFor(country: Country, tz: string): string[] {
  return PLACES.filter((p) => p.countrySlug === country.slug && p.tz === tz)
    .slice(0, 4)
    .map((p) => p.name);
}
