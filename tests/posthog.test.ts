import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { posthogConfig, tcfAllowsStorage, withProduct } from "@/analytics/posthog-runtime";

/**
 * PostHog has the same failure mode as GA: a wrong setting looks like a
 * working one. These pin the three things that would corrupt the data or
 * the consent posture without any error.
 */
describe("posthog init options", () => {
  it("sends page views by hand, so query-string edits are not page views", () => {
    expect(posthogConfig("memory").capture_pageview).toBe(false);
  });

  it("keeps page leaves on, which the PostHog default would switch off with page views", () => {
    expect(posthogConfig("memory").capture_pageleave).toBe(true);
  });

  it("starts with whatever persistence it is handed", () => {
    expect(posthogConfig("memory").persistence).toBe("memory");
    expect(posthogConfig("localStorage+cookie").persistence).toBe("localStorage+cookie");
  });
});

describe("withProduct", () => {
  it("stamps the product on every outgoing event, init-time ones included", () => {
    const event = withProduct({ event: "$set", properties: {} as Record<string, unknown> });
    expect(event.properties.product).toBe("timetozone");
  });

  it("passes a dropped event through", () => {
    expect(withProduct(null)).toBeNull();
  });
});

describe("tcfAllowsStorage", () => {
  it("is undecided while the CMP is still waiting for the visitor", () => {
    expect(tcfAllowsStorage({ eventStatus: "cmpuishown", gdprApplies: true })).toBeNull();
    expect(tcfAllowsStorage(null)).toBeNull();
  });

  it("allows storage when purpose 1 is consented", () => {
    expect(
      tcfAllowsStorage({
        eventStatus: "useractioncomplete",
        gdprApplies: true,
        purpose: { consents: { "1": true } },
      }),
    ).toBe(true);
  });

  it("refuses storage when purpose 1 is not consented", () => {
    expect(
      tcfAllowsStorage({
        eventStatus: "useractioncomplete",
        gdprApplies: true,
        purpose: { consents: { "1": false } },
      }),
    ).toBe(false);
    expect(tcfAllowsStorage({ eventStatus: "tcloaded", gdprApplies: true })).toBe(false);
  });

  it("allows storage when the CMP says GDPR does not apply", () => {
    expect(tcfAllowsStorage({ eventStatus: "tcloaded", gdprApplies: false })).toBe(true);
  });
});

describe("posthog stays out of the shared bundle", () => {
  it("imports posthog-js only dynamically", () => {
    for (const file of [
      "src/analytics/posthog.ts",
      "src/analytics/posthog-runtime.ts",
      "src/analytics/PostHog.tsx",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/^import\s+(?!type\b)[^;]*from\s+["']posthog-js["']/m);
    }
    expect(readFileSync("src/analytics/posthog-runtime.ts", "utf8")).toMatch(/import\("posthog-js"\)/);
    // The runtime itself is loaded lazily, so only the queue is in the shared bundle.
    expect(readFileSync("src/analytics/posthog.ts", "utf8")).toMatch(/import\("\.\/posthog-runtime"\)/);
    expect(readFileSync("src/analytics/posthog.ts", "utf8")).not.toMatch(/^import\s+(?!type\b)[^;]*from\s+["']\.\/posthog-runtime["']/m);
  });

  it("is mounted once in the root layout", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout.match(/<PostHogAnalytics \/>/g)).toHaveLength(1);
  });
});
