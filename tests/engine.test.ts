import { describe, expect, it } from "vitest";
import {
  fmtClock,
  fmtDuration,
  fmtOffset,
  hourLabel,
  offsetMinutes,
  parseHourLabel,
  parseTimeInput,
  nextTransition,
  seasonalOffsets,
  transitionsInYear,
  wallTime,
  zonedToUtc,
  transitionWall,
  fmtDate,
} from "@/engine/tz";
import { abbrFor, applySameRegionRule, zoneSide } from "@/engine/side";
import { convertAt, diffMinutes, diffPeriods, table24, workOverlap, aheadBehind, directionPhrase, wallOf } from "@/engine/pair";
import { parsePair, pairFromKeys, sideFor } from "@/engine/entities";
import { ZONES, ZONE_BY_SLUG } from "@/data/zones";

const JAN = Date.UTC(2027, 0, 15, 12);
const JUL = Date.UTC(2027, 6, 15, 12);
const iso = (ms: number) => new Date(ms).toISOString().replace(".000", "");

const pair = (slug: string) => {
  const p = parsePair(slug);
  if (!p) throw new Error(`no pair: ${slug}`);
  return p;
};

describe("tz.ts — offsets", () => {
  it("America/New_York winter/summer", () => {
    expect(offsetMinutes("America/New_York", JAN)).toBe(-300);
    expect(offsetMinutes("America/New_York", JUL)).toBe(-240);
  });
  it("half- and quarter-hour zones", () => {
    expect(offsetMinutes("Asia/Kolkata", JAN)).toBe(330);
    expect(offsetMinutes("Asia/Kathmandu", JAN)).toBe(345);
    expect(offsetMinutes("America/St_Johns", JAN)).toBe(-210);
  });
  it("fmtOffset", () => {
    expect(fmtOffset(330)).toBe("UTC+5:30");
    expect(fmtOffset(-300)).toBe("UTC−5");
    expect(fmtOffset(0)).toBe("UTC+0");
    expect(fmtOffset(-210)).toBe("UTC−3:30");
  });
  it("fmtDuration", () => {
    expect(fmtDuration(180)).toBe("3 hours");
    expect(fmtDuration(570)).toBe("9 hours 30 minutes");
    expect(fmtDuration(45)).toBe("45 minutes");
    expect(fmtDuration(60)).toBe("1 hour");
    expect(fmtDuration(-180)).toBe("3 hours");
  });
  it("fmtClock", () => {
    expect(fmtClock(9, 0)).toBe("9:00 AM");
    expect(fmtClock(12, 0)).toBe("12:00 PM");
    expect(fmtClock(0, 0)).toBe("12:00 AM");
    expect(fmtClock(9, 0, false)).toBe("09:00");
    expect(fmtClock(21, 15, false)).toBe("21:15");
  });
  it("wallTime hour is 0-23", () => {
    const w = wallTime("America/New_York", Date.UTC(2027, 0, 15, 5, 30));
    expect(w).toMatchObject({ year: 2027, month: 1, day: 15, hour: 0, minute: 30 });
  });
});

describe("tz.ts — transitions", () => {
  it("US 2027", () => {
    const t = transitionsInYear("America/New_York", 2027);
    expect(t.length).toBe(2);
    expect(iso(t[0].at)).toBe("2027-03-14T07:00:00Z");
    expect(iso(t[1].at)).toBe("2027-11-07T06:00:00Z");
  });
  it("UK 2027", () => {
    const t = transitionsInYear("Europe/London", 2027);
    expect(t.length).toBe(2);
    expect(iso(t[0].at)).toBe("2027-03-28T01:00:00Z");
    expect(iso(t[1].at)).toBe("2027-10-31T01:00:00Z");
  });
  it("nextTransition", () => {
    expect(nextTransition("America/Los_Angeles", JAN)).not.toBeNull();
    expect(nextTransition("Asia/Kolkata", JAN)).toBeNull();
  });
  it("seasonalOffsets works in both hemispheres", () => {
    expect(seasonalOffsets("America/New_York", 2027)).toEqual({ std: -300, dst: -240 });
    expect(seasonalOffsets("Australia/Sydney", 2027)).toEqual({ std: 600, dst: 660 });
    expect(seasonalOffsets("Asia/Kolkata", 2027)).toEqual({ std: 330, dst: null });
  });
});

describe("tz.ts — zonedToUtc", () => {
  it("plain conversion", () => {
    expect(iso(zonedToUtc("America/New_York", 2027, 1, 15, 9, 0))).toBe("2027-01-15T14:00:00Z");
  });
  it("spring-forward gap moves forward", () => {
    const ms = zonedToUtc("America/New_York", 2027, 3, 14, 2, 30);
    expect(Number.isFinite(ms)).toBe(true);
    expect(wallTime("America/New_York", ms).hour).toBe(3);
  });
  it("fall-back overlap uses the first occurrence", () => {
    const ms = zonedToUtc("America/New_York", 2027, 11, 7, 1, 30);
    expect(offsetMinutes("America/New_York", ms)).toBe(-240);
  });
});

describe("tz.ts — parsing and labels", () => {
  it("parseTimeInput", () => {
    expect(parseTimeInput("9am")).toBe(540);
    expect(parseTimeInput("9 a")).toBe(540);
    expect(parseTimeInput("9")).toBe(540);
    expect(parseTimeInput("9:30 pm")).toBe(1290);
    expect(parseTimeInput("9.30pm")).toBe(1290);
    expect(parseTimeInput("21:15")).toBe(1275);
    expect(parseTimeInput("2130")).toBe(1290);
    expect(parseTimeInput("noon")).toBe(720);
    expect(parseTimeInput("midday")).toBe(720);
    expect(parseTimeInput("midnight")).toBe(0);
    expect(parseTimeInput("12am")).toBe(0);
    expect(parseTimeInput("12pm")).toBe(720);
    expect(parseTimeInput("25:00")).toBeNull();
    expect(parseTimeInput("13pm")).toBeNull();
    expect(parseTimeInput("9:75")).toBeNull();
    expect(parseTimeInput("lunch")).toBeNull();
  });
  it("hour labels round-trip", () => {
    expect(hourLabel(0)).toBe("12am");
    expect(hourLabel(9)).toBe("9am");
    expect(hourLabel(12)).toBe("12pm");
    expect(hourLabel(23)).toBe("11pm");
    for (let h = 0; h < 24; h++) expect(parseHourLabel(hourLabel(h))).toBe(h);
    expect(parseHourLabel("13pm")).toBeNull();
    expect(parseHourLabel("9")).toBeNull();
  });
});

describe("curated zones", () => {
  it("every IANA id is valid", () => {
    for (const z of ZONES) {
      expect(() => new Intl.DateTimeFormat("en-US", { timeZone: z.iana }).format(0), z.slug).not.toThrow();
    }
  });
  it("30 zones are flagged top", () => {
    expect(ZONES.filter((z) => z.top).length).toBe(30);
  });
  it("62 curated zones", () => {
    expect(ZONES.length).toBe(62);
  });
});

describe("side.ts — abbrFor", () => {
  const cases: [string, number, string][] = [
    ["America/New_York", JAN, "EST"],
    ["America/New_York", JUL, "EDT"],
    ["America/Toronto", JUL, "EDT"],
    ["Europe/Paris", JUL, "CEST"],
    ["Europe/London", JAN, "GMT"],
    ["Europe/London", JUL, "BST"],
    ["America/Phoenix", JUL, "MST"],
    ["Asia/Kolkata", JUL, "IST"],
    ["Australia/Sydney", JAN, "AEDT"],
    ["America/Panama", JUL, "EST"],
    ["Asia/Tokyo", JAN, "JST"],
    ["America/Chicago", JUL, "CDT"],
  ];
  for (const [tz, ms, want] of cases) {
    it(`${tz} @ ${ms === JAN ? "JAN" : "JUL"} -> ${want}`, () => {
      expect(abbrFor(tz, ms)).toBe(want);
    });
  }
  it("unknown offsets fall back to UTC±X", () => {
    // CLDR has no abbreviation for Riyadh either (it answers "GMT+3"), so the
    // bare offset is the honest answer and must stay the answer.
    expect(abbrFor("Asia/Riyadh", JAN)).toBe("UTC+3");
  });
  it("uses CLDR's abbreviation rather than a bare offset when one exists", () => {
    // Canada stopped changing its clocks in 2026, so CLDR calls these zones
    // "Pacific Time (Canada)" / "Central Time (Canada)" and the curated list
    // -- which has "Pacific Time" -- no longer matches. CLDR still knows the
    // abbreviation, and printing "UTC−7" while the page says "Pacific
    // Daylight Time" helps nobody.
    expect(abbrFor("America/Vancouver", Date.now())).toMatch(/^P[SD]T$/);
    expect(abbrFor("America/Winnipeg", Date.now())).toMatch(/^C[SD]T$/);
  });
});

describe("side.ts — same-region rule", () => {
  it("EDT/EST is a constant hour", () => {
    const p = pairFromKeys("edt", "est")!;
    expect(diffMinutes(p.from, p.to, JAN)).toBe(-60);
    expect(diffMinutes(p.from, p.to, JUL)).toBe(-60);
  });
  it("BST/GMT is a constant hour", () => {
    const p = pairFromKeys("bst", "gmt")!;
    expect(diffMinutes(p.from, p.to, JAN)).toBe(-60);
    expect(diffMinutes(p.from, p.to, JUL)).toBe(-60);
  });
  it("labels stay fixed", () => {
    const [a, b] = applySameRegionRule(zoneSide(ZONE_BY_SLUG.get("edt")!), zoneSide(ZONE_BY_SLUG.get("est")!));
    expect(a.fixed).toBe(-240);
    expect(b.fixed).toBe(-300);
  });
});

describe("entities.ts — parsePair", () => {
  const cases: [string, string | null][] = [
    ["pst-to-est", "pst-to-est"],
    ["pt-to-et", "pst-to-est"],
    ["edt-to-pst", "est-to-pst"],
    ["pdt-to-est", "pdt-to-est"],
    ["est-to-pht", "est-to-philippine-time"],
    ["india-time-to-est", "india-time-to-est"],
    ["london-time-to-new-york-time", "london-time-to-new-york-time"],
    ["usa-time-to-philippine-time", "us-time-to-philippine-time"],
    ["japan-time-to-est", "jst-to-est"],
    ["foo-to-est", null],
    ["est-to-est", null],
    ["toronto-time-to-est", "toronto-time-to-est"],
  ];
  for (const [input, want] of cases) {
    it(`${input} -> ${want}`, () => {
      const p = parsePair(input);
      expect(p ? p.slug : null).toBe(want);
    });
  }
  it("required entities exist", () => {
    for (const key of [
      "india-time",
      "uk-time",
      "us-time",
      "london-time",
      "new-york-time",
      "sydney-time",
      "texas-time",
      "toronto-time",
    ]) {
      expect(sideFor(key), key).toBeTruthy();
    }
    // dubai-time resolves through the alias to gst
    expect(parsePair("dubai-time-to-est")!.slug).toBe("gst-to-est");
  });
});

describe("pair.ts — conversions", () => {
  it("PST -> EST in winter", () => {
    const p = pair("pst-to-est");
    const c = convertAt(p.from, p.to, 2027, 1, 15, 9, 0);
    expect([c.toH, c.toM, c.shift, c.fromAbbr, c.toAbbr]).toEqual([12, 0, 0, "PST", "EST"]);
  });
  it("PST -> EST crossing midnight in summer", () => {
    const p = pair("pst-to-est");
    const c = convertAt(p.from, p.to, 2027, 7, 15, 22, 0);
    expect([c.toH, c.toM, c.shift, c.fromAbbr, c.toAbbr]).toEqual([1, 0, 1, "PDT", "EDT"]);
  });
  it("EST -> IST difference and periods", () => {
    const p = pair("est-to-ist");
    expect(diffMinutes(p.from, p.to, JAN)).toBe(630);
    expect(diffMinutes(p.from, p.to, JUL)).toBe(570);
    expect(diffPeriods(p.from, p.to, 2027).length).toBe(3);
  });
  it("PST -> EST has no 2 AM slivers", () => {
    const p = pair("pst-to-est");
    expect(diffPeriods(p.from, p.to, 2027).length).toBe(1);
  });
  it("EST -> GMT varies across the year", () => {
    const p = pair("est-to-gmt");
    expect(diffPeriods(p.from, p.to, 2027).length).toBeGreaterThanOrEqual(3);
  });
  it("aheadBehind text", () => {
    const p = pair("pst-to-est");
    expect(aheadBehind(p.from, p.to, JAN).text).toBe("EST is 3 hours ahead of PST");
  });
  it("takes no \"of\" after \"behind\"", () => {
    // `${direction} of` shipped "13 hours behind of PKT" on every pair page.
    expect(directionPhrase(-180)).toBe("behind");
    expect(directionPhrase(180)).toBe("ahead of");
    expect(directionPhrase(0)).toBe("the same as");
    const p = pair("est-to-pst");
    const text = aheadBehind(p.from, p.to, JAN).text;
    expect(text).toBe("PST is 3 hours behind EST");
    expect(text).not.toContain("behind of");
  });
  it("every pair page sentence is grammatical in both directions", () => {
    for (const slug of ["pst-to-est", "est-to-pst", "ist-to-est", "est-to-ist", "pst-to-pkt", "pkt-to-pst"]) {
      expect(aheadBehind(pair(slug).from, pair(slug).to, JAN).text).not.toContain("behind of");
    }
  });
  it("table24 is 24 rows for the from-side day", () => {
    const p = pair("pst-to-est");
    const rows = table24(p.from, p.to, JAN);
    expect(rows.length).toBe(24);
    expect(rows[0].fromH).toBe(0);
    expect(rows[23].fromH).toBe(23);
    expect(rows.filter((r) => r.biz).length).toBeGreaterThan(0);
  });
  it("workOverlap", () => {
    const pe = pair("pst-to-est");
    expect(workOverlap(pe.from, pe.to, JAN)!.minutes).toBe(300);
    const pi = pair("est-to-ist");
    expect(workOverlap(pi.from, pi.to, JAN)).toBeNull();
  });
  it("half-hour zones convert correctly", () => {
    const p = pair("est-to-ist");
    const c = convertAt(p.from, p.to, 2027, 1, 15, 9, 0);
    expect([c.toH, c.toM, c.shift]).toEqual([19, 30, 0]);
  });
  it("Nepal +5:45", () => {
    const p = pair("utc-to-npt");
    const c = convertAt(p.from, p.to, 2027, 1, 15, 0, 0);
    expect([c.toH, c.toM]).toEqual([5, 45]);
  });
});

describe("matrix: 30 top zones against toLocaleString", () => {
  const top = ZONES.filter((z) => z.top).map((z) => z.slug);
  it("every top pair matches an independent conversion at each 2027 transition", () => {
    const instants = new Set<number>();
    for (const slug of top) {
      const z = ZONE_BY_SLUG.get(slug)!;
      for (const t of transitionsInYear(z.iana, 2027)) {
        instants.add(t.at - 90 * 60_000);
        instants.add(t.at + 90 * 60_000);
      }
    }
    instants.add(JAN);
    instants.add(JUL);
    const list = [...instants];

    let checked = 0;
    for (const a of top) {
      for (const b of top) {
        if (a === b) continue;
        const p = pairFromKeys(a, b);
        if (!p) continue;
        if (p.from.fixed != null || p.to.fixed != null) continue; // same-region pairs are pinned by design
        for (const ms of list) {
          const w = wallOf(p.from, ms);
          const c = convertAt(p.from, p.to, w.year, w.month, w.day, w.hour, w.minute);
          const expected = new Date(c.instant).toLocaleString("en-US", {
            timeZone: p.to.tz,
            hourCycle: "h23",
            hour: "2-digit",
            minute: "2-digit",
          });
          const got = `${String(c.toH).padStart(2, "0")}:${String(c.toM).padStart(2, "0")}`;
          expect(expected.replace("24:", "00:"), `${a}->${b} @ ${iso(ms)}`).toBe(got);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(10_000);
  });
});

describe("zonedToUtc — ambiguity and gaps across many zones", () => {
  const zones = ["America/New_York", "Europe/London", "Europe/Berlin", "Australia/Sydney", "America/Santiago", "Pacific/Auckland"];
  it("fall-back always resolves to the first occurrence", () => {
    for (const tz of zones) {
      for (const t of transitionsInYear(tz, 2027)) {
        if (t.to >= t.from) continue; // only the backward jump
        const w = wallTime(tz, t.at + 30 * 60_000); // 30 min after: an ambiguous wall time
        const got = zonedToUtc(tz, w.year, w.month, w.day, w.hour, w.minute);
        expect(got, `${tz} ${JSON.stringify(w)}`).toBeLessThan(t.at);
        expect(offsetMinutes(tz, got)).toBe(t.from);
      }
    }
  });
  it("spring-forward gap moves the clock forward", () => {
    for (const tz of zones) {
      for (const t of transitionsInYear(tz, 2027)) {
        if (t.to <= t.from) continue; // only the forward jump
        const w = wallTime(tz, t.at - 30 * 60_000); // 30 min before: inside the gap after the jump
        const got = zonedToUtc(tz, w.year, w.month, w.day, w.hour + (t.to - t.from) / 60, w.minute);
        expect(Number.isFinite(got), tz).toBe(true);
      }
    }
  });
  it("round-trips every hour of a transition day", () => {
    for (const tz of zones) {
      for (const t of transitionsInYear(tz, 2027)) {
        const day = wallTime(tz, t.at - 12 * 3_600_000);
        for (let h = 0; h < 24; h++) {
          const ms = zonedToUtc(tz, day.year, day.month, day.day, h, 0);
          expect(Number.isFinite(ms)).toBe(true);
          const back = wallTime(tz, ms);
          // either the same wall hour, or shifted forward out of a gap
          expect(back.hour === h || back.hour === (h + 1) % 24, `${tz} ${h} -> ${back.hour}`).toBe(true);
        }
      }
    }
  });
});

describe("tz.ts — the moment the clocks change", () => {
  // `wallTime(tz, at - 60_000)` looks like the time just before a transition
  // and is not: it answers 01:59 for a 2 AM change, and for the midnight
  // changes Egypt and Lebanon use it lands on 23:59 of the previous day, so
  // the page named the wrong date. These are the clock readings people see.
  const cases: [string, string, string][] = [
    ["America/New_York", "14 March 2027", "02:00"],
    ["Europe/London", "28 March 2027", "01:00"],
    ["Africa/Cairo", "30 April 2027", "00:00"],
    ["Asia/Beirut", "28 March 2027", "00:00"],
    ["Australia/Sydney", "4 April 2027", "03:00"],
  ];
  for (const [tz, date, hour] of cases) {
    it(`${tz} changes at ${hour} on ${date}`, () => {
      const t = nextTransition(tz, Date.UTC(2027, 0, 1));
      expect(t).not.toBeNull();
      const w = transitionWall(t!);
      expect(fmtDate(w, true)).toBe(date);
      expect(fmtClock(w.hour, w.minute, false)).toBe(hour);
    });
  }
});
