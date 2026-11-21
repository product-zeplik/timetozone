/**
 * The part of PostHog that only loads when it starts: posthog-js itself, the
 * init options, the `product` stamp and the consent watcher. Imported by
 * `schedulePostHog` in `./posthog.ts`; see that file for why it is split.
 */

import type { PostHog } from "posthog-js";
import type { Command } from "./posthog";

const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const PRODUCT = process.env.NEXT_PUBLIC_POSTHOG_PRODUCT || "timetozone";

type Persistence = "memory" | "localStorage+cookie";

let started: PostHog | null = null;
let persistence: Persistence = "memory";

/**
 * The init options. Exported for the test that pins them.
 *
 * `capture_pageview: false` because page views are sent by hand (`./PostHog.tsx`), and
 * `capture_pageleave: true` because PostHog's `"if_capture_pageview"` default
 * would otherwise turn page leaves off with it.
 *
 * `before_send` stamps `product` as well as the `register` call after init,
 * because init itself can emit an event (a `$set`) before `register` runs.
 */
export function posthogConfig(initialPersistence: Persistence) {
  return {
    before_send: withProduct,
    api_host: HOST,
    defaults: "2026-08-30",
    person_profiles: "identified_only",
    persistence: initialPersistence,
    capture_pageview: false,
    capture_pageleave: true,
  } as const;
}

/** Add `product` to an outgoing event unless it already carries one. */
export function withProduct<T extends { properties?: Record<string, unknown> } | null>(
  event: T,
): T {
  if (event) event.properties = { product: PRODUCT, ...event.properties };
  return event;
}

/** Give the main thread back between the slices of PostHog's start-up. */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

/**
 * Fetch, start and flush, in separate tasks.
 *
 * Evaluating posthog-js, running `init` and sending the first events cost
 * about 230 ms of main thread in one task on a 4x-throttled phone, which the
 * lab budget counts in full as blocking time. Yielding between the steps
 * turns that into several short tasks, so a tap that lands meanwhile waits
 * for one slice rather than for all of it. Commands that arrive while the
 * queue is being drained join the end of it, so the order holds.
 */
export async function start(
  key: string,
  queue: Command[],
  onLive: (ph: PostHog) => void,
): Promise<void> {
  // Follow the CMP from now on. Its first answer, if it has one already,
  // arrives before init and sets the persistence init starts with.
  watchTcfConsent(setPostHogConsent);

  // PostHog reads the time zone on every event, and the first read
  // initialises ICU's zone data: about 60 ms on a throttled phone. Paying
  // it in a task of its own keeps it out of the import's.
  Intl.DateTimeFormat().resolvedOptions();
  await yieldToMain();
  const { default: posthog } = await import("posthog-js");
  await yieldToMain();
  posthog.init(key, posthogConfig(persistence));
  posthog.register({ product: PRODUCT });
  started = posthog;
  while (queue.length > 0) {
    await yieldToMain();
    queue.shift()?.(posthog);
  }
  onLive(posthog);
}

/**
 * Apply a consent decision. `true` lets PostHog persist its ids in
 * localStorage and a first-party cookie; `false` keeps them in memory only.
 */
export function setPostHogConsent(granted: boolean): void {
  const next: Persistence = granted ? "localStorage+cookie" : "memory";
  if (next === persistence) return;
  persistence = next;
  if (started) started.set_config({ persistence: next });
}

/* ------------------------------------------------------- CMP (TCF v2.2) */

interface TcData {
  gdprApplies?: boolean;
  eventStatus?: string;
  listenerId?: number;
  purpose?: { consents?: Record<string, boolean> };
}

type TcfApi = (
  command: string,
  version: number,
  callback: (data: TcData | null, success: boolean) => void,
  parameter?: unknown,
) => void;

/**
 * Whether a TCF payload amounts to consent for device storage.
 *
 * Purpose 1 is "store and/or access information on a device", which is
 * exactly what cookie and localStorage persistence is. A CMP reporting that
 * GDPR does not apply to this visitor is also a yes. Anything else, including
 * a CMP still waiting for the visitor, is a no. Exported for tests.
 */
export function tcfAllowsStorage(data: TcData | null): boolean | null {
  if (!data) return null;
  if (data.eventStatus !== "tcloaded" && data.eventStatus !== "useractioncomplete") return null;
  if (data.gdprApplies === false) return true;
  return data.purpose?.consents?.["1"] === true;
}

/**
 * Follow the CMP's decisions through the IAB TCF API.
 *
 * The CMP script loads asynchronously and only in the regions it serves, so
 * `__tcfapi` is polled for a while rather than assumed. If it never appears,
 * PostHog simply stays in memory persistence: no signal is not consent.
 */
export function watchTcfConsent(onChange: (granted: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const target = window as unknown as { __tcfapi?: TcfApi };
  let attempts = 0;
  let listenerId: number | undefined;
  let stopped = false;

  const attach = (api: TcfApi) => {
    api("addEventListener", 2, (data, success) => {
      if (stopped || !success) return;
      if (data?.listenerId !== undefined) listenerId = data.listenerId;
      const granted = tcfAllowsStorage(data);
      if (granted !== null) onChange(granted);
    });
  };

  const poll = window.setInterval(() => {
    attempts += 1;
    if (typeof target.__tcfapi === "function") {
      window.clearInterval(poll);
      attach(target.__tcfapi);
    } else if (attempts >= 30) {
      window.clearInterval(poll);
    }
  }, 500);

  return () => {
    stopped = true;
    window.clearInterval(poll);
    if (listenerId !== undefined && typeof target.__tcfapi === "function") {
      target.__tcfapi("removeEventListener", 2, () => {}, listenerId);
    }
  };
}
