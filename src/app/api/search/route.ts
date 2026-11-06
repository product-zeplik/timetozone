import { searchIndex } from "@/engine/entities";

export const dynamic = "force-static";
export const revalidate = 604800;

/** The picker index: [key, label, sublabel, tz] rows. Loaded on focus only. */
export function GET() {
  return new Response(JSON.stringify(searchIndex()), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
    },
  });
}
