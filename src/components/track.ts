import { gtag } from "./Analytics";
import { posthogCapture } from "@/analytics/posthog";

/**
 * GA4 event helper. Queues into dataLayer even before gtag.js has loaded, so an
 * interaction in the first second of a visit is not lost. No-op without GA.
 *
 * The same event goes to PostHog (queued until its lazily loaded library
 * arrives; a no-op without a PostHog key).
 */
export function track(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  posthogCapture(event, params);
  const w = window as Window & { dataLayer?: unknown[] };
  if (!w.dataLayer) return; // GA is not configured on this deployment
  gtag("event", event, params);
}
