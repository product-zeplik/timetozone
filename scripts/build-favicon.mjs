#!/usr/bin/env node
/**
 * Builds public/favicon.ico from the brand app-icon PNGs.
 *
 * /icon.svg covers modern browsers and adapts to dark mode, but a bare
 * /favicon.ico is still requested by default by browsers, by Google (which
 * shows a favicon beside every search result) and by most link-preview and
 * feed crawlers. Without the file each of those requests 404s.
 *
 * The ICO embeds the PNGs as-is, which every browser since IE11 reads. The
 * light app icon is used because it carries its own white rounded square, so
 * the mark stays visible against dark browser chrome too — the transparent
 * SVG mark would disappear there.
 */
import { readFileSync, writeFileSync } from "node:fs";

const SIZES = [16, 32, 48];
const images = SIZES.map((size) => ({
  size,
  data: readFileSync(new URL(`../public/brand/app-icon-light-${size}.png`, import.meta.url)),
}));

const HEADER = 6;
const ENTRY = 16;
const dir = Buffer.alloc(HEADER + ENTRY * images.length);
dir.writeUInt16LE(0, 0); // reserved
dir.writeUInt16LE(1, 2); // 1 = icon
dir.writeUInt16LE(images.length, 4);

let offset = dir.length;
images.forEach((img, i) => {
  const at = HEADER + ENTRY * i;
  dir.writeUInt8(img.size === 256 ? 0 : img.size, at + 0); // width
  dir.writeUInt8(img.size === 256 ? 0 : img.size, at + 1); // height
  dir.writeUInt8(0, at + 2); // palette size: 0 = truecolour
  dir.writeUInt8(0, at + 3); // reserved
  dir.writeUInt16LE(1, at + 4); // colour planes
  dir.writeUInt16LE(32, at + 6); // bits per pixel
  dir.writeUInt32LE(img.data.length, at + 8);
  dir.writeUInt32LE(offset, at + 12);
  offset += img.data.length;
});

const ico = Buffer.concat([dir, ...images.map((i) => i.data)]);
const out = new URL("../public/favicon.ico", import.meta.url);
writeFileSync(out, ico);
console.log(`favicon.ico: ${SIZES.join(", ")}px — ${(ico.length / 1024).toFixed(1)} KB`);
