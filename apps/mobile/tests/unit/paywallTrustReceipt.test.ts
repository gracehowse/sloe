/**
 * Mobile-side functional tests for the trust-copy SSOT (audit 2026-04-30).
 *
 * Mobile imports the SSOT from `../../../src/lib/landing/paywallTrust`
 * via a relative path (the leaf-file convention shared with
 * `pricingTiers.ts` and `nutritionSources.ts` so the React Native
 * tsconfig graph never trips on `@/...` aliases).
 *
 * These tests run inside the mobile vitest harness so a regression in
 * the SSOT is caught by `npm run mobile:test` as well as
 * `npm test`. The web side has its own copies of these checks in
 * `tests/unit/paywallTrust.test.tsx`.
 */
import { describe, expect, it } from "vitest";
import {
  PAYWALL_TRUST_CHIPS,
  buildReceiptTrustCopy,
} from "@suppr/shared/landing/paywallTrust";

describe("mobile — PAYWALL_TRUST_CHIPS shape", () => {
  it("imports cleanly via relative path (no @/... alias drift)", () => {
    expect(PAYWALL_TRUST_CHIPS).toBeDefined();
    expect(Array.isArray(PAYWALL_TRUST_CHIPS)).toBe(true);
  });

  it("carries exactly three chips in the canonical order", () => {
    expect(PAYWALL_TRUST_CHIPS).toHaveLength(3);
    expect(PAYWALL_TRUST_CHIPS[0].label).toBe("Cancel anytime in-app");
    expect(PAYWALL_TRUST_CHIPS[1].label).toBe("7-day refund, no email needed");
    expect(PAYWALL_TRUST_CHIPS[2].label).toBe("Price never changes mid-trial");
  });
});

describe("mobile — buildReceiptTrustCopy (post-purchase Alert)", () => {
  it("composes the iOS variant with Apple-specific cancel path", () => {
    const copy = buildReceiptTrustCopy({
      trialEndsLabel: "in 7 days",
      cancelPath: "Settings > Apple ID > Subscriptions",
    });
    expect(copy).toContain("Settings > Apple ID > Subscriptions");
    expect(copy).toContain("trial ends in 7 days");
    expect(copy).toContain("first charge after that");
    expect(copy).toContain("support@getsloe.com");
  });

  it("composes the Android variant with Google Play cancel path", () => {
    const copy = buildReceiptTrustCopy({
      trialEndsLabel: "in 7 days",
      cancelPath: "Google Play > Payments & subscriptions",
    });
    expect(copy).toContain("Google Play > Payments & subscriptions");
    expect(copy).not.toContain("Apple ID");
  });

  it("monthly-no-trial framing reads 'with your billing period'", () => {
    const copy = buildReceiptTrustCopy({
      trialEndsLabel: "with your billing period",
      cancelPath: "Settings > Apple ID > Subscriptions",
    });
    expect(copy).toContain("trial ends with your billing period");
    expect(copy).toContain("first charge after that");
  });

  it("never asks the user to email support to cancel — counters Lifesum-pattern", () => {
    const copy = buildReceiptTrustCopy({
      trialEndsLabel: "in 7 days",
      cancelPath: "Settings > Apple ID > Subscriptions",
    });
    expect(copy.toLowerCase()).not.toMatch(/email.*to cancel/);
    expect(copy.toLowerCase()).not.toMatch(/contact support to cancel/);
  });
});
