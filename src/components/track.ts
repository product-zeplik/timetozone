import { gtag } from "./Analytics";

/**
 * GA4 event helper. Queues into dataLayer even before gtag.js has loaded, so an
 * interaction in the first second of a visit is not lost. No-op without GA.
 */
export function track(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const w = window as Window & { dataLayer?: unknown[] };
  if (!w.dataLayer) return; // GA is not configured on this deployment
  gtag("event", event, params);
}
