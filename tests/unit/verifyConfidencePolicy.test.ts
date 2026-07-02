import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ingredientVerifyNeedsReview,
  INGREDIENT_VERIFY_REVIEW_AVG_THRESHOLD,
  INGREDIENT_VERIFY_REVIEW_MIN_THRESHOLD,
  MIN_ACCEPT_CONFIDENCE,
  MIN_MATCH_CONFIDENCE,
  MIN_OFF_CONFIDENCE,
  RECIPE_INGREDIENT_REVIEW_CONFIDENCE,
} from "../../src/lib/nutrition/verifyConfidencePolicy";
import {
  MIN_ACCEPT_CONFIDENCE as ACCEPT_FROM_VERIFY_INGREDIENTS,
  MIN_MATCH_CONFIDENCE as MATCH_FROM_VERIFY_INGREDIENTS,
  MIN_OFF_CONFIDENCE as OFF_FROM_VERIFY_INGREDIENTS,
  RECIPE_INGREDIENT_REVIEW_CONFIDENCE as REVIEW_FROM_VERIFY_INGREDIENTS,
} from "../../src/lib/nutrition/verifyIngredients";

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

describe("verifyConfidencePolicy — accept-floor documentation", () => {
  it("documents the shipped 0.55 accept floor (not the proposed 0.70)", () => {
    const src = readFileSync(
      resolve(__dirname, "../../src/lib/nutrition/verifyConfidencePolicy.ts"),
      "utf8",
    );
    expect(src).toMatch(/MIN_ACCEPT_CONFIDENCE = 0\.55/);
    expect(src).not.toMatch(/MIN_ACCEPT_CONFIDENCE = 0\.70/);
  });
});

describe("verifyConfidencePolicy — ENG-1305 accept-floor unification", () => {
  it("canonical accept floor lives here at the ratified 0.55 (D-05 impact review 2026-05-26)", () => {
    // Do NOT bump these to 0.70 without the empirical over-rejection
    // measurement ENG-746 piece 2 requires — the 2026-05-26 impact
    // review found 0.70 over-rejects verbose-descriptor staples.
    expect(MIN_ACCEPT_CONFIDENCE).toBe(0.55);
    expect(MIN_MATCH_CONFIDENCE).toBe(MIN_ACCEPT_CONFIDENCE);
    expect(MIN_OFF_CONFIDENCE).toBe(0.57);
  });

  it("verifyIngredients re-exports the same accept-floor constants (no drift)", () => {
    expect(ACCEPT_FROM_VERIFY_INGREDIENTS).toBe(MIN_ACCEPT_CONFIDENCE);
    expect(MATCH_FROM_VERIFY_INGREDIENTS).toBe(MIN_MATCH_CONFIDENCE);
    expect(OFF_FROM_VERIFY_INGREDIENTS).toBe(MIN_OFF_CONFIDENCE);
  });

  it("accept floor sits above the review badge and OFF stays the strictest source", () => {
    expect(MIN_ACCEPT_CONFIDENCE).toBeGreaterThan(RECIPE_INGREDIENT_REVIEW_CONFIDENCE);
    expect(MIN_OFF_CONFIDENCE).toBeGreaterThan(MIN_ACCEPT_CONFIDENCE);
  });

  it("belowAcceptFloorCount > 0 forces the review nudge even with pristine stats", () => {
    // ENG-1305: min/avg now describe only ACCEPTED rows (the row set the
    // totals sum). A recipe with excluded rows must still nudge review —
    // its headline numbers are incomplete by design.
    expect(ingredientVerifyNeedsReview(0.95, 0.9, 1)).toBe(true);
    expect(ingredientVerifyNeedsReview(0.95, 0.9, 3)).toBe(true);
  });

  it("belowAcceptFloorCount of 0 / undefined / null leaves the stats-based verdict unchanged", () => {
    expect(ingredientVerifyNeedsReview(0.95, 0.9, 0)).toBe(false);
    expect(ingredientVerifyNeedsReview(0.95, 0.9, undefined)).toBe(false);
    expect(ingredientVerifyNeedsReview(0.95, 0.9, null)).toBe(false);
    // Stats-based nudges still fire regardless of the count.
    expect(ingredientVerifyNeedsReview(0.46, 0.46, 0)).toBe(true);
    expect(ingredientVerifyNeedsReview(0.9, 0.1, 0)).toBe(true);
  });

  it("ignores a non-finite count (defensive against bad JSON)", () => {
    expect(ingredientVerifyNeedsReview(0.95, 0.9, Number.NaN)).toBe(false);
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
