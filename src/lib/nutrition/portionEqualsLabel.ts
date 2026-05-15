/**
 * 2026-05-15 — shared helper for the "= …" suffix shown below the
 * quantity stepper in the Food Search detail card.
 *
 * Two surfaces use this:
 *   - `apps/mobile/components/food-search/FoodSearchPanel.tsx`
 *   - `src/app/components/food-search/FoodSearchPanel.tsx`
 *
 * Behaviour:
 *   - When the portion has a known gram weight, show `= ${totalGrams} g`.
 *   - When `gramWeight === 0` (FatSecret per-serving-only foods), show
 *     the portion count. Many FatSecret labels already start with a
 *     digit ("1 pack", "10 pieces"), so for `quantity === 1` we render
 *     just the label to avoid the "= 1 1 pack" duplication. For
 *     `quantity > 1` we render `${quantity} × ${label}` to keep the math
 *     legible without trying to pluralise unknown nouns.
 */
export function portionEqualsLabel(args: {
  quantity: number;
  label: string;
  gramWeight: number;
  totalGrams: number;
}): string {
  const { quantity, label, gramWeight, totalGrams } = args;
  if (gramWeight === 0) {
    if (quantity === 1 && /^\d/.test(label)) {
      return `= ${label}`;
    }
    return `= ${quantity} × ${label}`;
  }
  return `= ${totalGrams} g`;
}
