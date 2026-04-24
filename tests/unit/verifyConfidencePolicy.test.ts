import { describe, expect, it } from "vitest";
import {
  ingredientVerifyNeedsReview,
  INGREDIENT_VERIFY_REVIEW_AVG_THRESHOLD,
  INGREDIENT_VERIFY_REVIEW_MIN_THRESHOLD,
} from "../../src/lib/nutrition/verifyConfidencePolicy";

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
