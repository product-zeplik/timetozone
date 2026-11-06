import { renderMapSvg, type MapName } from "@/content/map";

export const dynamic = "force-static";
export const revalidate = 86400;

export function generateStaticParams() {
  return [{ name: "world.svg" }, { name: "usa.svg" }];
}

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const base = name.replace(/\.svg$/, "");
  if (base !== "world" && base !== "usa") {
    return new Response("Not found", { status: 404 });
  }
  const svg = renderMapSvg(base as MapName);
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
