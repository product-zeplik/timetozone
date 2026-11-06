import { describe, expect, it } from "vitest";
import { parseSelection } from "../extension/src/parse";
import { convert } from "../extension/src/convert";

describe("parseSelection", () => {
  const ok: [string, number, string][] = [
    ["3pm EST", 900, "America/New_York"],
    ["15:30 CET", 930, "Europe/Berlin"],
    ["9:00 a.m. PT", 540, "America/Los_Angeles"],
    ["10 am IST", 600, "Asia/Kolkata"],
    ["call at 7:45pm (JST) tomorrow", 1185, "Asia/Tokyo"],
  ];
  for (const [input, minutes, tz] of ok) {
    it(`parses "${input}"`, () => {
      const p = parseSelection(input);
      expect(p, input).not.toBeNull();
      expect(p!.minutes).toBe(minutes);
      expect(p!.tz).toBe(tz);
    });
  }

  // Four-digit military forms are deliberately not matched: "in 2024 EST" would
  // otherwise parse as 20:24. docs/10 fixes the regex to 1-2 digit hours.
  const bad = [
    "noon",
    "lunch",
    "",
    "see you later",
    "3pm",
    "tomorrow at midnight",
    "3pm on Monday",
    "9pm BCE",
  ];
  for (const input of bad) {
    it(`rejects "${input}"`, () => {
      expect(parseSelection(input)).toBeNull();
    });
  }
});

describe("convert", () => {
  it("builds a toast with both times", () => {
    const text = convert("3pm EST", Date.UTC(2027, 0, 15, 12));
    expect(text).toMatch(/^3:00 PM EST = /);
    expect(text).toContain("your time");
  });
  it("explains a failure", () => {
    expect(convert("lunch")).toContain("Couldn't read a time and zone");
  });
});
