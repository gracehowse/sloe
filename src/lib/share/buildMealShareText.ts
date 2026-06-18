/**
 * F-154 (2026-05-10) — per-meal share text builder.
 *
 * Returns a short, copy-paste-friendly summary of a single logged meal.
 * Critically the payload is THE MEAL'S nutrition only — never the user's
 * targets, never the day's budget, never the user's identity. The
 * "husband has different macros" tester complaint resolves naturally
 * because there is nothing personal to leak.
 */
export type ShareableMeal = {
  recipeTitle: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portionMultiplier?: number;
};

export function buildMealShareText(meal: ShareableMeal): string {
  const portion =
    meal.portionMultiplier && meal.portionMultiplier !== 1
      ? `${formatPortion(meal.portionMultiplier)} servings`
      : "1 serving";
  const macros = `${Math.round(meal.protein)}p ${Math.round(meal.carbs)}c ${Math.round(meal.fat)}f`;
  return `${meal.recipeTitle.trim()} · ${portion}\n${Math.round(meal.calories)} kcal · ${macros}\n\nvia Sloe`;
}

function formatPortion(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return (Math.round(n * 10) / 10).toString();
}
