#!/usr/bin/env node
/**
 * Runs every 15 minutes. If any zone we can serve changed its UTC offset in the
 * last few minutes, revalidate every page and purge the Cloudflare cache.
 *
 * Why so often. Offsets are baked into statically generated HTML, so between a
 * DST transition and the next purge the whole site states the old offset: San
 * Francisco reads UTC-7 when it is already UTC-8, and "13 hours ahead of
 * Karachi" renders as 12. On a daily schedule that window was up to ~24 hours,
 * and it lands exactly when people check -- the hour the clocks move. A tiny
 * container a few times an hour is the cheapest part of this system.
 *
 * It also watches two things that used to pass silently:
 *  - the UTC year rolling over, because the DST tables are built per calendar
 *    year and go stale the instant it changes;
 *  - our tzdata falling behind IANA, which is where DST truth actually lives.
 *    A stale tzdb is wrong time that no test of ours can catch. docs/12 §12.6.
 */
const SITE_URL = (process.env.SITE_URL || "https://timetozone.com").replace(/\/+$/, "");
const SECRET = process.env.REVALIDATE_SECRET || "";
const CF_ZONE_ID = process.env.CF_ZONE_ID || "";
const CF_API_TOKEN = process.env.CF_API_TOKEN || "";
const FORCE = process.argv.includes("--force");
/** Slightly longer than the cron interval, so a transition is never stepped over. */
const LOOKBACK_MIN = Number(process.env.DST_LOOKBACK_MIN || 20);

/**
 * Every zone this runtime knows, not a curated list: we publish pages for 307
 * of them and a hand-maintained list silently stops covering whatever was added
 * last. Falls back to the representative set on a runtime without the API.
 */
const ZONES =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Australia/Sydney", "Pacific/Auckland", "America/Santiago", "Asia/Tehran", "Asia/Jerusalem", "America/Havana"];

const offset = (tz, ms) =>
  new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
    .formatToParts(ms)
    .find((p) => p.type === "timeZoneName").value;

const now = Date.now();
const MIN = 60_000;
const back = now - LOOKBACK_MIN * MIN;

const moved = [];
for (const tz of ZONES) {
  try {
    const before = offset(tz, back);
    const current = offset(tz, now);
    if (before !== current) moved.push(`${tz}: ${before} -> ${current}`);
  } catch {
    /* a zone this ICU cannot format is not one we can serve */
  }
}
const yearRolled = new Date(back).getUTCFullYear() !== new Date(now).getUTCFullYear();

console.log(`dst-watch ${new Date(now).toISOString()} — tzdata ${process.versions.tz}, ${ZONES.length} zones, ${LOOKBACK_MIN}m lookback`);

/* --------------------------------------------------- tzdata freshness alarm */
// Not fatal, and deliberately not tied to the exit code: a purge failure and a
// stale tzdb are different problems and must stay separately legible.
try {
  const res = await fetch("https://data.iana.org/time-zones/tzdb/version", { signal: AbortSignal.timeout(10_000) });
  const latest = (await res.text()).trim();
  let serving = process.versions.tz;
  try {
    const h = await fetch(`${SITE_URL}/api/health`, { signal: AbortSignal.timeout(10_000) }).then((r) => r.json());
    serving = h.tzdata || serving;
  } catch {
    /* fall back to this container's own tzdata */
  }
  if (latest && serving && latest !== serving) {
    console.warn(`WARNING: serving tzdata ${serving}, IANA current is ${latest} — rebuild on a newer node image to pick up rule changes`);
  } else {
    console.log(`tzdata ${serving} matches IANA current`);
  }
} catch (e) {
  console.log(`tzdata freshness check skipped: ${e.message}`);
}

if (!moved.length && !yearRolled && !FORCE) {
  console.log("no offset moved in the window; nothing to do");
  process.exit(0);
}
for (const line of moved) console.log(`  transition: ${line}`);
if (yearRolled) console.log("  UTC year rolled over — per-year DST tables must be rebuilt");

let failed = false;

if (!SECRET) {
  console.error("REVALIDATE_SECRET is not set — skipping revalidation");
  failed = true;
} else {
  try {
    const res = await fetch(`${SITE_URL}/api/revalidate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-revalidate-secret": SECRET },
      body: JSON.stringify({ all: true }),
    });
    console.log(`revalidate: ${res.status} ${(await res.text()).slice(0, 200)}`);
    if (!res.ok) failed = true;
  } catch (e) {
    console.error(`revalidate failed: ${e.message}`);
    failed = true;
  }
}

if (CF_ZONE_ID && CF_API_TOKEN) {
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache`, {
      method: "POST",
      headers: { authorization: `Bearer ${CF_API_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ purge_everything: true }),
    });
    console.log(`cloudflare purge: ${res.status} ${(await res.text()).slice(0, 200)}`);
    if (!res.ok) failed = true;
  } catch (e) {
    console.error(`cloudflare purge failed: ${e.message}`);
    failed = true;
  }
} else {
  console.log("CF_ZONE_ID/CF_API_TOKEN not set — skipping Cloudflare purge");
}

process.exit(failed ? 1 : 0);
