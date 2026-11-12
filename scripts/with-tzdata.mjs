#!/usr/bin/env node
/**
 * Run a command with ICU_TIMEZONE_FILES_DIR pointed at vendor/icu-tz.
 *
 *   node scripts/with-tzdata.mjs next build
 *
 * Builds bake UTC offsets into static HTML, so a build running on different
 * tzdata than the server produces pages that are wrong the moment they are
 * served. This keeps local builds, tests and the Docker stages on the one
 * vendored copy. The Dockerfile sets the same variable directly.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "vendor", "icu-tz");
const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("usage: node scripts/with-tzdata.mjs <command> [args...]");
  process.exit(1);
}
if (!existsSync(join(DIR, "zoneinfo64.res"))) {
  console.error(`vendor/icu-tz is missing — run: node scripts/update-tzdata.mjs`);
  process.exit(1);
}
const child = spawn(cmd, args, {
  stdio: "inherit",
  env: { ...process.env, ICU_TIMEZONE_FILES_DIR: DIR },
  shell: process.platform === "win32",
});
child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
