#!/usr/bin/env node
/**
 * The AdSense programme requirements that can be checked from outside, run
 * against the live site. "Approved once" is not the bar: policy compliance has
 * to hold on every deploy, and most of these break silently -- an ads.txt
 * overwritten by a build, a consent message unpublished, a robots rule that
 * quietly shuts out the ad crawler.
 *
 *   node scripts/adsense-check.mjs [baseUrl]
 *
 * It cannot see approval status or anything inside the AdSense console; those
 * stay manual. Exits 1 on any failure.
 */
const BASE = (process.argv[2] || "https://timetozone.com").replace(/\/+$/, "");
const PUB = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-7026096193684009";
const PUB_ID = PUB.replace(/^ca-/, "");

let failed = 0;
const check = (ok, label, detail = "") => {
  console.log(`  ${ok ? "ok" : "x "} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
};

async function get(path, ua) {
  const r = await fetch(BASE + path, { headers: ua ? { "user-agent": ua } : {}, redirect: "follow" });
  return { status: r.status, text: await r.text(), headers: r.headers };
}

console.log(`adsense-check: ${BASE}\n`);

/* ads.txt ----------------------------------------------------------------- */
{
  const r = await get("/ads.txt");
  check(r.status === 200, "/ads.txt returns 200", String(r.status));
  const line = r.text
    .split("\n")
    .map((l) => l.split("#")[0].trim())
    .filter(Boolean)
    .map((l) => l.split(",").map((c) => c.trim()));
  const row = line.find((c) => c[0] === "google.com" && c[1] === PUB_ID);
  check(Boolean(row), "ads.txt authorises this publisher", row ? row.join(", ") : `no google.com, ${PUB_ID} row`);
  check(row?.[2] === "DIRECT", "the relationship is DIRECT", row?.[2] ?? "—");
  // Google's own TAG id. A wrong one invalidates the record.
  check(row?.[3] === "f08c47fec0942fa0", "Google's certification id is present", row?.[3] ?? "—");
}

/* the ad script actually in the served HTML ------------------------------- */
{
  const r = await get("/");
  const hasTag = new RegExp(`<script[^>]+adsbygoogle\\.js\\?client=${PUB}`).test(r.text);
  check(hasTag, "the AdSense tag is server-rendered into the HTML", hasTag ? PUB : "not found in raw HTML");
  check(
    /<meta name="google-adsense-account" content="ca-pub-/.test(r.text),
    "the google-adsense-account meta tag is present"
  );
}

/* the crawlers that decide approval --------------------------------------- */
for (const ua of ["Mediapartners-Google", "AdsBot-Google", "Googlebot"]) {
  const r = await get("/pst-to-est", ua);
  check(r.status === 200, `${ua} can fetch a content page`, String(r.status));
}

/* robots.txt must not shut the ad crawler out ----------------------------- */
{
  const r = await get("/robots.txt");
  const blocked = /User-Agent:\s*(Mediapartners-Google|AdsBot-Google)[\s\S]*?Disallow:\s*\/\s*$/im.test(r.text);
  check(!blocked, "robots.txt does not disallow the ad crawlers");
}

/* the pages a reviewer looks for ------------------------------------------ */
for (const [path, min] of [["/about", 150], ["/contact", 100], ["/privacy", 400], ["/terms", 300]]) {
  const r = await get(path);
  const words = r.text
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  check(r.status === 200 && words >= min, `${path} exists with real content`, `${r.status}, ${words} words`);
}

/* the disclosures the policy requires ------------------------------------- */
{
  const r = await get("/privacy");
  const t = r.text.toLowerCase();
  for (const [needle, label] of [
    ["adsense", "names Google AdSense"],
    ["cookie", "explains cookies"],
    ["consent", "covers consent"],
    ["opt out", "gives an opt-out"],
  ]) {
    check(t.includes(needle), `the privacy policy ${label}`);
  }
}

console.log(
  failed
    ? `\n${failed} requirement(s) failing — fix before the next review\n`
    : "\nadsense-check: every externally checkable requirement is met\n"
);
console.log("Not checkable from here: approval status, the EEA consent message, policy-centre notices.");
process.exit(failed ? 1 : 0);
