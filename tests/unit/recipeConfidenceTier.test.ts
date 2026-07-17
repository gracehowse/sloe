/**
 * recipeConfidenceTier — direct boundary pins for the ENG-1424 shared
 * display-tier helper. The six call sites (see the doc comment in
 * verifyConfidencePolicy.ts) previously each hardcoded this ternary;
 * coverage before this file was only indirect via route tests, so the
 * 0.75 / 0.50 edges themselves were unpinned.
 */
import { describe, expect, it } from "vitest";

import {
  RECIPE_CONFIDENCE_TIER_HIGH,
  RECIPE_INGREDIENT_REVIEW_CONFIDENCE,
  recipeConfidenceTier,
  recipeConfidenceTierWithExclusions,
} from "../../src/lib/nutrition/verifyConfidencePolicy";

describe("recipeConfidenceTier — boundary behaviour", () => {
  it("0.75 is high (>= boundary, inclusive)", () => {
    expect(recipeConfidenceTier(0.75)).toBe("high");
  });

  it("just under 0.75 is medium", () => {
    expect(recipeConfidenceTier(0.7499)).toBe("medium");
  });

  it("0.5 is medium (>= boundary, inclusive)", () => {
    expect(recipeConfidenceTier(0.5)).toBe("medium");
  });

  it("just under 0.5 is low", () => {
    expect(recipeConfidenceTier(0.4999)).toBe("low");
  });

  it("0 and 1 hit the extremes", () => {
    expect(recipeConfidenceTier(0)).toBe("low");
    expect(recipeConfidenceTier(1)).toBe("high");
  });

  it("NaN falls to low, never high", () => {
    expect(recipeConfidenceTier(Number.NaN)).toBe("low");
  });

  it("boundaries derive from the exported constants (no drift)", () => {
    expect(recipeConfidenceTier(RECIPE_CONFIDENCE_TIER_HIGH)).toBe("high");
    expect(recipeConfidenceTier(RECIPE_INGREDIENT_REVIEW_CONFIDENCE)).toBe("medium");
  });
});

describe("recipeConfidenceTierWithExclusions — ENG-1422 excluded-line cap", () => {
  it("no excluded lines → identical to the raw tier (may be high)", () => {
    expect(recipeConfidenceTierWithExclusions(0.9, 0, 5)).toBe("high");
    expect(recipeConfidenceTierWithExclusions(0.6, 0, 5)).toBe("medium");
    expect(recipeConfidenceTierWithExclusions(0.3, 0, 5)).toBe("low");
  });

  it("any excluded line caps a high accepted-average down to medium", () => {
    // 4 accepted at 0.9 + 1 excluded → raw tier would be high; capped to medium.
    expect(recipeConfidenceTierWithExclusions(0.9, 1, 4)).toBe("medium");
  });

  it("MORE excluded lines never read HIGHER than fewer at the same average", () => {
    // Same accepted-average (0.9) and accepted count (5); increasing exclusions
    // must be monotonically non-increasing across the tier ladder.
    const order = { low: 0, medium: 1, high: 2 } as const;
    const tiers = [0, 1, 2, 3, 4, 5, 8].map((excluded) =>
      recipeConfidenceTierWithExclusions(0.9, excluded, 5),
    );
    for (let i = 1; i < tiers.length; i++) {
      expect(order[tiers[i]!]).toBeLessThanOrEqual(order[tiers[i - 1]!]);
    }
    // And the inversion is gone: 0 excluded is strictly higher than 1 excluded.
    expect(order[tiers[0]!]).toBeGreaterThan(order[tiers[1]!]);
  });

  it("half or more of the recipe excluded → low, even with a pristine average", () => {
    // 3 accepted at 0.95, 3 excluded (half) → low.
    expect(recipeConfidenceTierWithExclusions(0.95, 3, 3)).toBe("low");
    // Excluded strictly exceeds accepted → low.
    expect(recipeConfidenceTierWithExclusions(0.95, 4, 3)).toBe("low");
    // Under half stays at the medium cap.
    expect(recipeConfidenceTierWithExclusions(0.95, 2, 5)).toBe("medium");
  });

  it("a low accepted-average with exclusions stays low (never bumped up)", () => {
    expect(recipeConfidenceTierWithExclusions(0.3, 1, 4)).toBe("low");
  });

  it("zero accepted lines with any exclusion → low (nothing cleared the floor)", () => {
    expect(recipeConfidenceTierWithExclusions(0, 2, 0)).toBe("low");
  });

  it("non-finite / negative counts are treated as zero excluded", () => {
    expect(recipeConfidenceTierWithExclusions(0.9, Number.NaN, 5)).toBe("high");
    expect(recipeConfidenceTierWithExclusions(0.9, -1, 5)).toBe("high");
  });
});
