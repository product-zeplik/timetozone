import "@zeplik/seo-kit/styles.css";
import { bestOf } from "@/seo/content-routes";

/**
 * Hub pages at /best/<slug>, rendered by @zeplik/seo-kit (src/seo/content-routes.ts).
 * Every slug belongs to the hub: one it does not have answers a real 404, and
 * a hub outage keeps the last good render (ISR). Never holds copy.
 */
export const revalidate = 3600;
export const dynamicParams = true;
export const generateStaticParams = bestOf.generateStaticParams;
export const generateMetadata = bestOf.generateMetadata;
export default bestOf.Page;
