import { SITE } from "@/site";
import AdSlot from "./AdSlot";

/** Server wrapper so pages never need to know whether AdSense is configured. */
export function Ad({ slot, lazy = true }: { slot?: string; lazy?: boolean }) {
  if (!SITE.adsenseClient) return null;
  return <AdSlot client={SITE.adsenseClient} slot={slot} lazy={lazy} />;
}
