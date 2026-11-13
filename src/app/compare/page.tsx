import "@zeplik/seo-kit/styles.css";
import type { Metadata } from "next";
import { HubSectionIndex, sectionIndexMetadata } from "@/components/HubSectionIndex";
import { routeSection } from "@/seo/content-routes";

/** Index of the hub's published pages at /compare/<slug>; a real 404 while there are none. */
export const revalidate = 3600;

const SECTION = routeSection("/compare");

export function generateMetadata(): Promise<Metadata> {
  return sectionIndexMetadata(SECTION);
}

export default function Page() {
  return <HubSectionIndex section={SECTION} />;
}
