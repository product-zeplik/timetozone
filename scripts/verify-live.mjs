#!/usr/bin/env node
/**
 * Does what we just deployed actually reach a reader?
 *
 *   npm run verify:live                       # against production
 *   npm run verify:live -- https://staging...
 *
 * Every other gate in this repo tests the build. This one tests the thing in
 * front of the build, because that is where the failures were:
 *
 *  - A deploy reported tzdata 2026f while still serving Cuba as UTC-5. The
 *    Redis ISR cache used a fixed key for a week, so the new build read the
 *    old build's HTML and served it as its own.
 *  - purge-cdn.mjs carried the comment "run after a deploy" and nothing ran it.
 *  - A quarter-hourly cron schedule was committed to cron/railway.json,
 *    deployed green, and
 *    the service kept running daily, because Railway's
 *    service-level setting wins over the repo file.
 *
 * Each of those looked fixed. Exits non-zero when it is not.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const BASE = (process.argv.find((a) => a.startsWith("http")) || "https://timetozone.com").replace(/\/+$/, "");

let pass = 0;
const fails = [];
const warns = [];
const ok = (cond, label, detail) => (cond ? pass++ : fails.push(`${label}${detail ? ` — ${detail}` : ""}`));

const strip = (t) =>
  t.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
const answerOf = (html) => {
  const m = /<\/h1>([\s\S]{0,400})/.exec(html);
  return m ? strip(m[1]).slice(0, 220) : "";
};
const get = async (p, bust = false) => {
  const u = `${BASE}${p}${bust ? `${p.includes("?") ? "&" : "?"}__fresh=${Date.now()}${Math.random().toString(36).slice(2)}` : ""}`;
  const r = await fetch(u, { headers: { "user-agent": "timetozone-verify-live" } });
  return { status: r.status, headers: r.headers, text: await r.text() };
};

console.log(`verify-live: ${BASE}\n`);

/* ------------------------------------------------------------------ health */
let health = {};
try {
  const r = await get("/api/health");
  health = JSON.parse(r.text);
  ok(health.ok === true, "health reports ok");
  console.log(`  build ${health.builtAt}, node ${health.node}, tzdata ${health.tzdata}`);
} catch (e) {
  ok(false, "health is reachable", e.message);
}

/* ----------------------------------------------------------------- tzdata */
const vendored = readFileSync(new URL("../vendor/icu-tz/VERSION", import.meta.url), "utf8").trim();
ok(health.tzdata === vendored, "the server runs the tzdata this repo vendors", `serving ${health.tzdata}, vendored ${vendored}`);
try {
  const latest = (await fetch("https://data.iana.org/time-zones/tzdb/version", { signal: AbortSignal.timeout(10_000) }).then((r) => r.text())).trim();
  if (latest !== vendored) warns.push(`IANA is on ${latest}, we vendor ${vendored} — run: npm run tzdata:update`);
  else pass++;
} catch (e) {
  warns.push(`could not reach IANA to compare tzdata: ${e.message}`);
}

/* ------------------------------------------------- is this the code we pushed */
try {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", timeout: 10_000 }).trim();
  const dirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8", timeout: 10_000 }).trim();
  if (!health.commit) warns.push("the server does not report a commit — cannot confirm it runs the pushed code");
  else if (dirty) warns.push(`working tree has uncommitted changes; deployed ${health.commit.slice(0, 7)}, local HEAD ${head.slice(0, 7)}`);
  else if (health.commit !== head) {
    const known = (() => {
      try {
        execFileSync("git", ["merge-base", "--is-ancestor", health.commit, head], { timeout: 10_000 });
        return true;
      } catch {
        return false;
      }
    })();
    warns.push(
      known
        ? `deployed ${health.commit.slice(0, 7)} is behind local HEAD ${head.slice(0, 7)} — a deploy is probably still in flight`
        : `deployed ${health.commit.slice(0, 7)} is not an ancestor of local HEAD ${head.slice(0, 7)}`
    );
  } else ok(true, `the server runs the pushed commit ${head.slice(0, 7)}`);
} catch {
  warns.push("git not available — skipping the commit comparison");
}

/* ------------------------------------------------------- the edge vs origin */
// A cache-busted URL misses at the CDN and is answered by the origin. If the
// plain URL says something different, Cloudflare is holding an older build.
// Note what this does and does not prove: the origin may itself answer from
// the ISR cache, so this catches a stale edge, not a stale origin. A stale
// origin is prevented structurally instead -- cache-handler.mjs keys entries
// on the build id, so a deploy cannot read the previous build's HTML -- and
// the commit check above is what confirms the running code is the pushed code.
const PAGES = ["/", "/pst-to-est", "/pst-to-pkt", "/time/usa/san-francisco", "/time/cuba/havana", "/time/canada/vancouver", "/france-time-to-nigeria-time"];
for (const p of PAGES) {
  const [edge, origin] = await Promise.all([get(p), get(p, true)]);
  if (edge.status !== 200 || origin.status !== 200) {
    ok(false, `200 ${p}`, `edge ${edge.status}, origin ${origin.status}`);
    continue;
  }
  const a = answerOf(edge.text);
  const b = answerOf(origin.text);
  ok(a === b, `the edge serves the current build on ${p}`, `edge "${a.slice(0, 70)}" vs origin "${b.slice(0, 70)}"`);
  ok(!/behind of\b/i.test(edge.text), `no "behind of" on ${p}`);
}

/* ------------------------------------------------- committed config vs live */
// cron/railway.json is not authoritative: Railway keeps cronSchedule as a
// service setting and it wins. So compare the two rather than trusting either.
try {
  const want = JSON.parse(readFileSync(new URL("../cron/railway.json", import.meta.url), "utf8")).deploy?.cronSchedule;
  const raw = execFileSync("railway", ["status", "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 30_000 });
  const live = JSON.parse(raw).environments.edges
    .flatMap((e) => e.node.serviceInstances.edges)
    .map((s) => s.node)
    .find((s) => s.cronSchedule);
  if (!live) warns.push("no cron service reported by railway — skipping the schedule comparison");
  else ok(live.cronSchedule === want, "the live cron schedule matches cron/railway.json", `live "${live.cronSchedule}", repo "${want}"`);
} catch {
  warns.push("railway CLI not available or not linked — skipping the config drift check");
}

/* ----------------------------------------------------------------- summary */
console.log(`\n${pass} checks passed`);
for (const w of warns) console.log(`  ! ${w}`);
if (fails.length) {
  console.log(`${fails.length} FAILED:`);
  for (const f of fails) console.log(`  x ${f}`);
  process.exit(1);
}
console.log("verify-live: OK");
