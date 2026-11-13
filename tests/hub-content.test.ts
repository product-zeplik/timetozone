import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { NextRequest } from "next/server";

/**
 * The hub's receiving ends (engine integration, 13 Nov 2026): the status
 * document, the hub content sections, the hub copy slot on the tool
 * templates, hub pages in sitemap 0, the webhook's section indexes and the
 * AI-crawler hit hook. Every test that loads a module stubs `fetch`, so
 * nothing here reaches a real hub. This suite fails if one of them is removed.
 */

const HUB = "http://hub.test";
const SECTIONS = [
  ["/guides", "guide"],
  ["/compare", "comparison"],
  ["/alternatives", "alternatives"],
  ["/best", "best_of"],
] as const;

type Entry = { url: string; pageType: string; locale: string; lastmod: string };
const ENTRIES: Entry[] = [
  { url: "https://timetozone.com/guides/how-dst-works", pageType: "guide", locale: "en", lastmod: "2026-11-20T10:00:00.000Z" },
  { url: "https://timetozone.com/compare/a-vs-b", pageType: "comparison", locale: "en", lastmod: "2026-11-21" },
  // Ignored: wrong type for the section, unknown section, nested slug, another host, another locale.
  { url: "https://timetozone.com/guides/typed-wrong", pageType: "comparison", locale: "en", lastmod: "2026-11-22" },
  { url: "https://timetozone.com/blog/x", pageType: "guide", locale: "en", lastmod: "2026-11-22" },
  { url: "https://timetozone.com/guides/a/b", pageType: "guide", locale: "en", lastmod: "2026-11-22" },
  { url: "https://evil.example/guides/x", pageType: "guide", locale: "en", lastmod: "2026-11-22" },
  { url: "https://timetozone.com/guides/fr-only", pageType: "guide", locale: "fr", lastmod: "2026-11-22" },
];

function hub(o: { entries?: Entry[]; down?: boolean; controls?: unknown[] } = {}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    if (o.down) throw new TypeError("fetch failed");
    const u = String(input);
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
    if (u === `${HUB}/api/public/sitemap/timetozone.com`) return json(o.entries ?? []);
    if (u === `${HUB}/api/public/page-controls/timetozone.com`)
      return json({ contractVersion: 1, site: "timetozone.com", generatedAt: "2026-11-13T00:00:00Z", version: "t1", controls: o.controls ?? [] });
    return new Response(JSON.stringify({ contractVersion: 1, error: "not found" }), { status: 404 });
  });
}

async function load(env: Record<string, string | undefined>, f: ReturnType<typeof hub>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv("SITE_ENV", "production");
  vi.stubEnv("SITE_URL", "https://timetozone.com");
  vi.stubEnv("ZEPLIK_HUB_URL", HUB);
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as string);
  vi.stubGlobal("fetch", f);
  return import("@/seo/sitemap-data");
}

const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)].map((m) => `${m[1]} ${m[2]}`);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("status document (/.well-known/zeplik-seo.json)", () => {
  it("lists the mounted sections, the copy families and the kit, with no secret", async () => {
    vi.resetModules();
    vi.stubEnv("ZEPLIK_HUB_URL", HUB);
    vi.stubEnv("ZEPLIK_REVALIDATE_SECRET", "test-secret-value-123");
    vi.stubEnv("INDEXNOW_KEY", "abcdef0123456789");
    vi.stubGlobal("fetch", hub());
    const { GET } = await import("@/app/.well-known/zeplik-seo.json/route");
    const res = await GET(new Request("https://timetozone.com/.well-known/zeplik-seo.json"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    const text = await res.text();
    for (const secret of ["test-secret-value-123", "abcdef0123456789", "hub.test", "hub-production"]) expect(text).not.toContain(secret);
    const doc = JSON.parse(text);
    expect(doc.site).toBe("timetozone.com");
    expect(doc.kit.version).toBe("0.1.8");
    expect(doc.contentRoutes.map((r: { basePath: string; pageTypes: string[] }) => [r.basePath, r.pageTypes.join()])).toEqual(SECTIONS.map(([b, t]) => [b, t]));
    expect(doc.toolCopy).toEqual({ rendered: true, families: ["tool", "map", "site"] });
    expect(doc.indexNow.keyPresent).toBe(true);
    expect(doc.pageControls.enabled).toBe(false);
    expect(doc.crawlerHits.enabled).toBe(false);
  });

  it("is not in a sitemap and never reaches the middleware (its matcher skips .json)", async () => {
    const mw = readFileSync("src/middleware.ts", "utf8");
    expect(mw).toMatch(/json\)\$\)\.\*\)/);
    const sm = await load({}, hub({ entries: ENTRIES }));
    for (const id of sm.SITEMAP_IDS) expect(await (await sm.sitemapResponse(id)).text()).not.toContain(".well-known");
  });
});

describe("hub sections", () => {
  it("each section has an index and a [slug] route on the shared route object", () => {
    for (const [base] of SECTIONS) {
      const idx = readFileSync(`src/app${base}/page.tsx`, "utf8");
      expect(idx).toContain(`routeSection("${base}")`);
      const slug = readFileSync(`src/app${base}/[slug]/page.tsx`, "utf8");
      expect(slug).toMatch(/from "@\/seo\/content-routes"/);
      expect(slug).toMatch(/export const revalidate = 3600;/);
      expect(slug).toMatch(/export default \w+\.Page;/);
      // Never prebuilt: hub content must not be able to fail the build-time seo:lint.
      expect(slug).toMatch(/export function generateStaticParams\(\) \{\n  return \[\];\n\}/);
    }
  });

  it("no section base path collides with a keyword-map URL", () => {
    const csv = readFileSync("src/data/keyword-map.csv", "utf8");
    for (const [base] of SECTIONS) expect(csv).not.toMatch(new RegExp(`,${base}(/|,)`));
  });

  it("seo/manifest.json lists every section index, and nothing claims them live while they 404", () => {
    const m = JSON.parse(readFileSync("seo/manifest.json", "utf8"));
    for (const [base, type] of SECTIONS) {
      const f = m.features.find((x: { path: string }) => x.path === base);
      expect(f, base).toBeTruthy();
      expect(f.type).toBe(type);
      expect(f.status).toBe("building");
    }
  });

  it("hub pages carry no ad slot", () => {
    expect(readFileSync("src/seo/content-routes.ts", "utf8")).not.toMatch(/adSlot:/);
  });
});

describe("hub copy slot", () => {
  it("sits after the FAQ on every template with manifest features", () => {
    const tool = readFileSync("src/components/ToolPage.tsx", "utf8");
    expect(tool).toMatch(/<Faq [^\n]*\/>\n\s*\{\/\*[^\n]*\*\/\}\n\s*<HubCopySlot path=\{path\} \/>/);
    expect(readFileSync("src/app/time-zones/page.tsx", "utf8")).toContain('<HubCopySlot path="/time-zones" />');
    expect(readFileSync("src/app/daylight-saving-time/page.tsx", "utf8")).toContain('<HubCopySlot path="/daylight-saving-time" />');
  });

  it("maps every live manifest feature to its own id, and nothing else", async () => {
    const { hubCopyFeature } = await import("@/seo/hub-copy");
    const m = JSON.parse(readFileSync("seo/manifest.json", "utf8"));
    for (const f of m.features) expect(hubCopyFeature(f.path)).toBe(f.status === "live" ? f.id : undefined);
    expect(hubCopyFeature("/pst-to-est")).toBeUndefined();
    expect(hubCopyFeature("/about")).toBeUndefined();
  });

  it("reads the hub with the tool pages' own ISR period, so no page's revalidate changes", () => {
    expect(readFileSync("src/seo/hub.ts", "utf8")).toMatch(/revalidate: 86400/);
    for (const p of ["src/app/page.tsx", "src/app/world-clock/page.tsx", "src/app/time-zones/page.tsx", "src/app/daylight-saving-time/page.tsx"]) {
      expect(readFileSync(p, "utf8")).toMatch(/export const revalidate = 86400;/);
    }
  });
});

describe("sitemap 0 lists hub pages", () => {
  it("published pages of mounted sections and their indexes, lastmod from the hub, in sitemap 0 only", async () => {
    const sm = await load({ ZEPLIK_PAGE_CONTROLS: "off" }, hub({ entries: ENTRIES }));
    const zero = locs(await (await sm.sitemapResponse(0)).text());
    expect(zero).toEqual(
      expect.arrayContaining([
        "https://timetozone.com/guides 2026-11-20",
        "https://timetozone.com/guides/how-dst-works 2026-11-20",
        "https://timetozone.com/compare 2026-11-21",
        "https://timetozone.com/compare/a-vs-b 2026-11-21",
      ]),
    );
    const hubRows = zero.filter((r) => /\/(guides|compare|alternatives|best)(\/| )/.test(r));
    expect(hubRows).toHaveLength(4);
    for (const id of [1, 2, 3, 4]) expect(await (await sm.sitemapResponse(id)).text()).not.toMatch(/\/(guides|compare)\//);
    const index = await (await import("@/app/sitemap.xml/route")).GET();
    expect(await index.text()).toContain("<loc>https://timetozone.com/sitemap-0.xml</loc><lastmod>2026-11-21</lastmod>");
  });

  it("an empty hub adds nothing: sitemap 0 is the code's own list", async () => {
    const sm = await load({}, hub());
    const rows = sm.sitemapEntries(0).map((e) => `${e.url} ${e.lastModified}`);
    expect(locs(await (await sm.sitemapResponse(0)).text())).toEqual(rows);
  });

  it("a hub outage keeps the code's rows and never throws", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const sm = await load({}, hub({ down: true }));
    const rows = sm.sitemapEntries(0).map((e) => `${e.url} ${e.lastModified}`);
    expect(locs(await (await sm.sitemapResponse(0)).text())).toEqual(rows);
  });

  it("page controls still run last, over the hub rows too", async () => {
    const control = { path: "/guides/how-dst-works", match: "exact", action: "exclude", to: null, since: "2026-11-13T00:00:00Z", id: "pc-1" };
    const sm = await load({ ZEPLIK_PAGE_CONTROLS: "on" }, hub({ entries: ENTRIES, controls: [control] }));
    const xml = await (await sm.sitemapResponse(0)).text();
    expect(xml).not.toContain("<loc>https://timetozone.com/guides/how-dst-works</loc>");
    expect(xml).toContain("<loc>https://timetozone.com/compare/a-vs-b</loc>");
  });
});

describe("revalidate webhook", () => {
  it("an article event also refreshes every section index and the sitemaps", async () => {
    const { controlRevalidatePaths } = await load({}, hub());
    const paths = controlRevalidatePaths({ event: "publish", kind: "article", urls: [] });
    for (const [base] of SECTIONS) expect(paths).toContain(base);
    expect(paths).toContain("/sitemap-0.xml");
    expect(controlRevalidatePaths({ event: "update", kind: "tool-copy", urls: [] })).toEqual([]);
  });
});

describe("AI-crawler hits", () => {
  it("the middleware records the response before every return", () => {
    const mw = readFileSync("src/middleware.ts", "utf8");
    const body = mw.slice(mw.indexOf("export async function middleware"), mw.indexOf("function isOffCanonicalHost"));
    const returns = body.match(/\n\s+return /g) ?? [];
    const records = body.match(/hits\.record\(req, \w+, event\);\n\s+return /g) ?? [];
    expect(returns.length).toBeGreaterThanOrEqual(4);
    expect(records).toHaveLength(returns.length);
    expect(mw).toMatch(/from "@\/seo\/crawler-hits"/);
  });

  it("is off unless ZEPLIK_CRAWLER_HITS=on: a crawler request calls nothing", async () => {
    const f = hub();
    await load({ ZEPLIK_CRAWLER_HITS: undefined }, f);
    const { hits } = await import("@/seo/crawler-hits");
    expect(hits.enabled).toBe(false);
    const { middleware } = await import("@/middleware");
    const req = new NextRequest("https://timetozone.com/pst-to-est", { headers: { host: "timetozone.com", "user-agent": "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)" } });
    const res = await middleware(req);
    expect(res.headers.get("x-middleware-next")).toBe("1");
    await hits.flush();
    expect(f).not.toHaveBeenCalled();
  });

  it("CI pins the switch off next to the page-controls pin", () => {
    for (const wf of [".github/workflows/ci.yml", ".github/workflows/seo-check.yml"]) {
      expect(readFileSync(wf, "utf8")).toMatch(/ZEPLIK_PAGE_CONTROLS: "off"\n(?:\s+#[^\n]*\n)?\s+ZEPLIK_CRAWLER_HITS: "off"/);
    }
    expect(existsSync("Dockerfile") && readFileSync("Dockerfile", "utf8")).not.toMatch(/ZEPLIK_CRAWLER_HITS/);
  });
});
