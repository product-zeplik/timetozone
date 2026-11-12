#!/usr/bin/env node
/**
 * Start the Next server, then purge the CDN once per build.
 *
 * A deploy used to change nothing a reader could see. Cloudflare holds the
 * previous build's HTML for s-maxage (24 h) and serves it stale for far longer,
 * and the Redis ISR cache keeps entries for a week, so a build that fixed a
 * page went on serving the broken one. That is exactly how Cuba stayed an hour
 * wrong and "behind of" stayed on every pair page through a green deploy.
 *
 * The ISR half is handled by keying the cache on the build id (cache-handler.mjs).
 * This handles the edge half: once the new build is actually answering its own
 * health check, purge Cloudflare. Redis SET NX makes it once per build rather
 * than once per replica.
 *
 * It never blocks serving. Every failure here is logged and ignored -- a stale
 * CDN is a bad day, a server that will not boot is a worse one.
 */
import { spawn } from "node:child_process";

const PORT = process.env.PORT || 3000;
const BUILD = await (async () => {
  const { readFileSync } = await import("node:fs");
  for (const f of [".next/BUILD_ID", "./BUILD_ID"]) {
    try {
      const id = readFileSync(f, "utf8").trim();
      if (id) return id;
    } catch {
      /* next location */
    }
  }
  return process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 12) || "dev";
})();

const server = spawn(process.execPath, ["server.js"], { stdio: "inherit", env: process.env });
server.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => server.kill(sig));

/** Only one replica should purge, and only once for this build. */
async function claim() {
  if (!process.env.REDIS_URL) return true; // no coordination available; purging twice is harmless
  try {
    const { createClient } = await import("redis");
    const c = createClient({ url: process.env.REDIS_URL });
    c.on("error", () => {});
    await c.connect();
    const got = await c.set(`ttz:purged:${BUILD}`, new Date().toISOString(), { NX: true, EX: 86400 });
    await c.quit();
    return got === "OK";
  } catch {
    // A missed purge serves stale pages; a duplicate purge costs one API call.
    // When coordination is unavailable, take the duplicate.
    return true;
  }
}

(async () => {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (r.ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (Date.now() >= deadline) return console.log(`serve: health never came up; skipping CDN purge for ${BUILD}`);

  if (!process.env.CF_ZONE_ID || !process.env.CF_API_TOKEN) {
    return console.log(`serve: build ${BUILD} up; no Cloudflare credentials, skipping purge`);
  }
  if (!(await claim())) return console.log(`serve: build ${BUILD} up; another replica is purging`);

  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/purge_cache`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.CF_API_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ purge_everything: true }),
    });
    console.log(`serve: build ${BUILD} up; cloudflare purge ${res.status} ${(await res.text()).slice(0, 120)}`);
  } catch (e) {
    console.error(`serve: cloudflare purge failed for ${BUILD}: ${e.message}`);
  }
})();
