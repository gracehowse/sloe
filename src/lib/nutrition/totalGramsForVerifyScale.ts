/**
 * Total food mass in grams for scaling per-100g nutrition on the recipe verify screen.
 * When `unit` or `chosenPortion` is g/ml, `amount` is already grams (ml uses 1:1 for scaling).
 * Otherwise `amount` is a count of `chosenPortion` units (e.g. 2 × 170 g label servings).
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
