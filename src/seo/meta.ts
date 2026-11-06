import type { Metadata } from "next";
import { SITE, abs } from "@/site";

/** Append " | TimeToZone" only when the total stays <= 60 characters. */
export function title(core: string): string {
  const branded = `${core} | ${SITE.name}`;
  return branded.length <= 60 ? branded : core;
}

/** Clip to `max` characters at a word boundary, adding an ellipsis. */
export function clip(s: string, max = 155): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,.;:]+$/, "")}…`;
}

/** Pick the first candidate that fits within `max`. */
export function firstThatFits(candidates: string[], max = 60): string {
  for (const c of candidates) if (c.length <= max) return c;
  return candidates[candidates.length - 1];
}

export interface PageMetaInput {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  ogTitle?: string;
}

export function pageMeta({ title: t, description, path, index = true, ogTitle }: PageMetaInput): Metadata {
  const canonical = abs(path);
  const desc = clip(description, 155);
  const indexable = index && SITE.isProduction;
  return {
    title: { absolute: t },
    description: desc,
    alternates: { canonical },
    robots: indexable
      ? { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 }
      : { index: false, follow: true },
    openGraph: {
      type: "website",
      url: canonical,
      title: ogTitle || t,
      description: desc,
      siteName: SITE.name,
      images: [{ url: `${SITE.url}/og?t=${encodeURIComponent(ogTitle || t)}`, width: 1200, height: 630, alt: t }],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle || t,
      description: desc,
      images: [`${SITE.url}/og?t=${encodeURIComponent(ogTitle || t)}`],
    },
  };
}

/* ------------------------------------------------------------------ JSON-LD */

export interface Crumb {
  name: string;
  path: string;
}

export const ld = {
  organization() {
    const sameAs: string[] = [];
    if (SITE.chromeStoreUrl) sameAs.push(SITE.chromeStoreUrl);
    return {
      "@type": "Organization",
      "@id": `${SITE.url}/#org`,
      name: SITE.name,
      url: `${SITE.url}/`,
      logo: {
        "@type": "ImageObject",
        url: `${SITE.url}/icon.svg`,
        width: 512,
        height: 512,
      },
      ...(sameAs.length ? { sameAs } : {}),
    };
  },

  website() {
    return {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      url: `${SITE.url}/`,
      name: SITE.name,
      description: SITE.descriptor,
      publisher: { "@id": `${SITE.url}/#org` },
      inLanguage: "en",
    };
  },

  breadcrumbs(crumbs: Crumb[]) {
    return {
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        item: abs(c.path),
      })),
    };
  },

  webApplication(name: string, description: string, path: string) {
    return {
      "@type": "WebApplication",
      name,
      description,
      url: abs(path),
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript for live clocks; conversions render without it.",
      offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
      publisher: { "@id": `${SITE.url}/#org` },
    };
  },

  faqPage(items: { q: string; a: string }[]) {
    return {
      "@type": "FAQPage",
      mainEntity: items.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };
  },

  webPage(name: string, path: string, description: string, dateModified: string) {
    return {
      "@type": "WebPage",
      "@id": `${abs(path)}#webpage`,
      url: abs(path),
      name,
      description,
      isPartOf: { "@id": `${SITE.url}/#website` },
      dateModified,
      inLanguage: "en",
    };
  },

  city(opts: {
    name: string;
    countryName: string;
    timeZone: string;
    lat?: number;
    lng?: number;
    kind?: "City" | "Place" | "AdministrativeArea" | "Country";
  }) {
    const node: Record<string, unknown> = {
      "@type": opts.kind || "City",
      name: opts.name,
      additionalProperty: { "@type": "PropertyValue", name: "timeZone", value: opts.timeZone },
    };
    if (opts.lat !== undefined && opts.lng !== undefined) {
      node.geo = { "@type": "GeoCoordinates", latitude: opts.lat, longitude: opts.lng };
    }
    if (opts.kind !== "Country") {
      node.containedInPlace = { "@type": "Country", name: opts.countryName };
    }
    return node;
  },
};

/** Wrap nodes into a single @graph document. */
export function graph(nodes: unknown[]) {
  return { "@context": "https://schema.org", "@graph": nodes };
}

/** JSON for a <script type="application/ld+json">, with `<` escaped. */
export function ldJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
