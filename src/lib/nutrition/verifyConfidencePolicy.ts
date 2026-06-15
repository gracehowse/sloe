/**
 * Single source of truth for ingredient-confidence policy.
 *
 * Pre-P1-8 (2026-04-25), the project shipped four overlapping thresholds
 * across two files:
 *   - `INGREDIENT_VERIFY_REVIEW_AVG_THRESHOLD = 0.45` (mean nudge, here)
 *   - `INGREDIENT_VERIFY_REVIEW_MIN_THRESHOLD = 0.20` (min always-nudge, here)
 *   - `RECIPE_INGREDIENT_REVIEW_CONFIDENCE = 0.50` (per-line UI badge,
 *     in `verifyIngredients.ts`, plus a duplicate in
 *     `apps/mobile/lib/verifyRecipe.ts` with a "keep in sync" comment).
 *
 * The mismatch (0.45 mean vs 0.50 per-line) created a silent zone: a
 * recipe whose lines were all at 0.43 confidence got per-line "needs
 * review" badges on every line but **no** recipe-level review CTA,
 * because the mean (0.43) was below 0.45 → wait, that triggers AVG
 * threshold. Actually the silent zone was a recipe averaging 0.46 — the
 * mean cleared the 0.45 nudge but most lines were below the 0.50 per-
 * line bar, so the user saw badges everywhere without a top-level
 * action. Inconsistent UX either way.
 *
 * P1-8 unifies: per-line threshold and mean threshold are both 0.50.
 * That keeps the per-line UI behaviour the team already shipped and
 * raises the mean nudge so a recipe whose every line is "needs review"
 * also gets the recipe-level "review suggested" CTA.
 *
 * Acceptance gates (`MIN_ACCEPT_CONFIDENCE = 0.55` in `verifyIngredients.ts`,
 * with `MIN_MATCH_CONFIDENCE = 0.55` and `MIN_OFF_CONFIDENCE = 0.57`) decide
 * whether to accept a candidate match at all, before any UI threshold applies.
 * D-05 (2026-05-25) proposed 0.70; the nutrition-engine impact review (2026-05-26)
 * shipped 0.55 so verbose-descriptor staples are not over-rejected. The **0.70
 * band** remains the published display/trust signal for "high confidence" in
 * product copy — it is not the live accept floor until ENG-746 piece 2 lands.
 *
 * Note the accept floor (0.55) now sits ABOVE this review badge (0.50).
 *
 * Distinct from `classifyConfidence` in `aiLogging.ts` (logging
 * buckets — different domain).
 */

/**
 * Per-line confidence below which the recipe-verify UI shows a "needs
 * review" badge on the line. Raised in P1-8 to share a value with the
 * recipe-level mean nudge so the two surfaces never disagree about a
 * borderline recipe.
 */
export const RECIPE_INGREDIENT_REVIEW_CONFIDENCE = 0.5;

/**
 * Recipe-level mean per-line confidence below this → show "review
 * suggested" messaging at the top of the verify screen (soft nudge,
 * not a hard block). P1-8: bumped 0.45 → 0.50 to match the per-line
 * badge; the previous 0.45 created a silent zone for recipes averaging
 * 0.46–0.50.
 */
export const INGREDIENT_VERIFY_REVIEW_AVG_THRESHOLD = RECIPE_INGREDIENT_REVIEW_CONFIDENCE;

/**
 * If any single line falls below this minimum, always nudge review —
 * one bad line can dominate kcal even when the mean looks fine.
 * Unchanged by P1-8.
 */
export const INGREDIENT_VERIFY_REVIEW_MIN_THRESHOLD = 0.2;

export function ingredientVerifyNeedsReview(
  avgIngredientConfidence: number | null | undefined,
  minIngredientConfidence: number | null | undefined,
): boolean {
  if (
    typeof minIngredientConfidence === "number" &&
    Number.isFinite(minIngredientConfidence) &&
    minIngredientConfidence < INGREDIENT_VERIFY_REVIEW_MIN_THRESHOLD
  ) {
    return true;
  }
  const avg =
    typeof avgIngredientConfidence === "number" && Number.isFinite(avgIngredientConfidence)
      ? avgIngredientConfidence
      : 0;
  if (avg > 0 && avg < INGREDIENT_VERIFY_REVIEW_AVG_THRESHOLD) return true;
  return false;
}
