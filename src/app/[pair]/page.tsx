import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { parsePair } from "@/engine/entities";
import { staticPairs } from "@/seo/gate";
import { buildPair } from "@/content/pair";
import { pageMeta } from "@/seo/meta";
import { PairView } from "@/components/PairView";

export const revalidate = 86400;
export const dynamicParams = true;

type Params = { params: Promise<{ pair: string }> };

export function generateStaticParams() {
  return [...staticPairs()].map((pair) => ({ pair }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { pair } = await params;
  const p = parsePair(pair);
  if (!p) return { title: "Not found" };
  if (!p.canonical) return { title: "Redirecting", robots: { index: false, follow: true } };
  const c = buildPair(p);
  return pageMeta({ title: c.title, description: c.description, path: c.path, index: c.indexed });
}

export default async function PairPage({ params }: Params) {
  const { pair } = await params;
  const p = parsePair(pair);
  if (!p) notFound();
  if (!p.canonical) permanentRedirect(`/${p.slug}`);

  const now = Date.now();
  const c = buildPair(p, now);
  return <PairView c={c} />;
}
