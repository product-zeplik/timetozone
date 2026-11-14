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

// Three more guides, so /guides can be listable (an approved intro and 3 readable pages).
const GUIDES3: Entry[] = ["g-one", "g-two", "g-three"].map((slug, i) => ({ url: `https://timetozone.com/guides/${slug}`, pageType: "guide", locale: "en", lastmod: `2026-11-1${i}` }));
const article = (slug: string) => ({
  contractVersion: 1, site: "timetozone.com", slug, path: `/guides/${slug}`, pageType: "guide", locale: "en",
  title: `Fixture guide ${slug}`, metaDescription: "A fixture guide.", h1: `Fixture guide ${slug}`, bodyHtml: "<p data-answer>Fixture answer.</p>", jsonLd: [],
  author: { name: "Fixture Author", slug: "fixture-author", url: null, bio: null, sameAs: [] }, reviewer: null,
  datePublished: "2026-10-01", dateModified: "2026-11-12", canonical: `https://timetozone.com/guides/${slug}`, robots: "index,follow",
  hreflang: [], breadcrumbs: [{ name: "Home", url: "https://timetozone.com/" }], cta: null, related: [], adsAllowed: false, ymyl: false, volatileFacts: [],
});
const section = (basePath: string, pageType: string, listable: boolean) => ({
  basePath, locale: "en", pageTypes: [pageType], listable, reason: listable ? null : "no approved intro", pages: listable ? 3 : 1, minPages: 3,
  intro: listable ? { title: `Fixture ${basePath} title`, metaDescription: "Fixture section intro.", h1: `Fixture ${basePath}`, introHtml: "<p>Fixture intro.</p>" } : null,
});

function hub(o: { entries?: Entry[]; down?: boolean; controls?: unknown[]; listable?: string[] } = {}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    if (o.down) throw new TypeError("fetch failed");
    const u = String(input);
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
    if (u === `${HUB}/api/public/sitemap/timetozone.com`) return json(o.entries ?? []);
    if (u.startsWith(`${HUB}/api/public/sections/timetozone.com`))
      return json({ contractVersion: 1, site: "timetozone.com", sections: (o.entries?.length ? SECTIONS : []).map(([b, t]) => section(b, t, (o.listable ?? []).includes(b))) });
    const g = /^http:\/\/hub\.test\/api\/public\/content\/timetozone\.com\/([a-z0-9-]+)$/.exec(u);
    if (g && (o.entries ?? []).some((e) => e.url.endsWith(`/guides/${g[1]}`))) return json(article(g[1]));
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
    expect(doc.kit.version).toBe("0.1.12");
    expect(doc.contentRoutes.map((r: { basePath: string; pageTypes: string[] }) => [r.basePath, r.pageTypes.join()])).toEqual(SECTIONS.map(([b, t]) => [b, t]));
    // Every section is hub-only: its index is seo-kit route.IndexPage.
    for (const r of doc.contentRoutes) expect(r.index).toBe(true);
    expect(doc.media).toEqual({ rendered: true, base: null });
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
      // The index is seo-kit's: the hub's intro, a real 404 until listable.
      expect(idx).toMatch(/export const generateMetadata = SECTION\.generateIndexMetadata;/);
      expect(idx).toMatch(/await SECTION\.IndexPage\(props\)/);
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

  it("pages, the copy slot and the hub modules import seo-kit's server entry only (no client JS)", () => {
    const files = ["src/seo.config.ts", "src/seo/page-controls.ts", "src/seo/content-routes.ts", "src/seo/sitemap-data.ts", "src/components/HubCopySlot.tsx", "src/app/.well-known/zeplik-seo.json/route.ts", "src/app/api/seo/revalidate/route.ts"];
    for (const [base] of SECTIONS) files.push(`src/app${base}/page.tsx`, `src/app${base}/[slug]/page.tsx`);
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(/from "@zeplik\/seo-kit(\/next|\/client)?"/);
  });

  it("a section index is a real 404 until the hub says it is listable, then the hub's intro and pages", async () => {
    const run = async (f: ReturnType<typeof hub>) => {
      vi.resetModules();
      vi.stubEnv("ZEPLIK_HUB_URL", HUB);
      vi.stubGlobal("fetch", f);
      const { routeSection } = await import("@/seo/content-routes");
      return routeSection("/guides").route;
    };
    const digest = async (p: Promise<unknown>) => p.then(() => "rendered", (e) => String((e as { digest?: string }).digest ?? e));
    const empty = await run(hub());
    expect(await digest(empty.IndexPage({}))).toContain("404");
    expect(await digest(empty.generateIndexMetadata({}))).toContain("404");
    const thin = await run(hub({ entries: [...ENTRIES, ...GUIDES3] }));
    expect(await digest(thin.IndexPage({}))).toContain("404");
    const listed = await run(hub({ entries: [...ENTRIES, ...GUIDES3], listable: ["/guides"] }));
    const { renderToStaticMarkup } = await import("react-dom/server");
    const html = renderToStaticMarkup(await listed.IndexPage({}));
    expect(html).toContain("<h1>Fixture /guides</h1>");
    for (const g of GUIDES3) expect(html).toContain(`href="${new URL(g.url).pathname}"`);
    const meta = JSON.stringify(await listed.generateIndexMetadata({}));
    expect(meta).toContain("Fixture /guides title");
    expect(meta).toContain("https://timetozone.com/guides");
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
  it("published pages of mounted sections and their listable indexes, lastmod from the hub, in sitemap 0 only", async () => {
    const sm = await load({ ZEPLIK_PAGE_CONTROLS: "off" }, hub({ entries: [...ENTRIES, ...GUIDES3], listable: ["/guides"] }));
    const res0 = await sm.sitemapResponse(0);
    // Request-time sitemap 0: seo-kit's cache header and where its hub rows came from.
    expect(res0.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
    expect(res0.headers.get("x-zeplik-sitemap")).toBe("live");
    const zero = locs(await res0.text());
    expect(zero).toEqual(
      expect.arrayContaining([
        "https://timetozone.com/guides 2026-11-20",
        "https://timetozone.com/guides/how-dst-works 2026-11-20",
        "https://timetozone.com/compare/a-vs-b 2026-11-21",
      ]),
    );
    // /compare has a page but is not listable: its pages are listed, its index is not.
    expect(zero.some((r) => r.startsWith("https://timetozone.com/compare "))).toBe(false);
    const hubRows = zero.filter((r) => /\/(guides|compare|alternatives|best)(\/| )/.test(r));
    expect(hubRows).toHaveLength(6);
    expect((await sm.sitemapResponse(1)).headers.get("cache-control")).toBe("public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400");
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
