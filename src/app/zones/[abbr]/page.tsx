import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ZONES, ZONE_BY_SLUG } from "@/data/zones";
import { buildZone } from "@/content/place";
import { pageMeta } from "@/seo/meta";
import { ZoneView } from "@/components/PlaceView";
import { isoDate, wallTime } from "@/engine/tz";

export const revalidate = 86400;
export const dynamicParams = false;

type Params = { params: Promise<{ abbr: string }> };

export function generateStaticParams() {
  return ZONES.map((z) => ({ abbr: z.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { abbr } = await params;
  const z = ZONE_BY_SLUG.get(abbr);
  if (!z) return { title: "Not found" };
  const c = buildZone(z);
  return pageMeta({ title: c.title, description: c.description, path: c.path });
}

export default async function ZonePage({ params }: Params) {
  const { abbr } = await params;
  const z = ZONE_BY_SLUG.get(abbr);
  if (!z) notFound();
  const now = Date.now();
  const c = buildZone(z, now);
  return <ZoneView c={c} today={isoDate(wallTime("UTC", now))} />;
}
