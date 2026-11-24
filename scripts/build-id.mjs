// Stable Next.js build id: the same commit, built with the same build-time
// inputs, always gives the same id (and so the same output).
//
// Next's default is a random id per `next build`, so two builds of one commit
// disagreed about /_next/static/<buildId>/... and about the build id every RSC
// payload carries. Chunk FILE names do not depend on it (they are content
// hashes), but nothing about a deploy should be random. Used by
// next.config.mjs (generateBuildId); scripts/static-carry.mjs explains why.
//
// The id also namespaces the Redis ISR cache (cache-handler.mjs) and the
// once-per-build CDN purge (scripts/serve.mjs). That is why the hash covers
// every build-time input the Dockerfile bakes into HTML or JS (the ARGs there,
// NEXT_PUBLIC_* and the site settings read at module scope in src/site.ts), not
// only NEXT_PUBLIC_*: changing one of them and redeploying the same commit
// still gives a new id, so a fresh cache namespace and a purge, as before. A
// redeploy of the same commit with the same inputs builds the same pages and
// keeps the id; that is the point.
//
// Commit, first that answers: RAILWAY_GIT_COMMIT_SHA (Railway build; an ARG in
// the Dockerfile), GITHUB_SHA (CI), `git rev-parse HEAD` (local). With none,
// null: Next falls back to its random id, exactly as before.
//
// Hex a-f are shifted to g-l: Next refuses its OWN random ids that contain "ad"
// (ad blockers match it in /_next/static/<id>/ URLs) but does not check one we
// return, and a hex sha contains "ad" often.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

/** Build-time inputs besides NEXT_PUBLIC_* (Dockerfile ARGs, src/site.ts). */
const BUILD_INPUTS = ["SITE_URL", "SITE_ENV", "GOOGLE_SITE_VERIFICATION", "BING_SITE_VERIFICATION", "INDEXNOW_KEY"];

function commitSha() {
  for (const name of ["RAILWAY_GIT_COMMIT_SHA", "GITHUB_SHA"]) {
    const v = process.env[name];
    if (v && /^[0-9a-f]{7,40}$/i.test(v)) return { sha: v.toLowerCase(), source: name };
  }
  try {
    const sha = execFileSync("git", ["rev-parse", "HEAD"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    if (/^[0-9a-f]{40}$/.test(sha)) return { sha, source: "git rev-parse HEAD" };
  } catch {
    // no git in this build environment (.git is not in the Docker context)
  }
  return null;
}

const noAd = (hex) => hex.replace(/[a-f]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 6));

/** @returns {string | null} */
export function stableBuildId() {
  const commit = commitSha();
  if (!commit) {
    console.log("[build-id] no commit sha available: Next picks a random build id");
    return null;
  }
  // Names and values go into the hash; only the hash is printed.
  const inputs = Object.keys(process.env)
    .filter((k) => k.startsWith("NEXT_PUBLIC_") || BUILD_INPUTS.includes(k))
    .sort()
    .map((k) => `${k}=${process.env[k]}`)
    .join("\n");
  const inputHash = createHash("sha256").update(inputs).digest("hex").slice(0, 6);
  const id = `${noAd(commit.sha.slice(0, 12))}-${noAd(inputHash)}`;
  console.log(`[build-id] ${id} (commit ${commit.sha.slice(0, 12)} from ${commit.source})`);
  return id;
}
