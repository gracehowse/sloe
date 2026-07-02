/**
 * ENG-1299 — recipe-level micronutrient aggregation helpers.
 *
 * The verify pipeline (`verifyIngredients`) now carries an optional
 * `micros` map per ingredient row — ABSOLUTE values at that row's scaled
 * gram weight, in the canonical camelCase `nutrition_entries.nutrition_micros`
 * keys (see `MICRO_LINES` in `microNutrientDisplay.ts` / `parseOffMicrosPer100g`).
 *
 * These helpers roll per-row maps up to the per-serving panel persisted on
 * `recipes.nutrition_micros`, using the SAME rounding convention as the
 * food-log commit path (`scaleMicrosPerServing`): keys ending `G` → 1dp,
 * everything else (mg / mcg) → 0dp. Zero / non-finite values are dropped —
 * absent means "source did not publish", never zero.
 *
 * Shared web + mobile: mobile imports via `@suppr/shared/nutrition/recipeMicros`.
 */

import { scaleMicrosPerServing } from "./scaleMicrosPerServing";

/** Sum a list of absolute micro maps. Null/undefined entries are skipped. */
export function sumMicroMaps(
  maps: readonly (Record<string, number> | null | undefined)[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of maps) {
    if (!m) continue;
    for (const [k, v] of Object.entries(m)) {
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) continue;
      out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

/**
 * Aggregate per-ingredient absolute micro maps into the per-serving panel
 * persisted on `recipes.nutrition_micros`.
 *
 * Rounding happens ONCE, after the sum + division, via
 * `scaleMicrosPerServing(total, 1/servings)` — the same helper the food-log
 * commit path uses — so recipe-level values follow the exact food-log
 * decimal convention.
 */
export function perServingMicrosFromRows(
  rowMicros: readonly (Record<string, number> | null | undefined)[],
  servings: number,
): Record<string, number> {
  const safeServings =
    Number.isFinite(servings) && servings > 0 ? servings : 1;
  return scaleMicrosPerServing(sumMicroMaps(rowMicros), 1 / safeServings);
}
