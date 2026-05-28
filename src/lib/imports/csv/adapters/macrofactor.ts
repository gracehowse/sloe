import { canonHeader } from "../csvPrimitives";
import type { CsvImportAdapter } from "../types";

/**
 * MacroFactor CSV adapter.
 *
 * MacroFactor's food diary export (Profile → Export Data → CSV) ships a
 * row-per-entry with:
 *
 *   `Date, Meal, Food, Serving Size, Servings, Calories,`
 *   `Protein (g), Carbohydrates (g), Fat (g), Fiber (g),`
 *   `Sugar (g), Sodium (mg), Saturated Fat (g), Trans Fat (g),`
 *   `Cholesterol (mg), Potassium (mg), ...`
 *
 * Date format: ISO `YYYY-MM-DD` (MacroFactor never emits locale formats).
 *
 * Notable differences from other adapters:
 *
 *   1. `Serving Size` + `Servings` — MacroFactor tracks portion as a
 *      description ("100 g", "1 cup") + a multiplier ("1.5"). The
 *      macros in the row are already multiplied for the total servings,
 *      so both columns can be ignored; Suppr uses the pre-multiplied
 *      calorie/macro values directly.
 *   2. `Carbohydrates (g)` — not the shorter `Carbs (g)` used by MFP.
 *      After canonicalisation: `carbohydratesg`.
 *   3. Macro headers all carry `(g)` / `(mg)` unit suffixes.
 *      `canonHeader` strips them, so "Protein (g)" → "proteing".
 *   4. Date is always ISO — no `parseLocaleDate` override needed.
 *
 * Detection: the combination of `servingsize` + `servings` is
 * unambiguous — MFP bakes the portion into the food name (no separate
 * quantity columns), Lose It splits it into `Quantity` + `Units`,
 * Cronometer uses `Amount`, and no other registered adapter has the
 * `servingsize` header. Requiring `carbohydratesg` (not `carbsg` /
 * `carbs`) tightens the guard further.
 */
function mapMacroFactorMealToSlot(
  raw: string,
): "breakfast" | "lunch" | "dinner" | "snack" {
  const c = canonHeader(raw);
  if (c === "breakfast" || c.startsWith("break") || c === "morning") return "breakfast";
  if (c === "lunch" || c === "noon" || c === "midday") return "lunch";
  if (c === "dinner" || c.startsWith("supper") || c === "evening") return "dinner";
  return "snack";
}

export const macrofactorAdapter: CsvImportAdapter = {
  source: "macrofactor",
  displayName: "MacroFactor",
  headers: {
    date: ["date"],
    meal: ["meal"],
    name: ["food", "foodname", "name"],
    calories: ["calories", "energy", "energykcal", "kcal"],
    protein: ["proteing", "protein"],
    carbs: ["carbohydratesg", "carbohydrates", "carbsg", "carbs"],
    fat: ["fatg", "fat", "totalfat"],
    sodium: ["sodiummg", "sodium"],
    sugar: ["sugarg", "sugars", "sugar"],
    fiber: ["fiberg", "fiber"],
  },
  requiredColumns: ["date", "name"],
  mapMeal: mapMacroFactorMealToSlot,
  /**
   * Detection: `servingsize` + `servings` is the MacroFactor signature.
   * No other registered adapter has a separate `Serving Size` column.
   * `carbohydratesg` (vs the shorter `carbs` MFP uses) provides a
   * second confirmation signal.
   */
  detect(canonicalHeaders) {
    const has = (k: string) => canonicalHeaders.includes(k);
    return has("servingsize") && has("servings") && (has("carbohydratesg") || has("carbohydrates"));
  },
};

export { mapMacroFactorMealToSlot };
