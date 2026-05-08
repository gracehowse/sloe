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
    /** F-74 cross-device (2026-05-08): caffeine + alcohol per 100g
     *  flow through every search source (USDA, OFF, Edamam, generic
     *  beverages). Persisting them lets the recipe-level rollup
     *  populate `recipes.caffeine_mg` / `alcohol_g`, which the
     *  planner-tab and recipe-detail "Add to today" log paths read. */
    caffeineMgPer100g?: number | null;
    alcoholGPer100g?: number | null;
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
  caffeineMg: number;
  alcoholG: number;
} {
  const f = grams / 100;
  const caff = per100g.caffeineMgPer100g;
  const alc = per100g.alcoholGPer100g;
  return {
    calories: Math.round(per100g.calories * f),
    protein: Math.round(per100g.protein * f * 10) / 10,
    carbs: Math.round(per100g.carbs * f * 10) / 10,
    fat: Math.round(per100g.fat * f * 10) / 10,
    fiberG: Math.round((per100g.fiberG ?? 0) * f * 10) / 10,
    sugarG: Math.round((per100g.sugarG ?? 0) * f * 10) / 10,
    sodiumMg: Math.round((per100g.sodiumMg ?? 0) * f),
    caffeineMg: typeof caff === "number" && Number.isFinite(caff) && caff > 0 ? Math.round(caff * f) : 0,
    alcoholG: typeof alc === "number" && Number.isFinite(alc) && alc > 0 ? Math.round(alc * f * 10) / 10 : 0,
  };
}
