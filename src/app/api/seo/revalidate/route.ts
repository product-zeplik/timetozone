import { createRevalidateHandler } from "@zeplik/seo-kit/next";
import { kit } from "@/seo.config";

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
    cached = { secret, handle: createRevalidateHandler({ kit, secret }) };
  }
  return cached.handle(req);
}
