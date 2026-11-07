import type { MetadataRoute } from "next";
import { SITE, abs } from "@/site";
import { ZONES } from "@/data/zones";
import { COUNTRIES, PLACES, REGIONS } from "@/engine/entities";
import { dstCountries, hourPairs, indexedPairs, multiZoneEntities } from "@/seo/gate";
import { hourLabel } from "@/engine/tz";
import { TOOL_LINKS } from "@/content/nav";
import meta from "@/data/generated/meta.json";

export const revalidate = 86400;

/** Five sitemap files, each well under the 50,000-URL limit. docs/08 §8.3. */
export function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
}

/**
 * The date the content was last built, to the day.
 *
 * docs/08 §8.3 says `lastModified` = build/revalidate time, and that was a
 * `new Date()` at render. With `revalidate = 86400` the file regenerates every
 * day, so all 7,695 pair URLs claimed to have changed seconds ago, every day,
 * on identical timestamps. Google's guidance is that lastmod must be when the
 * page last changed *meaningfully* and that a consistently inaccurate one is
 * ignored outright -- and "12,000 pages all changed this second" is a poor
 * look for a domain with no history. The build date is both stable and true:
 * these pages change when the data or the templates are rebuilt.
 */
const BUILT = (meta as { builtAt: string }).builtAt.slice(0, 10);

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const lastModified = BUILT;
  if (!SITE.isProduction) return [];

  const entry = (path: string, priority: number) => ({
    url: abs(path),
    lastModified,
    changeFrequency: "daily" as const,
    priority,
  });

  switch (Number(id)) {
    case 0: {
      const out = [entry("/", 1)];
      for (const t of TOOL_LINKS) if (t.href !== "/") out.push(entry(t.href, 0.8));
      out.push(entry("/time-zone-map/usa", 0.8));
      out.push(entry("/about", 0.3), entry("/contact", 0.3), entry("/privacy", 0.3), entry("/terms", 0.3));
      for (const z of ZONES) out.push(entry(`/zones/${z.slug}`, 0.7));
      for (const c of dstCountries()) out.push(entry(`/daylight-saving-time/${c}`, 0.6));
      for (const e of multiZoneEntities()) out.push(entry(`/time-zone/${e.slug}`, 0.6));
      return out;
    }
    case 1:
      return [...indexedPairs()].sort().map((slug) => entry(`/${slug}`, 0.8));
    case 2: {
      const out: MetadataRoute.Sitemap = [];
      for (const pair of hourPairs()) {
        for (let h = 0; h < 24; h++) out.push(entry(`/${pair}/${hourLabel(h)}`, 0.6));
      }
      return out;
    }
    case 3: {
      const out: MetadataRoute.Sitemap = [];
      for (const c of COUNTRIES) out.push(entry(`/time/${c.slug}`, 0.7));
      for (const r of REGIONS) out.push(entry(`/time/${r.countrySlug}/${r.slug}`, 0.6));
      return out;
    }
    case 4:
      return PLACES.map((p) => entry(`/time/${p.countrySlug}/${p.slug}`, 0.5));
    default:
      return [];
  }
}
