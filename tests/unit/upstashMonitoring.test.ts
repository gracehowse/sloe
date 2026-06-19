import { describe, expect, it, vi, beforeEach } from "vitest";

const captureMessage = vi.fn();
const serverTrack = vi.fn(async () => ({ ok: true }));

vi.mock("@sentry/nextjs", () => ({ captureMessage }));
vi.mock("@/lib/analytics/serverTrack", () => ({ serverTrack }));

describe("recordUpstashFailure", () => {
  beforeEach(() => {
    captureMessage.mockClear();
    serverTrack.mockClear();
  });

  it("emits an alertable Sentry message and PostHog metric for Upstash failures", async () => {
    const { AnalyticsEvents } = await import("@/lib/analytics/events");
    const { recordUpstashFailure } = await import("@/lib/server/upstashMonitoring");

    recordUpstashFailure(
      {
        subsystem: "rate_limit",
        mode: "call_threw",
        operation: "limit",
        failBehavior: "closed",
        keyPrefix: "api:test",
      },
      new Error("redis unavailable"),
    );

    expect(captureMessage).toHaveBeenCalledWith("[Upstash] rate_limit call_threw", {
      level: "error",
      tags: {
        dependency: "upstash",
        subsystem: "rate_limit",
        mode: "call_threw",
        fail_behavior: "closed",
      },
      extra: expect.objectContaining({
        subsystem: "rate_limit",
        mode: "call_threw",
        operation: "limit",
        fail_behavior: "closed",
        key_prefix: "api:test",
        error_message: "redis unavailable",
      }),
      fingerprint: ["upstash", "rate_limit", "call_threw", "limit"],
    });
    expect(serverTrack).toHaveBeenCalledWith(
      AnalyticsEvents.upstash_dependency_failure,
      "system:upstash",
      expect.objectContaining({
        subsystem: "rate_limit",
        mode: "call_threw",
        fail_behavior: "closed",
      }),
    );
  });
});
