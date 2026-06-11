/**
 * ENG-1043 — `lifetime_pro` founding-cohort tier resolution (web).
 *
 * Pins that the durable founding comp gates identically to `pro` at the single
 * normalisation point where the raw `profiles.user_tier` string enters web app
 * state (`normaliseTier`), so every downstream `userTier === "pro"` gate covers
 * lifetime founders without per-site branching. Protects against a regression
 * that would silently downgrade a founder to Free on web.
 */
import { describe, expect, it } from "vitest";

import { normaliseTier } from "../../src/types/recipe.ts";

describe("normaliseTier — lifetime_pro gates as pro", () => {
  it("maps lifetime_pro to pro", () => {
    expect(normaliseTier("lifetime_pro")).toBe("pro");
  });

  it("passes through pro / base / free unchanged", () => {
    expect(normaliseTier("pro")).toBe("pro");
    expect(normaliseTier("base")).toBe("base");
    expect(normaliseTier("free")).toBe("free");
  });

  it("falls back to free for null / undefined / unknown", () => {
    expect(normaliseTier(null)).toBe("free");
    expect(normaliseTier(undefined)).toBe("free");
    expect(normaliseTier("enterprise")).toBe("free");
    expect(normaliseTier("")).toBe("free");
  });

  it("a lifetime_pro user clears every `userTier === \"pro\"` web gate", () => {
    // The web gates (Settings, Profile, MealPlanner, SubscriptionCard,
    // UpgradePrompt, paywall dialog) all branch on the normalised value being
    // exactly "pro". Asserting the normalisation closes the gap end-to-end.
    const gated = (tier: string) => normaliseTier(tier) === "pro";
    expect(gated("lifetime_pro")).toBe(true);
    expect(gated("pro")).toBe(true);
    expect(gated("free")).toBe(false);
    expect(gated("base")).toBe(false);
  });
});
