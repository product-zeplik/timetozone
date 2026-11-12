import dates from "../../seo/content-dates.json";
import { fmtDate } from "@/engine/tz";

/**
 * The day each page family's content last changed, from git history
 * (seo/content-dates.json, written by scripts/content-dates.mjs).
 *
 * dateModified, the visible "Updated" line and sitemap lastmod all read this,
 * so they agree, and none of them reads the build or request clock (GR-36,
 * manual 11.2 rule 6). Before this they were "today" at render time: a daily
 * revalidate re-dated every page every day with nothing changed.
 */
export type ContentFamily = keyof typeof dates.families;

const FAMILIES = dates.families as Record<ContentFamily, string>;

/** `YYYY-MM-DD`, the UTC day of the newest commit that changed this family's content. */
export function contentDate(family: ContentFamily): string {
  return FAMILIES[family];
}

/** `12 November 2026`, the same form as fmtDate(w, true). */
export function contentDateLabel(family: ContentFamily): string {
  const [year, month, day] = contentDate(family).split("-").map(Number);
  return fmtDate({ year, month, day } as Parameters<typeof fmtDate>[0], true);
}

/** The newest date across families (sitemap index lastmod). */
export function newestContentDate(families: ContentFamily[]): string {
  return families.map(contentDate).sort().at(-1)!;
}
