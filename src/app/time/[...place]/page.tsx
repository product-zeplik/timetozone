import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildPlace, resolvePlace } from "@/content/place";
import { staticPlacePaths } from "@/seo/gate";
import { pageMeta } from "@/seo/meta";
import { PlaceView } from "@/components/PlaceView";
import { isoDate, wallTime } from "@/engine/tz";

export const revalidate = 86400;
export const dynamicParams = true;

type Params = { params: Promise<{ place: string[] }> };

export function generateStaticParams() {
  return staticPlacePaths().map((p) => ({ place: p.replace("/time/", "").split("/") }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { place } = await params;
  const t = resolvePlace(place);
  if (!t) return { title: "Not found" };
  const c = buildPlace(t);
  return pageMeta({ title: c.title, description: c.description, path: c.path });
}

export default async function TimePlacePage({ params }: Params) {
  const { place } = await params;
  const t = resolvePlace(place);
  if (!t) notFound();
  const now = Date.now();
  const c = buildPlace(t, now);
  return <PlaceView c={c} today={isoDate(wallTime("UTC", now))} />;
}
