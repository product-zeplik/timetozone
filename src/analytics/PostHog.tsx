"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { posthogEnabled, posthogPageview, schedulePostHog } from "./posthog";

/**
 * PostHog page views and consent, mounted once by the root layout so every
 * route is covered.
 *
 * It renders nothing and imports no PostHog code: `./posthog.ts` fetches
 * posthog-js with a dynamic `import()` a few seconds after `load`.
 *
 * Page views follow `usePathname` only. The query string carries converter
 * state (`?t=&d=`), which is not a different page. `usePathname` needs no
 * Suspense boundary, unlike the GA tracker's `useSearchParams`.
 *
 * Consent: this site has no banner of its own. Google's CMP (AdSense Privacy
 * & messaging) decides, through the TCF API, and `./posthog-runtime.ts`
 * follows it; until it says storage is allowed PostHog keeps its ids in
 * memory.
 */
export function PostHogAnalytics() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (posthogEnabled) schedulePostHog();
  }, []);

  useEffect(() => {
    if (!posthogEnabled || !pathname || previous.current === pathname) return;
    const first = previous.current === null;
    previous.current = pathname;

    if (first) {
      posthogPageview();
      return;
    }

    // A frame, so the new page's <title> has been committed.
    const frame = window.requestAnimationFrame(() => posthogPageview());
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}
