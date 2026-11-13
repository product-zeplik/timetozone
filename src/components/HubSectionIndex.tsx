import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, JsonLd, buildMetadata } from "@zeplik/seo-kit";
import { breadcrumbList, itemList } from "@zeplik/seo-kit/jsonld";
import { kit } from "@/seo.config";
import { isNextInternalError } from "@zeplik/seo-kit/hub";
import { publishedEntries, type HubRouteSection } from "@/seo/content-routes";

type Section = HubRouteSection;

/**
 * The index of one hub section (/guides, /compare, /alternatives, /best):
 * every published hub page of that type, server-rendered, so none is an
 * orphan. There are no local pages in these sections, so an index with no hub
 * page answers a real 404 (and stays out of the sitemap) until the hub
 * publishes the first one; the revalidate webhook refreshes it then.
 *
 * Head and JSON-LD come from @zeplik/seo-kit (CLAUDE.md). A hub outage at
 * request time serves the last list this process rendered; with none, it
 * throws (an uncached 500), so a live index is never replaced by a cached 404.
 * During the build an outage only means the index is not prebuilt.
 */
const lastGood = new Map<string, Awaited<ReturnType<Section["route"]["list"]>>>();

async function items(section: Section) {
  try {
    await publishedEntries();
  } catch (err) {
    if (isNextInternalError(err)) throw err;
    const kept = lastGood.get(section.basePath);
    if (kept) return kept;
    throw err;
  }
  const list = await section.route.list({ limit: 200 });
  lastGood.set(section.basePath, list);
  return list;
}

export async function sectionIndexMetadata(section: Section): Promise<Metadata> {
  if ((await items(section)).length === 0) notFound();
  return buildMetadata(kit, { path: section.basePath, title: section.title, description: section.description });
}

export async function HubSectionIndex({ section }: { section: Section }) {
  const list = await items(section);
  if (list.length === 0) notFound();
  const url = `${kit.origin}${section.basePath}`;
  const crumbs = [
    { name: "Home", url: `${kit.origin}/` },
    { name: section.crumb, url },
  ];
  return (
    <div className="zk-article zk-hub-index">
      <Breadcrumbs kit={kit} items={crumbs} />
      <h1>{section.h1}</h1>
      <ul className="hub-index">
        {list.map((a) => (
          <li key={a.slug}>
            <a href={a.path}>{a.h1}</a>
            {a.description ? <p>{a.description}</p> : null}
          </li>
        ))}
      </ul>
      <JsonLd
        data={[
          breadcrumbList(crumbs),
          itemList({ url, name: section.h1, items: list.map((a) => ({ name: a.h1, url: a.url })) }),
        ]}
      />
    </div>
  );
}
