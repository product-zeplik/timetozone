import { HubCopy } from "@zeplik/seo-kit";
import { hubDaily, hubKit } from "@/seo/hub";
import { hubCopyFeature } from "@/seo/hub-copy";

/**
 * The hub copy slot (seo-kit <HubCopy>): the explanatory sections the content
 * hub publishes for this page's manifest feature (steps, example, limits,
 * body, a visible FAQ, related tools), placed after the tool and the page's
 * own text. It renders NOTHING (no element, no whitespace) until the owner
 * approves copy for the feature, and nothing while the hub is unreachable, so
 * it leaves every page byte-identical today. It never adds an H1, head tags,
 * JSON-LD, a CTA or an ad.
 *
 * The fetch uses src/seo/hub.ts's 86400 s client (the same ISR period as the
 * tool pages, and a kit that cannot fail over an unrelated setting),
 * so the slot never changes a page's revalidate or Cache-Control; the hub's
 * revalidate webhook (tag zeplik:tool:<id> and the page path) shows new copy
 * at once. Do not remove it from a template that the status document lists.
 */
export function HubCopySlot({ path }: { path: string }) {
  const featureId = hubCopyFeature(path);
  if (!featureId || !hubKit || !hubDaily) return null;
  return <HubCopy kit={hubKit} slug={featureId} hub={hubDaily} />;
}
