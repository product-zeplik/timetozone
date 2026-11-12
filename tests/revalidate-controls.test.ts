import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { signBody } from "@zeplik/core";

/** The hub webhook (src/app/api/seo/revalidate/route.ts) refreshes the sitemaps when a page control changes. */

const { revalidatePath, revalidateTag } = vi.hoisted(() => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath, revalidateTag }));

const SECRET = "test-only-secret";
const SITEMAPS = ["/sitemap.xml", "/sitemap-0.xml", "/sitemap-1.xml", "/sitemap-2.xml", "/sitemap-3.xml", "/sitemap-4.xml"];
let n = 0;
const payload = (over: Record<string, unknown>) => ({
  contractVersion: 1,
  event: "update",
  site: "timetozone.com",
  kind: "sitemap",
  slug: "page-controls",
  paths: [],
  urls: [],
  at: "2026-11-13T00:00:00Z",
  id: `t-${++n}`,
  ...over,
});

async function post(body: object, secret = SECRET) {
  const text = JSON.stringify(body);
  const { signature, timestamp } = await signBody(secret, text);
  const { POST } = await import("@/app/api/seo/revalidate/route");
  return POST(
    new Request("https://timetozone.com/api/seo/revalidate", {
      method: "POST",
      body: text,
      headers: { "content-type": "application/json", "x-zeplik-signature": signature, "x-zeplik-timestamp": timestamp },
    }),
  );
}

beforeEach(() => {
  vi.stubEnv("ZEPLIK_REVALIDATE_SECRET", SECRET);
  vi.stubEnv("SITE_ENV", "production");
  vi.stubEnv("SITE_URL", "https://timetozone.com");
  vi.stubEnv("INDEXNOW_KEY", "");
  revalidatePath.mockClear();
});

describe("hub webhook and page controls", () => {
  it('event "redirect" revalidates every sitemap, the index and each URL', async () => {
    const res = await post(payload({ event: "redirect", urls: ["https://timetozone.com/zones/acst", "https://evil.example/x"] }));
    expect(res.status).toBe(200);
    const called = revalidatePath.mock.calls.map((c) => c[0]);
    for (const p of [...SITEMAPS, "/zones/acst"]) expect(called).toContain(p);
    expect(called).not.toContain("/x");
    expect((await res.json()).controls.paths).toContain("/sitemap-4.xml");
  });

  it("any event carrying urls does the same", async () => {
    await post(payload({ event: "publish", urls: ["https://timetozone.com/zones/aest"] }));
    const called = revalidatePath.mock.calls.map((c) => c[0]);
    expect(called).toEqual(expect.arrayContaining([...SITEMAPS, "/zones/aest"]));
  });

  it("other events without urls revalidate only their own paths", async () => {
    await post(payload({ event: "update", paths: ["/pst-to-est"] }));
    expect(revalidatePath.mock.calls.map((c) => c[0])).toEqual(["/pst-to-est"]);
  });

  it("a bad signature or a replay revalidates nothing extra", async () => {
    const bad = await post(payload({ event: "redirect" }), "wrong-secret");
    expect(bad.status).toBe(401);
    const p = payload({ event: "redirect" });
    await post(p);
    revalidatePath.mockClear();
    const dup = await post(p);
    expect((await dup.json()).duplicate).toBe(true);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("the DST cron route (/api/revalidate) is untouched by this", () => {
    expect(readFileSync("src/app/api/revalidate/route.ts", "utf8")).not.toMatch(/controlRevalidatePaths/);
  });
});
