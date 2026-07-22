import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureMessage = vi.fn();
const serverTrack = vi.fn(async () => ({ ok: true }));

vi.mock("@sentry/nextjs", () => ({ captureMessage }));
vi.mock("@/lib/analytics/serverTrack", () => ({ serverTrack }));

describe("recordVendorSearchDegraded", () => {
  beforeEach(async () => {
    captureMessage.mockClear();
    serverTrack.mockClear();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const { _resetVendorSearchMonitoringForTest } = await import(
      "@/lib/server/vendorSearchMonitoring"
    );
    _resetVendorSearchMonitoringForTest();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("emits PostHog + Sentry once per vendor per quota window", async () => {
    const { AnalyticsEvents } = await import("@/lib/analytics/events");
    const { recordVendorSearchDegraded } = await import("@/lib/server/vendorSearchMonitoring");

    const metric = {
      vendor: "usda" as const,
      guard: "consume" as const,
      used: 901,
      cap: 1000,
      trip: 900,
      windowSec: 3600,
      label: "USDA FDC (1,000/hr/IP)",
    };

    await recordVendorSearchDegraded(metric);
    await recordVendorSearchDegraded(metric);

    expect(serverTrack).toHaveBeenCalledTimes(1);
    expect(serverTrack).toHaveBeenCalledWith(
      AnalyticsEvents.vendor_search_degraded,
      "system:vendor_quota",
      expect.objectContaining({
        vendor: "usda",
        reason: "quota_exhausted",
        used: 901,
        cap: 1000,
        trip: 900,
        window_sec: 3600,
        label: "USDA FDC (1,000/hr/IP)",
      }),
    );
    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect(captureMessage).toHaveBeenCalledWith(
      "Vendor search degraded — usda",
      expect.objectContaining({
        level: "warning",
        tags: expect.objectContaining({ vendor: "usda", reason: "quota_exhausted" }),
      }),
    );
  });
});

describe("vendorSearchCache quota degrade telemetry", () => {
  beforeEach(async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const { _resetVendorSearchCacheForTest } = await import("@/lib/server/vendorSearchCache");
    _resetVendorSearchCacheForTest();
    captureMessage.mockClear();
    serverTrack.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fires vendor_search_degraded when checkQuota reports exhausted", async () => {
    const { AnalyticsEvents } = await import("@/lib/analytics/events");
    const { VENDOR_QUOTAS, QUOTA_SAFETY_FRACTION, checkQuota, consumeQuota } = await import(
      "@/lib/server/vendorSearchCache"
    );

    const { cap } = VENDOR_QUOTAS.edamam;
    const trip = Math.floor(cap * QUOTA_SAFETY_FRACTION);
    for (let i = 0; i < trip; i++) {
      await consumeQuota("edamam");
    }

    const decision = await checkQuota("edamam");
    expect(decision.allowed).toBe(false);

    // Allow the fire-and-forget telemetry promise to settle.
    await new Promise((r) => setTimeout(r, 0));

    expect(serverTrack).toHaveBeenCalledWith(
      AnalyticsEvents.vendor_search_degraded,
      "system:vendor_quota",
      expect.objectContaining({ vendor: "edamam", reason: "quota_exhausted" }),
    );
  });
});
