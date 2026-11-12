import { BUILD_META, COUNTRIES, PLACES, REGIONS } from "@/engine/entities";
import { SITE } from "@/site";

export const dynamic = "force-dynamic";

/**
 * The commit this container was built from. Without it there is no way to ask
 * the running site "are you the code I pushed?", and a deploy that silently
 * served an older build is exactly the failure this answers. Railway injects
 * it; locally there is nothing to report.
 */
const COMMIT = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 40) ?? null;

export function GET() {
  const now = Date.now();
  let intlOk = false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata" }).format(now);
    intlOk = true;
  } catch {
    intlOk = false;
  }
  return Response.json(
    {
      ok: intlOk,
      env: SITE.env,
      url: SITE.url,
      node: process.version,
      tzdata: process.versions.tz ?? BUILD_META.tzdata,
      icu: process.versions.icu,
      builtAt: BUILD_META.builtAt,
      commit: COMMIT,
      counts: { countries: COUNTRIES.length, regions: REGIONS.length, places: PLACES.length },
      now: new Date(now).toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    },
    { status: intlOk ? 200 : 500, headers: { "Cache-Control": "no-store" } }
  );
}
