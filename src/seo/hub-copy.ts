import manifest from "../../seo/manifest.json";

/**
 * Which pages carry the hub copy slot (<HubCopySlot>, src/components/HubCopySlot.tsx)
 * and under which feature id: every live feature in seo/manifest.json, matched
 * by its path. A page whose path is not a manifest feature gets no slot.
 *
 * Templates with the slot: ToolPage (/, the tools, /time-zone-map and
 * /time-zone-map/usa), /time-zones and /daylight-saving-time. As families of
 * sites/timezone.yaml in the engine repo: `tool` (/:slug tool pages and the DST
 * hub), `map` (/time-zone-map/usa) and `site` (/ and /time-zones are the only
 * manifest features in it; /about, /contact, /privacy and /terms have no
 * feature id and so no slot). The programmatic families (pair, hour, place,
 * zone, dst country pages) have no manifest features and no slot.
 */
export const HUB_COPY_FAMILIES = ["tool", "map", "site"] as const;

type Feature = { id: string; path: string; status: string };

const BY_PATH: ReadonlyMap<string, string> = new Map(
  (manifest.features as Feature[]).filter((f) => f.status === "live").map((f) => [f.path, f.id]),
);

/** The manifest feature id of the page at this path, or undefined. */
export function hubCopyFeature(path: string): string | undefined {
  return BY_PATH.get(path);
}
