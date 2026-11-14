import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import type { PageControl } from "@zeplik/core";

/**
 * Hub page controls (src/seo/page-controls.ts). The middleware and sitemap
 * modules are imported fresh per test, because the control source reads
 * ZEPLIK_PAGE_CONTROLS once, when the module loads -- as it does in a server.
 */

const c = (p: Partial<PageControl> & Pick<PageControl, "path" | "action">): PageControl => ({
  match: "exact",
  to: null,
  since: "2026-11-13T00:00:00Z",
  id: `pc-${p.path}`,
  ...p,
});
const SET: PageControl[] = [
  c({ path: "/zones/acst", action: "gone" }),
  c({ path: "/zones/acdt", action: "redirect", to: "/zones/awst" }),
  c({ path: "/zones/aest", action: "noindex" }),
  c({ path: "/zones/aedt", action: "exclude" }),
];
const HUB = "http://hub.test";
const req = (path: string) => new NextRequest(`https://timetozone.com${path}`, { headers: { host: "timetozone.com" } });

function hubFetch(controls: PageControl[]) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const u = String(input);
    if (u === `${HUB}/api/public/page-controls/timetozone.com`) {
      return new Response(
        JSON.stringify({ contractVersion: 1, site: "timetozone.com", generatedAt: "2026-11-13T00:00:00Z", version: "t1", controls }),
        { status: 200 },
      );
    }
    return new Response("not found", { status: 404 });
  });
}

async function load(env: Record<string, string | undefined>, fetchImpl?: ReturnType<typeof hubFetch>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv("SITE_ENV", "production");
  vi.stubEnv("SITE_URL", "https://timetozone.com");
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as string);
  if (fetchImpl) vi.stubGlobal("fetch", fetchImpl);
  const mw = await import("@/middleware");
  const sm = await import("@/seo/sitemap-data");
  return { mw, sm };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("page controls", () => {
  it("contract version in the stub matches core", async () => {
    const { CONTRACT_VERSION } = await import("@zeplik/core");
    expect(CONTRACT_VERSION).toBe(1);
  });

  it("is OFF by default: no hub call, responses and sitemaps unchanged", async () => {
    const f = hubFetch(SET);
    const { mw, sm } = await load({ ZEPLIK_PAGE_CONTROLS: undefined, ZEPLIK_HUB_URL: HUB }, f);
    for (const p of SET.map((x) => x.path)) {
      const res = await mw.middleware(req(p));
      expect(res.status).toBe(200);
      expect(res.headers.get("x-middleware-next")).toBe("1");
      expect(res.headers.get("x-robots-tag")).toBeNull();
      expect(res.headers.get("x-zeplik-control")).toBeNull();
    }
    // The middleware asks the hub nothing at all while controls are off.
    expect(f).not.toHaveBeenCalled();
    const xml = await (await sm.sitemapResponse(0)).text();
    for (const p of SET.map((x) => x.path)) expect(xml).toContain(`<loc>https://timetozone.com${p}</loc>`);
    // Sitemap 0 reads the hub's published pages (tests/hub-content.test.ts), never the control set.
    expect(f.mock.calls.filter(([u]) => String(u).includes("/api/public/page-controls/"))).toHaveLength(0);
  });

  it("with a control set: gone -> 410, redirect -> 301, noindex -> header, all four leave the sitemap", async () => {
    const f = hubFetch(SET);
    const { mw, sm } = await load({ ZEPLIK_PAGE_CONTROLS: "on", ZEPLIK_HUB_URL: HUB }, f);

    const gone = await mw.middleware(req("/zones/acst"));
    expect(gone.status).toBe(410);
    expect(gone.headers.get("x-zeplik-control")).toBe("gone:pc-/zones/acst");

    const moved = await mw.middleware(req("/zones/acdt?x=1"));
    expect(moved.status).toBe(301);
    expect(moved.headers.get("location")).toBe("https://timetozone.com/zones/awst?x=1");

    const noindex = await mw.middleware(req("/zones/aest"));
    expect(noindex.headers.get("x-middleware-next")).toBe("1");
    expect(noindex.headers.get("x-robots-tag")).toBe("noindex, follow");
    expect(noindex.headers.get("x-zeplik-control")).toBe("noindex:pc-/zones/aest");

    // exclude: still served and indexable, only out of the sitemap.
    const excluded = await mw.middleware(req("/zones/aedt"));
    expect(excluded.headers.get("x-middleware-next")).toBe("1");
    expect(excluded.headers.get("x-robots-tag")).toBeNull();

    // Uppercase still lowercases first; an uncontrolled page is untouched.
    expect((await mw.middleware(req("/Zones/ACST"))).status).toBe(301);
    expect((await mw.middleware(req("/zones/est"))).headers.get("x-robots-tag")).toBeNull();

    const xml = await (await sm.sitemapResponse(0)).text();
    for (const p of SET.map((x) => x.path)) expect(xml).not.toContain(`<loc>https://timetozone.com${p}</loc>`);
    expect(xml).toContain("<loc>https://timetozone.com/zones/est</loc>");
  });

  it("keeps the off-host guard stricter than a control (restrict-only)", async () => {
    const { mw } = await load({ ZEPLIK_PAGE_CONTROLS: "on", ZEPLIK_HUB_URL: HUB }, hubFetch(SET));
    const r = await mw.middleware(new NextRequest("https://x.up.railway.app/zones/aest", { headers: { host: "x.up.railway.app" } }));
    expect(r.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("never touches the API, files or the IndexNow key", async () => {
    const all: PageControl[] = [c({ path: "/llms.txt", action: "gone" }), c({ path: "/k123.txt", action: "gone" })];
    const { mw } = await load({ ZEPLIK_PAGE_CONTROLS: "on", ZEPLIK_HUB_URL: HUB, INDEXNOW_KEY: "k123" }, hubFetch(all));
    expect((await mw.middleware(req("/llms.txt"))).status).toBe(200);
    const key = await mw.middleware(req("/k123.txt"));
    expect(await key.text()).toBe("k123");
  });

  it("fails open: a hub outage serves pages and the full sitemap", async () => {
    const down = vi.fn(async () => {
      throw new TypeError("hub down");
    }) as unknown as ReturnType<typeof hubFetch>;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { mw, sm } = await load({ ZEPLIK_PAGE_CONTROLS: "on", ZEPLIK_HUB_URL: HUB }, down);
    const res = await mw.middleware(req("/zones/acst"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
    const xml = await (await sm.sitemapResponse(0)).text();
    expect(xml).toContain("<loc>https://timetozone.com/zones/acst</loc>");
    warn.mockRestore();
  });

  it("the control kit matches src/seo.config.ts", async () => {
    const { kit } = await import("@/seo.config");
    const { controlsKit } = await import("@/seo/page-controls");
    const k = controlsKit()!;
    for (const f of ["site", "origin", "host", "hubUrl", "trailingSlash", "defaultLocale", "localePrefix"] as const) expect(k[f]).toEqual(kit[f]);
    expect([...k.locales]).toEqual([...kit.locales]);
  });

  it("wiring: middleware and every sitemap path go through the control source", () => {
    const mw = readFileSync("src/middleware.ts", "utf8");
    expect(mw).toMatch(/from "@\/seo\/page-controls"/);
    expect(mw).toMatch(/siteControls\.respond\(req\)/);
    expect(mw).toMatch(/siteControls\.decorate\(req, res\)/);
    const sm = readFileSync("src/seo/sitemap-data.ts", "utf8");
    // The control filter is the last step on the final list: the code's rows and the hub's rows.
    expect(sm).toMatch(/const hub = await hubSitemap\(id\);\n\s+const rows = await siteControls\.filterRows\(\[\.\.\.sitemapEntries\(id\), \.\.\.hub\.rows\]\);/);
    expect(sm).toMatch(/return new Response\(sitemapXml\(rows\), \{ headers \}\);/);
    for (const id of [0, 1, 2, 3, 4]) {
      expect(readFileSync(`src/app/sitemap-${id}.xml/route.ts`, "utf8")).toMatch(new RegExp(`sitemapResponse\\(${id}\\)`));
    }
  });
});
