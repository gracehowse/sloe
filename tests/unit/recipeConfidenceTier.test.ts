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
