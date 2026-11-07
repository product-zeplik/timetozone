import { describe, expect, it } from "vitest";
import { hourPairs, indexedPairs, staticPairs, topPlaces, KEYWORDS, primaryKeyword, rankedPairs } from "@/seo/gate";

describe("indexing gate", () => {
  it("indexedPairs is in the 4-6K range", () => {
    const n = indexedPairs().size;
    console.log("indexedPairs", n);
    expect(n).toBeGreaterThan(3500);
    expect(n).toBeLessThan(9000);
  });
  it("staticPairs is around 880", () => {
    const n = staticPairs().size;
    console.log("staticPairs", n);
    expect(n).toBeGreaterThan(820);
    expect(n).toBeLessThan(1100);
  });
  it("HOUR_PAIRS has 40 entries including the big three", () => {
    const h = hourPairs();
    expect(h.length).toBe(40);
    expect(h).toContain("pst-to-est");
    expect(h).toContain("est-to-ist");
    expect(h).toContain("cst-to-est");
    expect(new Set(h).size).toBe(40);
  });
  it("hour pairs are all indexed", () => {
    for (const h of hourPairs()) expect(indexedPairs().has(h), h).toBe(true);
  });
  it("top places include the ranked countries and big cities", () => {
    const t = topPlaces();
    console.log("topPlaces", t.length);
    expect(t).toContain("india-time");
    expect(t).toContain("us-time");
    expect(t).toContain("uk-time");
    expect(t).toContain("london-time");
    expect(t).toContain("new-york-time");
  });
  it("same-zone pairs are excluded", () => {
    expect(indexedPairs().has("india-time-to-ist")).toBe(false);
    expect(indexedPairs().has("us-time-to-est")).toBe(false);
  });
  it("same-region pairs survive", () => {
    expect(indexedPairs().has("est-to-edt")).toBe(true);
  });
  it("keyword map resolves primaries", () => {
    // The seed map holds 351 researched rows. docs/07 §7 has the monthly loop
    // add rows for queries that earn them, so this is a floor rather than an
    // exact count -- pinning the number made extending the map fail the build.
    expect(KEYWORDS.length).toBeGreaterThanOrEqual(351);
    expect(primaryKeyword("/")!.keyword).toBe("time zone converter");
    expect(primaryKeyword("/pst-to-est")!.keyword).toBe("pst to est");
    expect(primaryKeyword("/time-calculator")!.keyword).toBe("time calculator");
  });
  it("rankedPairs puts the measured pairs first", () => {
    const top = rankedPairs().slice(0, 12);
    console.log("top pairs", top.join(", "));
    expect(top).toContain("pst-to-est");
  });
});
