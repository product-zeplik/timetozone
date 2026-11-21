import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parsePair } from "@/engine/entities";
import { buildHour, buildPair } from "@/content/pair";
import { buildPlace, clockZones, resolvePlace } from "@/content/place";
import { TEMPLATE_V2, templateV2 } from "@/seo/template-flags";

/**
 * Template v2 (src/seo/template-flags.ts): the computed per-page value blocks are held behind a flag while the
 * November 2026 core update rolls out (engine rulebook 11.2 rules 5 and 7). Both states are pinned here: off renders
 * exactly the template production serves today; on adds blocks whose every number comes from the engine.
 */
const JAN = Date.UTC(2027, 0, 15, 12);
const NOV = Date.UTC(2026, 10, 21, 12);
const pair = (slug: string) => {
  const p = parsePair(slug);
  if (!p) throw new Error(`no pair ${slug}`);
  return p;
};
const set = (v: string | undefined) => {
  if (v === undefined) delete process.env.TTZ_TEMPLATE_V2;
  else process.env.TTZ_TEMPLATE_V2 = v;
};
afterEach(() => {
  set(undefined);
  delete process.env.TTZ_TEMPLATE_V2_LOCAL;
});

describe("the template v2 flag", () => {
  it("is off in the committed constant, and production never reads the environment variable", () => {
    expect(TEMPLATE_V2).toBe(false);
    const env = process.env.SITE_ENV;
    process.env.SITE_ENV = "production";
    set("on");
    expect(templateV2()).toBe(false);
    if (env === undefined) delete process.env.SITE_ENV;
    else process.env.SITE_ENV = env;
    expect(templateV2()).toBe(true);
    set("off");
    expect(templateV2()).toBe(false);
  });

  it("off: pair and hour pages carry no v2 block and keep the 24-hour sibling links", () => {
    set("off");
    const c = buildPair(pair("pst-to-est"), JAN);
    expect(c.v2).toBeNull();
    const h = buildHour(pair("pst-to-est"), 17, JAN);
    expect(h.v2).toBeNull();
    expect(h.related.find((g) => g.heading === "All PST to EST times")?.items).toHaveLength(24);
  });

  it("on: the next changes of the difference come from the tzdata", () => {
    set("on");
    const v = buildPair(pair("est-to-ist"), NOV).v2!;
    // US clocks go forward on 14 March 2027: EST -> EDT, IST stays, so the gap shrinks by an hour.
    expect(v.changes[0]).toMatch(/^14 March 2027: EST clocks go forward \(EST to EDT\); IST is 10 hours 30 minutes ahead of EST until then, and 9 hours 30 minutes ahead of EST after\.$/);
    expect(v.changes).toHaveLength(2);
    expect(v.overlapRows.length).toBeGreaterThan(1);
    const fixed = buildPair(pair("utc-to-ist"), NOV).v2!;
    expect(fixed.changes[0]).toMatch(/Neither UTC nor IST changes its clocks/);
    expect(fixed.overlapRows).toHaveLength(1);
  });

  it("on: Germany time and Berlin time are one clock, each page says so and links the other", () => {
    set("on");
    const berlin = buildPair(pair("pst-to-berlin-time"), NOV).v2!;
    const germany = buildPair(pair("pst-to-germany-time"), NOV).v2!;
    expect(berlin.equivalents.map((e) => e.href)).toContain("/pst-to-germany-time");
    expect(germany.equivalents.map((e) => e.href)).toContain("/pst-to-berlin-time");
    // The coverage differs: the country page lists its cities, the city page the countries on the same clock.
    expect(germany.coverage[0].text).toMatch(/^Germany has one time zone, Europe\/Berlin\. The same clock is the local time in Berlin/);
    expect(berlin.coverage[0].text).toMatch(/^Berlin is on Europe\/Berlin, the one time zone of all of Germany\. Every day of 2026 the same clock is also kept in .*France/);
    expect(berlin.coverage[0].text).not.toEqual(germany.coverage[0].text);
  });

  it("on: an hour page gets this hour through the year and its place in each day, and links only its neighbours", () => {
    set("on");
    const h = buildHour(pair("est-to-ist"), 9, NOV);
    expect(h.v2!.yearRows.map((r) => r.text)).toEqual(expect.arrayContaining(["9:00 AM EST = 7:30 PM IST", "9:00 AM EDT = 6:30 PM IST"]));
    expect(h.v2!.dayText[0]).toBe("9:00 AM EST is morning working hours in EST; on the other side it is 7:30 PM IST, evening in IST.");
    const nearby = h.related.find((g) => g.heading === "Nearby EST to IST times")!;
    expect(nearby.items.map((i) => i.href)).toEqual(["/est-to-ist/6am", "/est-to-ist/7am", "/est-to-ist/8am", "/est-to-ist/10am", "/est-to-ist/11am", "/est-to-ist/12pm"]);
    expect(h.related.some((g) => g.items.length === 24)).toBe(false);
  });
});

describe("place pages link the conversions of their zone (fix, not flagged)", () => {
  it("India links /est-to-ist and the Philippines links /est-to-philippine-time", () => {
    const india = buildPlace(resolvePlace(["india"])!, NOV);
    const ist = india.children.find((g) => g.heading.startsWith("Convert IST"));
    expect(ist?.items.map((i) => i.href)).toContain("/est-to-ist");
    const ph = buildPlace(resolvePlace(["philippines"])!, NOV);
    const pht = ph.children.find((g) => g.heading.startsWith("Convert PHT"));
    expect(pht?.items.map((i) => i.href)).toContain("/est-to-philippine-time");
  });
  it("a place on another IANA id with the same clock all year gets that zone (Paris keeps CET)", () => {
    expect(clockZones("Europe/Paris", 2026).map((z) => z.slug)).toContain("cet");
  });
});

describe("content dates: the flagged template does not move dates while it is off", () => {
  it("content-dates.mjs skips commits marked Content-Dates: unchanged, and the flag file dates pair and hour pages", () => {
    const src = readFileSync("scripts/content-dates.mjs", "utf8");
    expect(src).toContain("Content-Dates");
    expect(src).toMatch(/src\/seo\/template-flags\.ts/);
  });
});
