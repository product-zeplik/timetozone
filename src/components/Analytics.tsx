"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";

/**
 * GA4 for the App Router.
 *
 * `gtag('config', …)` only sends a page_view on the initial document load. Every
 * subsequent client-side navigation — which is most of them on a site built of
 * cross-linked conversion pages — would be invisible. So automatic page_view is
 * switched off and one is sent here on every route change instead, including
 * the first.
 */

type GtagArgs = [string, ...unknown[]];

interface GtagWindow extends Window {
  dataLayer?: unknown[];
  gtag?: (...args: GtagArgs) => void;
}

/** Queue into dataLayer even if gtag.js has not finished loading. */
export function gtag(...args: GtagArgs) {
  if (typeof window === "undefined") return;
  const w = window as GtagWindow;
  w.dataLayer = w.dataLayer || [];
  if (!w.gtag) {
    w.gtag = function pushToDataLayer(...inner: GtagArgs) {
      // gtag.js reads these as array-like, which is what the official stub pushes
      // eslint-disable-next-line prefer-rest-params
      (w.dataLayer as unknown[]).push(arguments.length ? arguments : inner);
    };
  }
  w.gtag(...args);
}

function PageViews({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const last = useRef<string | null>(null);

  useEffect(() => {
    // Query parameters carry converter state (?t=&d=), not a different page, so
    // they are reported but never create a second page_view for the same path.
    const qs = searchParams?.toString();
    const path = pathname + (qs ? `?${qs}` : "");
    if (last.current === path) return;
    last.current = path;

    gtag("event", "page_view", {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
      send_to: gaId,
    });
  }, [pathname, searchParams, gaId]);

  return null;
}

export function Analytics({ gaId }: { gaId: string }) {
  if (!gaId) return null;
  return (
    <>
      <Script id="ga-src" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());` +
          `gtag('config','${gaId}',{send_page_view:false});`}
      </Script>
      <Suspense fallback={null}>
        <PageViews gaId={gaId} />
      </Suspense>
    </>
  );
}
