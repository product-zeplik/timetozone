/**
 * PostHog product analytics, loaded off the critical path.
 *
 * Shared project: every product in the Zeplik portfolio writes to the same
 * PostHog project, so every event carries a `product` property
 * (`NEXT_PUBLIC_POSTHOG_PRODUCT`, "timetozone" here). It is registered as a
 * super property right after init and stamped again in `before_send`, which
 * is what puts it on page views, autocapture, page leaves, session replay and
 * web vitals alike.
 *
 * Three decisions here are load-bearing:
 *
 * **posthog-js is never in the shared bundle.** It is fetched with a dynamic
 * `import()` a few seconds after the `load` event, at an idle moment (see
 * `schedulePostHog`), so it adds nothing to the route JS budget in docs/09
 * and competes with neither the LCP (the answer line) nor hydrating the
 * converter. Anything captured before it arrives is queued and replayed in
 * order, with the URL and title it had when it happened.
 *
 * **It starts with `persistence: "memory"`.** Nothing is written to a cookie
 * or localStorage until the consent platform says so: Google's CMP (AdSense
 * Privacy & messaging, docs/09 9.3) answering through the IAB TCF API that
 * storage is consented (purpose 1) or that GDPR does not apply. On that
 * signal persistence switches to `"localStorage+cookie"` in place, keeping
 * the in-memory ids. A later refusal switches it back.
 *
 * **Page views are sent by hand, on pathname changes only.** Query strings
 * carry converter state (`?t=&d=`), not a different page; see
 * `src/analytics/PostHog.tsx`.
 *
 * Nothing runs unless `NEXT_PUBLIC_POSTHOG_KEY` is set, so local and preview
 * builds make no request to PostHog. Nothing here renders anything, so no
 * time or clock reaches the cached HTML.
 *
 * This file is the only PostHog code in the shared bundle, so it is kept to a
 * queue and a timer: everything else (the init options, the consent watcher,
 * posthog-js itself) is in `./posthog-runtime.ts`, which is imported only when
 * PostHog starts. docs/09 gives each page 15 KB of route JS on top of the
 * framework, and the pair pages are close to it.
 */

import type { PostHog } from "posthog-js";

// Literal `process.env.NEXT_PUBLIC_*` reads: Next inlines only these into the
// browser bundle, at build time (see the ARG lines in the Dockerfile).
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";

/** True when a project key is configured and PostHog should load. */
export const posthogEnabled = Boolean(KEY);

export type Command = (ph: PostHog) => void;

/** Commands captured before PostHog is running, drained by the runtime. */
const queue: Command[] = [];
let live: PostHog | null = null;
let scheduled = false;

function run(command: Command): void {
  if (live) command(live);
  else queue.push(command);
}

/**
 * How long after the `load` event PostHog waits before it starts, in ms.
 *
 * Measured, not guessed, on calcmyway.com, which loads the same library the
 * same way. Even split into slices, evaluating posthog-js is one task of
 * about 200 ms on a 4x-throttled phone (a 350 KB library evaluates in one
 * go). Started at the first idle moment, that task landed inside the page's
 * loading phase and added 100-180 ms of blocking time to every template in
 * `seo-check perf`. Three seconds after `load`, the page has finished loading
 * and the task meets an idle main thread; here `seo-check perf --ad-site`
 * passes with it on every template.
 */
export const POSTHOG_START_DELAY_MS = 3000;

/**
 * Start PostHog once the page has settled: a few seconds after the `load`
 * event, at the next idle moment. Safe to call repeatedly.
 *
 * Deliberately NOT on the first interaction. A visitor's first tap is usually
 * the converter's time field, and loading then would put PostHog's
 * evaluation task between that tap and the keystrokes that follow it, which
 * is the one place this site's responsiveness is measured.
 */
export function schedulePostHog(): void {
  if (!KEY || typeof window === "undefined" || scheduled) return;
  scheduled = true;

  const start = () => {
    import("./posthog-runtime")
      .then((runtime) =>
        runtime.start(KEY, queue, (ph) => {
          live = ph;
        }),
      )
      .catch(() => {
        // Blocked by an extension or the network. Measurement is not worth an error.
      });
  };

  const whenLoaded = () => {
    window.setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(start, { timeout: 10_000 });
      } else {
        start();
      }
    }, POSTHOG_START_DELAY_MS);
  };

  if (document.readyState === "complete") whenLoaded();
  else window.addEventListener("load", whenLoaded, { once: true });
}

/** Record one page view. The URL and title are read now, not when PostHog arrives. */
export function posthogPageview(): void {
  if (!KEY || typeof window === "undefined") return;
  const { href, pathname } = window.location;
  const title = document.title;
  run((ph) => ph.capture("$pageview", { $current_url: href, $pathname: pathname, title }));
}

/** Send one custom event. The site's GA events (`track`) are mirrored here. */
export function posthogCapture(name: string, properties: Record<string, unknown> = {}): void {
  if (!KEY) return;
  run((ph) => ph.capture(name, properties));
}
