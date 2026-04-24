/**
 * Total food mass in grams for scaling per-100g nutrition on the recipe verify screen.
 * When `unit` or `chosenPortion` is g/ml, `amount` is already grams (ml uses 1:1 for scaling).
 * Otherwise `amount` is a count of `chosenPortion` units (e.g. 2 × 170 g label servings).
 *
 * KNOWN APPROXIMATION: the ml=g branch is accurate only for water. Oils
 * under-scale by ~9%, honey over-scales by ~42%. Pinned by a deliberately
 * failing test (T5 2026-04-24 sweep). Fix: density lookup on the matched
 * food. Policy reference: `docs/product/nutrition-approximation-policy.md` §A2.
 */
export function totalGramsForVerifyScale(
  ing: { unit: string | null; chosenPortion: { label: string; gramWeight: number } | null },
  amountNum: number,
): number {
  if (!Number.isFinite(amountNum) || amountNum <= 0) return 0;
  const unitLower = (ing.unit ?? "").trim().toLowerCase();
  const portionLabel = (ing.chosenPortion?.label ?? "").trim().toLowerCase();

  const treatAmountAsGrams =
    portionLabel === "g" ||
    portionLabel === "ml" ||
    unitLower === "g" ||
    unitLower === "ml";

  if (treatAmountAsGrams) return amountNum;

  const gw = ing.chosenPortion?.gramWeight;
  if (gw != null && Number.isFinite(gw) && gw > 0) return gw * amountNum;

  return 100 * amountNum;
}
