#!/usr/bin/env node
/**
 * Daily cron (00:05 UTC). If any representative zone changes its offset within
 * the next 48 hours or changed in the last 24, revalidate every page and purge
 * the Cloudflare cache. docs/12 §12.6.
 */
const SITE_URL = (process.env.SITE_URL || "https://timetozone.com").replace(/\/+$/, "");
const SECRET = process.env.REVALIDATE_SECRET || "";
const CF_ZONE_ID = process.env.CF_ZONE_ID || "";
const CF_API_TOKEN = process.env.CF_API_TOKEN || "";
const FORCE = process.argv.includes("--force");

const ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Halifax",
  "America/St_Johns",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Athens",
  "Europe/Lisbon",
  "Australia/Sydney",
  "Australia/Adelaide",
  "Pacific/Auckland",
  "America/Santiago",
  "America/Mexico_City",
  "Asia/Tehran",
  "Asia/Jerusalem",
  "Africa/Cairo",
  "America/Havana",
  "America/Asuncion",
  "Africa/Casablanca",
];

const offset = (tz, ms) => {
  const raw = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
    .formatToParts(ms)
    .find((p) => p.type === "timeZoneName").value;
  return raw;
};

const now = Date.now();
const HOUR = 3_600_000;
const changed = [];
for (const tz of ZONES) {
  const before = offset(tz, now - 24 * HOUR);
  const current = offset(tz, now);
  const ahead = offset(tz, now + 48 * HOUR);
  if (before !== current || current !== ahead) {
    changed.push(`${tz}: ${before} -> ${current} -> ${ahead}`);
  }
}

console.log(`dst-watch ${new Date(now).toISOString()} — tzdata ${process.versions.tz}`);
if (!changed.length && !FORCE) {
  console.log("no transition within the window; nothing to do");
  process.exit(0);
}
for (const line of changed) console.log(`  transition: ${line}`);

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
