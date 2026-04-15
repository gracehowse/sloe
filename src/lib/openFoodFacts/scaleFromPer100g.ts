/** Scale Open Food Facts / label values that are stored per 100 g to an actual portion mass. */
export function scaleFromPer100gGrams(
  per100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiberG: number;
    sugarG?: number;
    sodiumMg?: number;
  },
  grams: number,
): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
} {
  const f = grams / 100;
  return {
    calories: Math.round(per100g.calories * f),
    protein: Math.round(per100g.protein * f * 10) / 10,
    carbs: Math.round(per100g.carbs * f * 10) / 10,
    fat: Math.round(per100g.fat * f * 10) / 10,
    fiberG: Math.round((per100g.fiberG ?? 0) * f * 10) / 10,
    sugarG: Math.round((per100g.sugarG ?? 0) * f * 10) / 10,
    sodiumMg: Math.round((per100g.sodiumMg ?? 0) * f),
  };
}
