// Keep earlier deploys' /_next/static files alive after a deploy.
//
// Why: HTML is cached long. Live headers (24 Nov 2026): `max-age=14400,
// s-maxage=86400, stale-while-revalidate=31449600`, Cloudflare HIT at ages of
// 42-44k s. A browser keeps a page for 4 hours and the edge for a day, and a
// stale copy can still be served once after that while the edge revalidates.
// That HTML names the content-hashed chunks of ITS build. Each Railway deploy
// is a fresh image holding only the new build's .next/static, so any chunk
// whose content changed answers 404 and that page's scripts (the converter,
// the clocks) never load. Measured on optipix.art the same day (a cached
// page named a page chunk the new deploy no longer had); the same code ran
// there first (optipix commit 98729756).
//
// How (no volume, no Railway or Cloudflare setting, no purge):
//
//   build  `fetchPrevious()` runs inside `next build` (from generateBuildId in
//          next.config.mjs, which Next calls exactly once per build). It reads
//          the live site's /static-assets.json, the index the running deploy
//          was built with, and downloads every file listed there that was
//          still part of a deploy within RETAIN_DAYS into .static-carry/.
//          Fail-open: any error is logged and the build goes on.
//   image  `merge` (a RUN step in the Dockerfile build stage, after the build
//          and its checks) copies .static-carry/ into .next/standalone/.next/
//          static WITHOUT touching the new build's files, and writes
//          .next/standalone/public/static-assets.json: this build's files
//          stamped now, plus the carried ones with the date they were last
//          part of a deploy. The run stage copies the standalone tree first and
//          the build's own .next/static and public over it, so the image holds
//          both sets before the server starts (Next lists .next/static once at
//          boot). Done in the image, every replica and every restart serves
//          exactly the same files.
//
// So each deploy carries the last RETAIN_DAYS of chunks forward, and a chunk
// drops out RETAIN_DAYS after the last deploy that built it. RETAIN_DAYS (30)
// is far longer than HTML stays fresh anywhere (4 h browser, 1 day edge) and
// covers the stale copy Cloudflare may serve once while it revalidates a
// rarely visited page. Chunk names are content hashes, so carrying a file
// never changes what a current page loads.
//
// Enabled for the build only when STATIC_CARRY_ORIGIN is set (an origin, or
// "off"), or on the Railway production environment (RAILWAY_ENVIRONMENT_NAME,
// an ARG in the Dockerfile; origin https://timetozone.com). CI and local
// builds never read the live site.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const RETAIN_DAYS = 30;
export const INDEX_FILE = "static-assets.json";
const CARRY_DIR = ".static-carry";
const CARRY_INDEX = ".carry-index.json";
const PROD_ORIGIN = "https://timetozone.com";
const MAX_FILES = 20000;
const MAX_BYTES = 600 * 1024 * 1024;
const TOTAL_BUDGET_MS = 180_000;
const CONCURRENCY = 12;
const DAY_MS = 86_400_000;

const log = (...a) => console.log("[static-carry]", ...a);

function carryOrigin() {
  const explicit = process.env.STATIC_CARRY_ORIGIN;
  if (explicit) return explicit === "off" ? null : explicit.replace(/\/+$/, "");
  const env = process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_ENVIRONMENT;
  return env === "production" ? PROD_ORIGIN : null;
}

/** A relative path under .next/static that is safe to write and to request. */
function safeRel(rel) {
  if (typeof rel !== "string" || rel.length === 0 || rel.length > 400) return false;
  if (rel.startsWith("/") || rel.includes("\\") || rel.includes("\0")) return false;
  if (rel.split("/").some((seg) => seg === "" || seg === "." || seg === "..")) return false;
  return /^[A-Za-z0-9_\-.[\]@()+~%/]+$/.test(rel);
}

function walk(dir, base = dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, base, out);
    else if (e.isFile()) out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

/**
 * Build time: download the files the live deploy still serves (its own and
 * the ones it carried) into <appDir>/.static-carry. Never throws.
 */
export async function fetchPrevious(appDir = process.cwd()) {
  const origin = carryOrigin();
  const dest = path.join(appDir, CARRY_DIR);
  try {
    fs.rmSync(dest, { recursive: true, force: true });
    if (!origin) {
      log("off for this build (STATIC_CARRY_ORIGIN unset or \"off\", and not Railway production)");
      return;
    }
    const started = Date.now();
    const deadline = started + TOTAL_BUDGET_MS;
    const indexUrl = `${origin}/${INDEX_FILE}?build=${started}`;
    const res = await fetch(indexUrl, {
      headers: { "user-agent": "timetozone-build-static-carry" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      log(`no index at ${origin}/${INDEX_FILE} (HTTP ${res.status}); nothing carried`);
      return;
    }
    const index = await res.json();
    const files = index && typeof index.files === "object" ? index.files : null;
    if (!files) {
      log("index has no files; nothing carried");
      return;
    }
    const cutoff = started - RETAIN_DAYS * DAY_MS;
    const wanted = [];
    let bytes = 0;
    for (const [rel, meta] of Object.entries(files)) {
      const seen = Date.parse(meta?.lastSeen);
      if (!safeRel(rel) || !Number.isFinite(seen) || seen < cutoff) continue;
      if (!Number.isInteger(meta.size) || meta.size < 0) continue;
      if (wanted.length >= MAX_FILES || bytes + meta.size > MAX_BYTES) break;
      wanted.push([rel, meta]);
      bytes += meta.size;
    }
    log(`index from ${origin}: ${Object.keys(files).length} files listed, ${wanted.length} within ${RETAIN_DAYS} days (${(bytes / 1048576).toFixed(1)} MB)`);

    const kept = {};
    let ok = 0;
    let failed = 0;
    let next = 0;
    async function worker() {
      while (next < wanted.length && Date.now() < deadline) {
        const [rel, meta] = wanted[next++];
        const url = `${origin}/_next/static/${rel.split("/").map((s) => encodeURIComponent(decodeURIComponentSafe(s))).join("/")}`;
        try {
          const r = await fetch(url, {
            headers: { "user-agent": "timetozone-build-static-carry" },
            signal: AbortSignal.timeout(30_000),
          });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length !== meta.size) throw new Error(`size ${buf.length} != ${meta.size}`);
          if (meta.sha256 && createHash("sha256").update(buf).digest("hex") !== meta.sha256) {
            throw new Error("sha256 mismatch");
          }
          const out = path.join(dest, "static", ...rel.split("/"));
          fs.mkdirSync(path.dirname(out), { recursive: true });
          fs.writeFileSync(out, buf);
          kept[rel] = meta;
          ok++;
        } catch (err) {
          failed++;
          if (failed <= 10) log(`skip ${rel}: ${err?.message ?? err}`);
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    const left = wanted.length - ok - failed;
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, CARRY_INDEX), JSON.stringify({ origin, fetchedAt: new Date(started).toISOString(), files: kept }));
    log(`carried ${ok} files, ${failed} failed, ${left} not tried (time budget) in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  } catch (err) {
    log(`failed, nothing carried: ${err?.message ?? err}`);
  }
}

function decodeURIComponentSafe(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Image build: add the carried files to the standalone .next/static (never
 * overwriting this build's files) and write the index the next build reads.
 */
export function merge(standaloneDir, appDir = process.cwd()) {
  const now = new Date();
  const staticDir = path.join(standaloneDir, ".next", "static");
  const carryStatic = path.join(appDir, CARRY_DIR, "static");
  // This build's files, read from the build output itself, not from the
  // standalone copy (which holds the carried ones).
  const own = walk(path.join(appDir, ".next", "static"));
  const files = {};
  for (const rel of own) {
    const full = path.join(appDir, ".next", "static", ...rel.split("/"));
    files[rel] = { size: fs.statSync(full).size, lastSeen: now.toISOString() };
  }

  let carriedIndex = {};
  try {
    carriedIndex = JSON.parse(fs.readFileSync(path.join(appDir, CARRY_DIR, CARRY_INDEX), "utf8")).files ?? {};
  } catch {
    // no carry for this build
  }
  const cutoff = now.getTime() - RETAIN_DAYS * DAY_MS;
  let added = 0;
  let carried = 0;
  for (const rel of walk(carryStatic)) {
    if (files[rel]) continue; // this build has it: same name, same content hash
    const meta = carriedIndex[rel];
    const seen = Date.parse(meta?.lastSeen);
    if (!safeRel(rel) || !Number.isFinite(seen) || seen < cutoff) continue;
    const src = path.join(carryStatic, ...rel.split("/"));
    const dst = path.join(staticDir, ...rel.split("/"));
    if (!fs.existsSync(dst)) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      added++;
    }
    files[rel] = { size: fs.statSync(src).size, lastSeen: meta.lastSeen };
    carried++;
  }

  let buildId = null;
  try {
    buildId = fs.readFileSync(path.join(appDir, ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    // not fatal
  }
  const index = {
    version: 1,
    generatedAt: now.toISOString(),
    buildId,
    retainDays: RETAIN_DAYS,
    files,
  };
  const publicDir = path.join(standaloneDir, "public");
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, INDEX_FILE), JSON.stringify(index));
  log(`this build ${own.length} files, carried ${carried} from earlier deploys (${added} copied); index ${Object.keys(files).length} files`);
}

// CLI: node scripts/static-carry.mjs merge <standaloneDir>
//      node scripts/static-carry.mjs fetch
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "merge" && arg) merge(arg);
  else if (cmd === "fetch") await fetchPrevious();
  else {
    console.error("usage: static-carry.mjs merge <standaloneDir> | fetch");
    process.exit(2);
  }
}
