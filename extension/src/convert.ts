/**
 * Pure conversion text for the context-menu toast. No chrome APIs, so the
 * unit tests can import it directly. docs/10.
 */
import { parseSelection } from "./parse";
import { fmtClock, localZone, wallTime, zonedToUtc } from "../../src/engine/tz";
import { abbrFor } from "../../src/engine/side";

export function convert(selection: string, now: number = Date.now()): string {
  const parsed = parseSelection(selection);
  if (!parsed) {
    return "Couldn't read a time and zone. Try selecting something like “3pm EST”.";
  }
  const local = localZone();
  const source = wallTime(parsed.tz, now);
  const instant = zonedToUtc(
    parsed.tz,
    source.year,
    source.month,
    source.day,
    Math.floor(parsed.minutes / 60),
    parsed.minutes % 60
  );
  const mine = wallTime(local, instant);
  const sourceText = `${fmtClock(Math.floor(parsed.minutes / 60), parsed.minutes % 60)} ${abbrFor(parsed.tz, instant)}`;
  const mineText = `${fmtClock(mine.hour, mine.minute)} ${abbrFor(local, instant)}`;
  return `${sourceText} = ${mineText} (your time, ${mine.weekday})`;
}
