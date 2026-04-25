import { describe, expect, it } from "vitest";
import {
  eventTypeIsTierGrant,
  eventTypeRequiresExpiration,
  extractEntitlements,
  tierFromRevenueCatEntitlements,
  userIdFromAppUserId,
} from "../../src/lib/revenuecat/tierFromEntitlements";

/** T6 (full-sweep 2026-04-24) — pin the RC entitlement → tier mapping
 *  + the event-type dispatch so the webhook can't silently misclassify
 *  a billing event. */

describe("tierFromRevenueCatEntitlements", () => {
  it("returns 'free' for null / empty input", () => {
    expect(tierFromRevenueCatEntitlements(null)).toBe("free");
    expect(tierFromRevenueCatEntitlements(undefined)).toBe("free");
    expect(tierFromRevenueCatEntitlements([])).toBe("free");
  });

  it("returns 'pro' when 'pro' entitlement is present (even with 'base' too)", () => {
    expect(tierFromRevenueCatEntitlements(["pro"])).toBe("pro");
    expect(tierFromRevenueCatEntitlements(["base", "pro"])).toBe("pro");
    expect(tierFromRevenueCatEntitlements(["PRO"])).toBe("pro");
  });

  it("returns 'base' when only 'base' is present", () => {
    expect(tierFromRevenueCatEntitlements(["base"])).toBe("base");
    expect(tierFromRevenueCatEntitlements(["BASE"])).toBe("base");
  });

  it("returns 'free' for unknown entitlement strings", () => {
    expect(tierFromRevenueCatEntitlements(["legacy", "unknown"])).toBe("free");
  });
});

describe("extractEntitlements", () => {
  it("pulls the array form when present", () => {
    expect(extractEntitlements({ entitlement_ids: ["pro", "base"] })).toEqual([
      "pro",
      "base",
    ]);
  });

  it("falls back to the scalar form (newer RC payloads)", () => {
    expect(extractEntitlements({ entitlement_id: "pro" })).toEqual(["pro"]);
  });

  it("returns null when neither field is present", () => {
    expect(extractEntitlements({})).toBeNull();
    expect(extractEntitlements(null)).toBeNull();
    expect(extractEntitlements("not an object")).toBeNull();
  });

  it("filters non-string entries from the array form", () => {
    expect(
      extractEntitlements({ entitlement_ids: ["pro", 42, null, "base"] }),
    ).toEqual(["pro", "base"]);
  });

  it("returns null when the array is empty after filtering", () => {
    expect(extractEntitlements({ entitlement_ids: [] })).toBeNull();
    expect(extractEntitlements({ entitlement_ids: [42, null] })).toBeNull();
  });
});

describe("userIdFromAppUserId", () => {
  it("accepts a valid uuid v4", () => {
    expect(userIdFromAppUserId("11111111-1111-4111-8111-111111111111")).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(userIdFromAppUserId(" 11111111-1111-4111-8111-111111111111 ")).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("returns null for non-uuid strings (anonymous RC ids)", () => {
    expect(userIdFromAppUserId("$RCAnonymousID:abc123")).toBeNull();
    expect(userIdFromAppUserId("not-a-uuid")).toBeNull();
    expect(userIdFromAppUserId("")).toBeNull();
  });

  it("returns null for non-string inputs", () => {
    expect(userIdFromAppUserId(null)).toBeNull();
    expect(userIdFromAppUserId(undefined)).toBeNull();
    expect(userIdFromAppUserId(42)).toBeNull();
  });
});

describe("event-type dispatch helpers", () => {
  it("eventTypeRequiresExpiration: only EXPIRATION + SUBSCRIPTION_PAUSED", () => {
    expect(eventTypeRequiresExpiration("EXPIRATION")).toBe(true);
    expect(eventTypeRequiresExpiration("SUBSCRIPTION_PAUSED")).toBe(true);
    expect(eventTypeRequiresExpiration("CANCELLATION")).toBe(false);
    expect(eventTypeRequiresExpiration("BILLING_ISSUE")).toBe(false);
    expect(eventTypeRequiresExpiration("RENEWAL")).toBe(false);
    expect(eventTypeRequiresExpiration("INITIAL_PURCHASE")).toBe(false);
  });

  it("eventTypeIsTierGrant: covers the six grant-style events", () => {
    expect(eventTypeIsTierGrant("INITIAL_PURCHASE")).toBe(true);
    expect(eventTypeIsTierGrant("RENEWAL")).toBe(true);
    expect(eventTypeIsTierGrant("PRODUCT_CHANGE")).toBe(true);
    expect(eventTypeIsTierGrant("UNCANCELLATION")).toBe(true);
    expect(eventTypeIsTierGrant("NON_RENEWING_PURCHASE")).toBe(true);
    expect(eventTypeIsTierGrant("TEMPORARY_ENTITLEMENT_GRANT")).toBe(true);
  });

  it("eventTypeIsTierGrant: rejects non-grant types", () => {
    expect(eventTypeIsTierGrant("CANCELLATION")).toBe(false);
    expect(eventTypeIsTierGrant("EXPIRATION")).toBe(false);
    expect(eventTypeIsTierGrant("BILLING_ISSUE")).toBe(false);
    expect(eventTypeIsTierGrant("TRANSFER")).toBe(false);
    expect(eventTypeIsTierGrant("SUBSCRIPTION_PAUSED")).toBe(false);
  });

  it("CANCELLATION is in NEITHER bucket — handler must no-op", () => {
    // Critical regression guard: CANCELLATION = auto-renew off but
    // entitlement still active. Must never trigger a tier downgrade.
    expect(eventTypeIsTierGrant("CANCELLATION")).toBe(false);
    expect(eventTypeRequiresExpiration("CANCELLATION")).toBe(false);
  });

  it("BILLING_ISSUE is in NEITHER bucket — grace period, don't downgrade", () => {
    expect(eventTypeIsTierGrant("BILLING_ISSUE")).toBe(false);
    expect(eventTypeRequiresExpiration("BILLING_ISSUE")).toBe(false);
  });
});
