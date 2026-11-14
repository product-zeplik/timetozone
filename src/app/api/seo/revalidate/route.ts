import { revalidatePath, revalidateTag } from "next/cache";
import { createRevalidateHandler } from "@zeplik/seo-kit/server";
import { kit } from "@/seo.config";
import { controlRevalidatePaths } from "@/seo/sitemap-data";

/**
 * Hub publishing webhook (manual 4, 16): HMAC-verified revalidation plus an
 * IndexNow ping. The hub signs each payload (x-zeplik-signature and
 * x-zeplik-timestamp, 300 s window); unsigned, badly signed or expired requests
 * answer 401.
 *
 * With no secret set every request answers 503 with a JSON reason: the route is
 * not configured on this server, which is neither a server fault nor the
 * caller's. The secret is ZEPLIK_REVALIDATE_SECRET if set, else
 * REVALIDATE_SECRET -- the variable the older /api/revalidate route (used by
 * the DST cron with an x-revalidate-secret header) already reads. That route is
 * unchanged.
 *
 * Page controls: the hub sends event "redirect" when a control is activated or
 * retired. On that event, or any event carrying urls, a verified, first-seen
 * request also revalidates every sitemap file, /sitemap.xml and each URL in
 * payload.urls (controlRevalidatePaths), so the change reaches the 24 h
 * force-static sitemaps at once. Only after the seo-kit handler accepted it.
 *
 * Hub content (src/seo/hub-sections.ts): the seo-kit handler already
 * revalidates the payload's paths and the zeplik:article:<slug>,
 * zeplik:tool:<id>, zeplik:sitemap and zeplik:related tags that the hub
 * sections, the hub copy slot and sitemap 0 fetch with, and clears the
 * hasPage and "no copy yet" memories. An article event also revalidates every
 * hub section index here (controlRevalidatePaths), so a section's first
 * article turns its 404 index into a listing at once.
 */
export const dynamic = "force-dynamic";

let cached: { secret: string; handle: (req: Request) => Promise<Response> } | null = null;

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.ZEPLIK_REVALIDATE_SECRET || process.env.REVALIDATE_SECRET || "";
  if (!secret) {
    return Response.json(
      {
        ok: false,
        error: "revalidate webhook not configured",
        detail: "REVALIDATE_SECRET is not set on this server, so no request can be verified. Nothing was revalidated.",
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  // One handler per secret: it keeps the replay window (ids already handled) between requests.
  if (!cached || cached.secret !== secret) {
    cached = { secret, handle: createRevalidateHandler({ kit, secret, revalidatePath: (p) => revalidatePath(p), revalidateTag: (t) => revalidateTag(t) }) };
  }
  const body = await req.clone().text();
  const res = await cached.handle(req);
  if (res.status !== 200) return res;
  const result = (await res.clone().json()) as { ok?: boolean; duplicate?: boolean };
  if (!result.ok || result.duplicate) return res;
  let extra: string[] = [];
  try {
    extra = controlRevalidatePaths(JSON.parse(body));
  } catch {
    return res;
  }
  if (extra.length === 0) return res;
  for (const p of extra) revalidatePath(p);
  return Response.json({ ...result, controls: { paths: extra } }, { status: 200, headers: { "cache-control": "no-store" } });
}
