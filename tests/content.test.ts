import { describe, expect, it } from "vitest";
import { parsePair } from "@/engine/entities";
import { buildHour, buildPair } from "@/content/pair";
import { buildMultiZone, buildPlace, buildZone, resolveMultiZone, resolvePlace } from "@/content/place";
import { buildDstCountry, buildDstHub, resolveDstCountry } from "@/content/dst";
import { ZONE_BY_SLUG } from "@/data/zones";
import { clip, firstThatFits, title } from "@/seo/meta";

const JAN = Date.UTC(2027, 0, 15, 12);
const JUL = Date.UTC(2027, 6, 15, 12);

const pair = (slug: string) => {
  const p = parsePair(slug);
  if (!p) throw new Error(`no pair ${slug}`);
  return p;
};

describe("seo/meta", () => {
  it("title brands only when it fits in 60", () => {
    expect(title("Short")).toBe("Short | TimeToZone");
    const long = "A".repeat(55);
    expect(title(long)).toBe(long);
  });
  it("clip cuts at a word boundary", () => {
    const out = clip("one two three four five six seven eight nine ten", 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toContain("  ");
  });
  it("firstThatFits picks the first candidate within the limit", () => {
    expect(firstThatFits(["x".repeat(70), "short"], 60)).toBe("short");
  });
});

describe("buildPair", () => {
  const c = buildPair(pair("pst-to-est"), JAN);

  it("matches the docs/06 template", () => {
    expect(c.title).toBe("PST to EST Converter – Pacific Time to Eastern Time");
    expect(c.title.length).toBeLessThanOrEqual(60);
    expect(c.h1).toBe("PST to EST Converter");
    expect(c.answer).toBe("EST is 3 hours ahead of PST. 9:00 AM PST = 12:00 PM EST.");
  });
  it("description fits and leads with the conversion", () => {
    expect(c.description.length).toBeLessThanOrEqual(155);
    expect(c.description.startsWith("Convert PST to EST:")).toBe(true);
  });
  it("has 24 table rows and at least 6 FAQs", () => {
    expect(c.rows.length).toBe(24);
    expect(c.faqs.length).toBeGreaterThanOrEqual(6);
    for (const f of c.faqs) {
      expect(f.q.length).toBeGreaterThan(8);
      expect(f.a.length).toBeGreaterThan(8);
    }
  });
  it("PST to EST has a single difference period", () => {
    expect(c.diffConstant).toBe(true);
    expect(c.diffPeriodsList.length).toBe(1);
  });
  it("answers the PT/PST question", () => {
    expect(c.faqs.some((f) => f.q === "Is PT the same as PST?")).toBe(true);
  });
  it("links the reverse pair and the two sides", () => {
    expect(c.reverseHref).toBe("/est-to-pst");
    const hrefs = c.related.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain("/zones/pst");
    expect(hrefs).toContain("/zones/est");
  });
  it("hour pairs link all 24 hours", () => {
    const group = c.related.find((g) => g.heading.endsWith("by hour"));
    expect(group?.items.length).toBe(24);
    expect(group?.items[9].href).toBe("/pst-to-est/9am");
  });
  it("EST to IST lists three difference periods", () => {
    const i = buildPair(pair("est-to-ist"), JAN);
    expect(i.diffConstant).toBe(false);
    expect(i.diffPeriodsList.length).toBe(3);
    expect(i.answer).toContain("10 hours 30 minutes");
  });
  it("same-region pairs are a constant hour and explained", () => {
    const e = buildPair(pair("est-to-edt"), JAN);
    expect(e.diffConstant).toBe(true);
    expect(e.answer).toContain("1 hour");
  });
  it("explains when a page's zone name is not in force", () => {
    const w = buildPair(pair("est-to-bst"), JAN);
    expect(w.inForceNotes.join(" ")).toContain("BST");
    // in July the EST side is the one out of force, so the note is about EST
    const s = buildPair(pair("est-to-bst"), JUL);
    expect(s.inForceNotes.join(" ")).toContain("EDT");
    expect(s.inForceNotes.join(" ")).not.toContain("BST");
  });
  it("spelled-out zone slugs carry their code", () => {
    const p = buildPair(pair("est-to-philippine-time"), JAN);
    expect(p.B).toBe("Philippine Time (PHT)");
    expect(p.title).toContain("PHT");
  });
  it("place pairs work in both directions", () => {
    const a = buildPair(pair("india-time-to-est"), JAN);
    expect(a.h1).toBe("India Time to EST Converter");
    const b = buildPair(pair("london-time-to-new-york-time"), JAN);
    expect(b.h1).toBe("London Time to New York Time Converter");
  });
  it("marks working-hour rows", () => {
    expect(c.rows.filter((r) => r.biz).length).toBe(5);
  });
});

describe("buildHour", () => {
  const h = buildHour(pair("pst-to-est"), 9, JAN);
  it("uses the searched form in the title", () => {
    expect(h.title.startsWith("9am PST to EST")).toBe(true);
    expect(h.title.length).toBeLessThanOrEqual(60);
  });
  it("uses the spaced form in the H1", () => {
    expect(h.h1).toBe("9 AM PST to EST");
  });
  it("answers with the numbers", () => {
    expect(h.answer).toBe("9:00 AM PST is 12:00 PM EST.");
  });
  it("labels noon and midnight", () => {
    expect(buildHour(pair("pst-to-est"), 12, JAN).h1).toBe("12 PM (noon) PST to EST");
    expect(buildHour(pair("pst-to-est"), 0, JAN).h1).toBe("12 AM (midnight) PST to EST");
  });
  it("shows four quarter-hour conversions and 8 other zones", () => {
    expect(h.quarters.length).toBe(4);
    expect(h.quarters[2]).toContain("9:30 AM PST");
    expect(h.otherRows.length).toBe(8);
  });
  it("links the previous and next hour", () => {
    expect(h.prevHref).toBe("/pst-to-est/8am");
    expect(h.nextHref).toBe("/pst-to-est/10am");
    expect(buildHour(pair("pst-to-est"), 0, JAN).prevHref).toBe("/pst-to-est/11pm");
  });
  it("descriptions differ between pairs that share a live abbreviation", () => {
    const bst = buildHour(pair("est-to-bst"), 9, JAN);
    const gmt = buildHour(pair("est-to-gmt"), 9, JAN);
    expect(bst.description).not.toBe(gmt.description);
  });
});

describe("buildPlace", () => {
  it("London", () => {
    const t = resolvePlace(["uk", "london"]);
    expect(t).toBeTruthy();
    const c = buildPlace(t!, JAN);
    expect(c.h1).toBe("Current Time in London, United Kingdom");
    expect(c.title).toBe("Time in London, UK Now – Current Local Time | TimeToZone");
    expect(c.answer).toContain("GMT");
    expect(c.compareRows.length).toBe(10);
    expect(c.observesDst).toBe(true);
  });
  it("Texas has Central and Mountain", () => {
    const t = resolvePlace(["usa", "texas"]);
    const c = buildPlace(t!, JAN);
    expect(c.zoneRows.length).toBe(2);
    expect(c.zoneRows.map((r) => r.abbr).sort()).toEqual(["CST", "MST"]);
    expect(c.multiZoneHref).toBe("/time-zone/texas");
  });
  it("New York city and state do not collide", () => {
    const city = buildPlace(resolvePlace(["usa", "new-york"])!, JAN);
    const state = buildPlace(resolvePlace(["usa", "new-york-state"])!, JAN);
    expect(city.h1).not.toBe(state.h1);
    expect(city.title).not.toBe(state.title);
    expect(city.h1).toBe("Current Time in New York (NYC), United States");
  });
  it("India has no DST", () => {
    const c = buildPlace(resolvePlace(["india"])!, JAN);
    expect(c.observesDst).toBe(false);
    expect(c.answer).toContain("does not observe daylight saving time");
    expect(c.children.length).toBeGreaterThan(0);
  });
  it("unknown places resolve to null", () => {
    expect(resolvePlace(["narnia"])).toBeNull();
    expect(resolvePlace(["uk", "nowhere"])).toBeNull();
    expect(resolvePlace(["uk", "london", "extra"])).toBeNull();
  });
});

describe("buildMultiZone", () => {
  it("Texas", () => {
    const t = resolveMultiZone("texas");
    const c = buildMultiZone(t!, JAN);
    expect(c.h1).toBe("What Time Zone Is Texas?");
    expect(c.zoneRows.length).toBe(2);
    expect(c.title.length).toBeLessThanOrEqual(60);
  });
  it("single-zone places are rejected", () => {
    expect(resolveMultiZone("france")).toBeNull();
    expect(resolveMultiZone("india")).toBeNull();
  });
  it("USA is accepted", () => {
    expect(resolveMultiZone("usa")).toBeTruthy();
  });
});

describe("buildZone", () => {
  it("EST", () => {
    const c = buildZone(ZONE_BY_SLUG.get("est")!, JAN);
    expect(c.h1).toBe("Eastern Standard Time (EST)");
    expect(c.title).toBe("EST Time Now – Eastern Standard Time (UTC\u22125) | TimeToZone");
    expect(c.answer.split(/\s+/).length).toBeLessThanOrEqual(50);
    expect(c.answer).toContain("UTC−5");
    expect(c.conversions.length).toBeGreaterThan(8);
    expect(c.faqs.length).toBeGreaterThanOrEqual(4);
  });
  it("notes when a standard name is out of force", () => {
    expect(buildZone(ZONE_BY_SLUG.get("est")!, JUL).inForceNote).toContain("EDT");
    expect(buildZone(ZONE_BY_SLUG.get("est")!, JAN).inForceNote).toBeUndefined();
  });
  it("fixed zones say they never change", () => {
    const c = buildZone(ZONE_BY_SLUG.get("ist")!, JUL);
    expect(c.answer).toContain("does not change for daylight saving time");
  });
  it("generic zones describe the clocks", () => {
    const c = buildZone(ZONE_BY_SLUG.get("et")!, JAN);
    expect(c.answer).toContain("local time on the clocks");
  });
  it("every curated zone builds with a title within 60", () => {
    for (const z of ZONE_BY_SLUG.values()) {
      const c = buildZone(z, JAN);
      expect(c.title.length, z.slug).toBeLessThanOrEqual(60);
      expect(c.description.length, z.slug).toBeLessThanOrEqual(155);
      expect(c.h1.length, z.slug).toBeGreaterThan(3);
    }
  });
});

describe("DST pages", () => {
  it("hub lists this year and next", () => {
    const c = buildDstHub(JAN);
    expect(c.year).toBe(2027);
    expect(c.blocks.length).toBe(2);
    expect(c.blocks[0].rows.length).toBeGreaterThan(4);
    expect(c.answer).toContain("2027");
    expect(c.countries.length).toBeGreaterThan(40);
  });
  it("USA country page has the right 2027 dates", () => {
    const country = resolveDstCountry("usa");
    const c = buildDstCountry(country!, JAN);
    expect(c.h1).toBe("Daylight Saving Time in the United States (2027–2028)");
    const all = c.schedules.flatMap((s) => s.years.flatMap((y) => y.changes));
    expect(all.some((ch) => ch.dateText === "14 March 2027")).toBe(true);
    expect(all.some((ch) => ch.dateText === "7 November 2027")).toBe(true);
    expect(c.nonObserving.length).toBeGreaterThan(0); // Arizona, Hawaii
  });
  it("UK rule text", () => {
    const c = buildDstCountry(resolveDstCountry("uk")!, JAN);
    const fwd = c.schedules[0].years[0].changes.find((ch) => ch.direction === "forward");
    expect(fwd?.rule).toBe("last Sunday in March");
  });
  it("countries without DST resolve to null", () => {
    expect(resolveDstCountry("india")).toBeNull();
    expect(resolveDstCountry("japan")).toBeNull();
  });
});
