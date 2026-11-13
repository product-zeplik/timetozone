import "@zeplik/seo-kit/styles.css";
import { guides } from "@/seo/content-routes";

/**
 * Hub guides at /guides/<slug>, rendered by @zeplik/seo-kit (src/seo/content-routes.ts).
 * Every slug belongs to the hub: one it does not have answers a real 404, and
 * a hub outage keeps the last good render (ISR). Never holds copy.
 */
export const revalidate = 3600;
export const dynamicParams = true;
export const generateStaticParams = guides.generateStaticParams;
export const generateMetadata = guides.generateMetadata;
export default guides.Page;
