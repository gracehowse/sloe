/**
 * Shared thresholds for when verified nutrition should be treated as
 * "needs human review" vs safe enough to treat as primary without extra UI.
 *
 * Distinct from `classifyConfidence` in `aiLogging.ts` (logging buckets).
 */

/** Mean per-line confidence below this → show review messaging (soft nudge, not a hard block). */
export const INGREDIENT_VERIFY_REVIEW_AVG_THRESHOLD = 0.45;

/** If any line falls below this minimum, always nudge review — one bad line can dominate kcal. */
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
