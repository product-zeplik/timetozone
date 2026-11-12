#!/usr/bin/env node
/**
 * Pull the current IANA time zone database into vendor/icu-tz/.
 *
 *   node scripts/update-tzdata.mjs          # update to IANA's current release
 *   node scripts/update-tzdata.mjs 2026f    # pin a specific release
 *
 * Node's Intl reads its DST rules from the tzdata compiled into its bundled
 * ICU, so the only way to get a rule change used to be waiting for a Node
 * release. ICU reads these four .res files from ICU_TIMEZONE_FILES_DIR instead
 * when it is set, which is the supported override. We vendor them so a build
 * is hermetic and the repo records exactly which time data we serve.
 *
 * Bump this whenever dst-watch warns that we are behind IANA. A stale tzdb is
 * silently wrong time -- Cuba shipped a full hour out this way.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "vendor", "icu-tz");
/** ICU data format version. Bump only if Node's ICU stops reading format 44. */
const FORMAT = process.env.ICU_DATA_FORMAT || "44";
const FILES = ["zoneinfo64.res", "metaZones.res", "timezoneTypes.res", "windowsZones.res"];

const want = process.argv[2] || (await fetch("https://data.iana.org/time-zones/tzdb/version").then((r) => r.text())).trim();
if (!/^\d{4}[a-z]$/.test(want)) throw new Error(`not a tzdata release: ${want}`);

const base = `https://github.com/unicode-org/icu-data/raw/main/tzdata/icunew/${want}/${FORMAT}/le`;
mkdirSync(OUT, { recursive: true });

for (const f of FILES) {
  const res = await fetch(`${base}/${f}`);
  if (!res.ok) throw new Error(`${f} -> ${res.status} (is ${want} published for ICU format ${FORMAT}?)`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) throw new Error(`${f} came back ${buf.length} bytes — refusing to vendor a truncated file`);
  writeFileSync(join(OUT, f), buf);
  console.log(`  ${f.padEnd(20)} ${buf.length} bytes`);
}
writeFileSync(join(OUT, "VERSION"), `${want}\n`);

// Prove the files actually load before anyone ships them.
const { execFileSync } = await import("node:child_process");
const got = execFileSync(process.execPath, ["-p", "process.versions.tz"], {
  env: { ...process.env, ICU_TIMEZONE_FILES_DIR: OUT },
}).toString().trim();
if (got !== want) throw new Error(`vendored ${want} but Node loads ${got} — the override did not take`);
console.log(`vendor/icu-tz now serves tzdata ${got}`);
