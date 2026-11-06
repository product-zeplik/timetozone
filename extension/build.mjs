#!/usr/bin/env node
/** Bundles the extension into extension/dist and zips it. docs/10. */
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, "dist");

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

await build({
  entryPoints: [join(HERE, "src", "popup.ts"), join(HERE, "src", "background.ts")],
  outdir: DIST,
  bundle: true,
  format: "esm",
  target: "chrome116",
  minify: true,
  sourcemap: false,
  legalComments: "none",
  logLevel: "info",
});

cpSync(join(HERE, "manifest.json"), join(DIST, "manifest.json"));
cpSync(join(HERE, "popup.html"), join(DIST, "popup.html"));
cpSync(join(HERE, "icons"), join(DIST, "icons"), { recursive: true });

const version = JSON.parse(readFileSync(join(HERE, "manifest.json"), "utf8")).version;
const zipName = `timetozone-extension-${version}.zip`;
const zipPath = join(HERE, zipName);
rmSync(zipPath, { force: true });
try {
  execFileSync("zip", ["-qr", zipPath, "."], { cwd: DIST });
} catch {
  console.warn("zip not available; dist/ is ready to load unpacked");
}

const kb = (p) => (existsSync(p) ? `${(statSync(p).size / 1024).toFixed(1)} KB` : "missing");
console.log(`\npopup.js      ${kb(join(DIST, "popup.js"))}`);
console.log(`background.js ${kb(join(DIST, "background.js"))}`);
console.log(`${zipName}  ${kb(zipPath)}`);
console.log(`\nLoad unpacked from: ${DIST}`);
