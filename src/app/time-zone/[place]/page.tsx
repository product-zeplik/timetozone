import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildMultiZone, resolveMultiZone } from "@/content/place";
import { multiZoneEntities } from "@/seo/gate";
import { pageMeta } from "@/seo/meta";
import { MultiZoneView } from "@/components/PlaceView";
import { isoDate, wallTime } from "@/engine/tz";

export const revalidate = 86400;
export const dynamicParams = false;

type Params = { params: Promise<{ place: string }> };

export function generateStaticParams() {
  return multiZoneEntities().map((e) => ({ place: e.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { place } = await params;
  const t = resolveMultiZone(place);
  if (!t) return { title: "Not found" };
  const c = buildMultiZone(t);
  return pageMeta({ title: c.title, description: c.description, path: c.path });
}

export default async function MultiZonePage({ params }: Params) {
  const { place } = await params;
  const t = resolveMultiZone(place);
  if (!t) notFound();
  const now = Date.now();
  const c = buildMultiZone(t, now);
  return <MultiZoneView c={c} today={isoDate(wallTime("UTC", now))} />;
}
