import { describe, expect, it } from "vitest";
import {
  ingredientVerifyNeedsReview,
  INGREDIENT_VERIFY_REVIEW_AVG_THRESHOLD,
  INGREDIENT_VERIFY_REVIEW_MIN_THRESHOLD,
  RECIPE_INGREDIENT_REVIEW_CONFIDENCE,
} from "../../src/lib/nutrition/verifyConfidencePolicy";
import { RECIPE_INGREDIENT_REVIEW_CONFIDENCE as REVIEW_FROM_VERIFY_INGREDIENTS } from "../../src/lib/nutrition/verifyIngredients";

describe("verifyConfidencePolicy", () => {
  it("flags when minimum line confidence is critically low", () => {
    expect(ingredientVerifyNeedsReview(0.9, 0.1)).toBe(true);
    expect(ingredientVerifyNeedsReview(0.9, INGREDIENT_VERIFY_REVIEW_MIN_THRESHOLD)).toBe(false);
    expect(ingredientVerifyNeedsReview(0.9, INGREDIENT_VERIFY_REVIEW_MIN_THRESHOLD - 0.01)).toBe(true);
  });

  it("flags when average is below review threshold", () => {
    expect(ingredientVerifyNeedsReview(INGREDIENT_VERIFY_REVIEW_AVG_THRESHOLD - 0.01, 0.5)).toBe(true);
    expect(ingredientVerifyNeedsReview(INGREDIENT_VERIFY_REVIEW_AVG_THRESHOLD + 0.01, 0.5)).toBe(false);
  });

  it("does not flag high-confidence batches", () => {
    expect(ingredientVerifyNeedsReview(0.82, 0.35)).toBe(false);
  });
});

describe("verifyConfidencePolicy — P1-8 unification", () => {
  it("per-line review threshold equals recipe-level mean threshold", () => {
    // Pre-fix the per-line bar (0.50) and the mean bar (0.45) disagreed,
    // creating a silent zone for recipes averaging 0.46–0.50. The two
    // are now the same number; this test fails if a future change
    // re-introduces the gap.
    expect(RECIPE_INGREDIENT_REVIEW_CONFIDENCE).toBe(INGREDIENT_VERIFY_REVIEW_AVG_THRESHOLD);
    expect(RECIPE_INGREDIENT_REVIEW_CONFIDENCE).toBe(0.5);
  });

  it("verifyIngredients re-exports the canonical constant unchanged", () => {
    // The audit found that mobile shipped a duplicate copy of the
    // constant with a "keep in sync" comment. Re-export removes the
    // sync risk; this test pins reference equality.
    expect(REVIEW_FROM_VERIFY_INGREDIENTS).toBe(RECIPE_INGREDIENT_REVIEW_CONFIDENCE);
  });

  it("min threshold (always-nudge) stays well below the unified bar", () => {
    // Recipes with one truly broken line should still trigger review
    // even if every other line is fine. 0.20 is intentionally far
    // below 0.50 so the mean doesn't drown the signal.
    expect(INGREDIENT_VERIFY_REVIEW_MIN_THRESHOLD).toBeLessThan(RECIPE_INGREDIENT_REVIEW_CONFIDENCE);
    expect(INGREDIENT_VERIFY_REVIEW_MIN_THRESHOLD).toBe(0.2);
  });

  it("recipe averaging at the boundary triggers review (P1-8 silent-zone closure)", () => {
    // Pre-fix: a recipe with mean=0.46 cleared the 0.45 nudge but had
    // every line under 0.50 → user saw badges everywhere with no
    // top-level CTA. Now the mean nudge fires at the same boundary as
    // the per-line badge.
    expect(ingredientVerifyNeedsReview(0.46, 0.46)).toBe(true);
    expect(ingredientVerifyNeedsReview(0.49, 0.49)).toBe(true);
    expect(ingredientVerifyNeedsReview(0.5, 0.5)).toBe(false);
    expect(ingredientVerifyNeedsReview(0.51, 0.51)).toBe(false);
  });
});
