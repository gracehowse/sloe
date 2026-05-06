/**
 * Scale a per-serving micros map by `quantity` (e.g. "log 2 servings"
 * of a FatSecret per-serving-only food). Used by the food-search
 * commit path on both web (NutritionTracker / RecipeDetail) and
 * mobile (Today log / create-recipe / recipe wizard / import-shared
 * / recipe verify) when `macrosPer100g` is null and there is no
 * gram grounding.
 *
 * Decimal convention mirrors `scaleMicrosForGrams` in
 * `src/lib/openFoodFacts/parseOffMicros.ts`:
 *   - keys ending `G` (grams) → 1dp
 *   - keys ending `Mcg`       → 0dp
 *   - everything else (mg)    → 0dp
 *
 * Zero / non-finite values are dropped; same "never invent" rule
 * the rest of the micros pipeline follows.
 */
export function scaleMicrosPerServing(
  microsPerServing: Record<string, number> | null | undefined,
  quantity: number,
): Record<string, number> {
  const ms = microsPerServing ?? {};
  if (!Number.isFinite(quantity) || quantity <= 0) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(ms)) {
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) continue;
    const scaled = v * quantity;
    if (!Number.isFinite(scaled) || scaled <= 0) continue;
    const decimals = k.endsWith("G") ? 1 : 0;
    const factor = 10 ** decimals;
    const rounded = Math.round(scaled * factor) / factor;
    if (rounded > 0) out[k] = rounded;
  }
  return out;
}
