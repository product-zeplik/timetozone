import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { parsePair } from "@/engine/entities";
import { hourPairs } from "@/seo/gate";
import { buildHour } from "@/content/pair";
import { pageMeta } from "@/seo/meta";
import { HourView } from "@/components/PairView";
import { hourLabel, isoDate, parseHourLabel, wallTime } from "@/engine/tz";

export const revalidate = 86400;
export const dynamicParams = true;

type Params = { params: Promise<{ pair: string; hour: string }> };

/** `09am`, `9AM`, `9-am`, `9 am` -> `9am`. */
function normaliseHour(raw: string): string {
  const s = decodeURIComponent(raw).toLowerCase().replace(/[^a-z0-9]/g, "");
  const m = /^0*(\d{1,2})(am|pm|a|p)$/.exec(s);
  if (!m) return s;
  const suffix = m[2][0] === "a" ? "am" : "pm";
  return `${Number(m[1])}${suffix}`;
}

export function generateStaticParams() {
  const out: { pair: string; hour: string }[] = [];
  for (const pair of hourPairs()) {
    for (let h = 0; h < 24; h++) out.push({ pair, hour: hourLabel(h) });
  }
  return out;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { pair, hour } = await params;
  const p = parsePair(pair);
  const h = parseHourLabel(normaliseHour(hour));
  if (!p || h === null) return { title: "Not found" };
  if (!p.canonical || normaliseHour(hour) !== hour) {
    return { title: "Redirecting", robots: { index: false, follow: true } };
  }
  const c = buildHour(p, h);
  return pageMeta({ title: c.title, description: c.description, path: c.path, index: c.indexed });
}

export default async function HourPage({ params }: Params) {
  const { pair, hour } = await params;
  const p = parsePair(pair);
  const norm = normaliseHour(hour);
  const h = parseHourLabel(norm);
  if (!p || h === null) notFound();
  if (!p.canonical || norm !== hour) permanentRedirect(`/${p.slug}/${norm}`);

  const now = Date.now();
  const c = buildHour(p, h, now);
  return <HourView c={c} today={isoDate(wallTime("UTC", now))} />;
}
