/**
 * Template changes held by a Google update (engine rulebook 11.2 rules 5 and 7).
 *
 * The November 2026 core update began on 10 Nov 2026 and is still rolling out. Pair and hour pages had impressions in
 * the last 28 days, so a template change to them waits until the update has completed and seven more days have
 * passed, and when it ships it ships behind a per-site flag. The computed per-page value blocks (src/content/value.ts,
 * src/components/ValueBlocks.tsx) are merged to main behind this flag and are OFF in production.
 *
 * How it flips: the engine reads the update state every day (sites/timezone.yaml held_changes in the engine repo).
 * The day the freeze is over it opens a P1 repo task with the exact step: set TEMPLATE_V2 below to true in a commit,
 * run `npm run content-dates` (the flip is the content change, so pair and hour lastmod, dateModified and the visible
 * "Updated" line move with it, and only then), run the checks in CLAUDE.md, push, and verify the deploy. Flipping it
 * by an environment variable on Railway would change every page without moving its dates (GR-36), so production
 * never reads one.
 *
 * TTZ_TEMPLATE_V2=on|off overrides the constant only outside production (tests, local builds, previews), so both
 * states can be measured and tested before the flip.
 */
export const TEMPLATE_V2 = false;

/** The data-template-version the flagged template carries on its main content (the engine's repo task reads it). */
export const TEMPLATE_V2_VERSION = "pair-v2";

export function templateV2(): boolean {
  const env = process.env.TTZ_TEMPLATE_V2;
  if (process.env.SITE_ENV === "production" && process.env.TTZ_TEMPLATE_V2_LOCAL !== "1") return TEMPLATE_V2;
  if (env === "on") return true;
  if (env === "off") return false;
  return TEMPLATE_V2;
}
