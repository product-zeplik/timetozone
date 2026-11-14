import "@zeplik/seo-kit/styles.css";
import { routeSection } from "@/seo/content-routes";

/**
 * Index of the hub's published pages at /compare/<slug>: seo-kit route.IndexPage,
 * the hub's approved section intro (H1, title, description) and its pages.
 * A real 404, and out of the sitemap, until the hub says the section is
 * listable (an approved intro and at least 3 published pages). Rendered on
 * request, never at build.
 */
export const revalidate = 3600;

const SECTION = routeSection("/compare").route;

export const generateMetadata = SECTION.generateIndexMetadata;

export default async function Page(props: Parameters<typeof SECTION.IndexPage>[0]) {
  return <div className="zk-article">{await SECTION.IndexPage(props)}</div>;
}
