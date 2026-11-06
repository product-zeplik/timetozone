import { BUILD_META, COUNTRIES, PLACES, REGIONS } from "@/engine/entities";
import { SITE } from "@/site";

export const dynamic = "force-dynamic";

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
      counts: { countries: COUNTRIES.length, regions: REGIONS.length, places: PLACES.length },
      now: new Date(now).toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    },
    { status: intlOk ? 200 : 500, headers: { "Cache-Control": "no-store" } }
  );
}
