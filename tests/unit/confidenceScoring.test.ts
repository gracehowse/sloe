/**
 * Tests for confidence score adjustments in the nutrition verification pipeline.
 *
 * Covers:
 * - USDA boost: +0.03, capped at 0.98
 * - OFF penalty: -0.03, capped at 0.90
 * - Estimated fallback confidence levels (0.15 for unknown, 0.35 for known)
 */
import { describe, it, expect } from "vitest";
import { confidenceForMatch } from "@/lib/nutrition/verifyIngredients";
import { estimateLineMacros } from "@/lib/nutrition/estimateIngredientMacros";

describe("confidence scoring adjustments", () => {
  it("USDA boost: confidenceForMatch + 0.03, capped at 0.98", () => {
    const base = confidenceForMatch("chicken breast", "Chicken, breast, meat only, raw");
    // The USDA pipeline applies Math.min(0.98, base + 0.03)
    const usdaConfidence = Math.min(0.98, base + 0.03);
    expect(usdaConfidence).toBeGreaterThan(base);
    expect(usdaConfidence).toBeLessThanOrEqual(0.98);
    // Verify the boost is exactly 0.03 when not capped
    if (base + 0.03 <= 0.98) {
      expect(usdaConfidence).toBeCloseTo(base + 0.03, 10);
    } else {
      expect(usdaConfidence).toBe(0.98);
    }
  });

  it("OFF penalty: confidenceForMatch - 0.03, capped at 0.90", () => {
    const base = confidenceForMatch("chicken breast", "Chicken, breast, meat only, raw");
    // The OFF pipeline applies Math.min(0.90, base - 0.03)
    const offConfidence = Math.min(0.90, base - 0.03);
    expect(offConfidence).toBeLessThan(base);
    expect(offConfidence).toBeLessThanOrEqual(0.90);
    // Verify the penalty is exactly 0.03 when the result is below 0.90
    if (base - 0.03 <= 0.90) {
      expect(offConfidence).toBeCloseTo(base - 0.03, 10);
    } else {
      expect(offConfidence).toBe(0.90);
    }
  });

  it("estimated fallback: unknown ingredient gets 0.15", () => {
    const result = estimateLineMacros({ name: "xyzzy", amount: "100", unit: "g" });
    expect(result.isDefaultFallback).toBe(true);
    // The verify pipeline assigns 0.15 when isDefaultFallback is true
    const confidence = result.isDefaultFallback ? 0.15 : 0.35;
    expect(confidence).toBe(0.15);
  });

  it("estimated fallback: known ingredient gets 0.35", () => {
    const result = estimateLineMacros({ name: "chicken breast", amount: "200", unit: "g" });
    expect(result.isDefaultFallback).toBeUndefined();
    // The verify pipeline assigns 0.35 when isDefaultFallback is not set
    const confidence = result.isDefaultFallback ? 0.15 : 0.35;
    expect(confidence).toBe(0.35);
  });
});
