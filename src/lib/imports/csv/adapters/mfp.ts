import { canonHeader, parseLocaleDate } from "../csvPrimitives";
import type { CsvImportAdapter } from "../types";

/**
 * MyFitnessPal CSV adapter.
 *
 * MFP's web export ships a row-per-meal-entry with:
 *   `Date, Meal, Food, Calories, Carbs, Fat, Protein` and
 *   optionally `Sodium`, `Sugar`, `Fiber`, `Cholesterol`. Some regions
 *   add unit suffixes to headers (`Calories (kcal)`, `Sodium (mg)`)
 *   — the framework's `canonHeader` strips parentheses and units so
 *   the same aliases match both forms.
 *
 * Date format is locale-dependent. MFP's US export is `m/d/yyyy`;
 * UK is `d/m/yyyy`. The shared {@link parseLocaleDate} handles both
 * (with the heuristic that ISO wins when present, US wins when the
 * first component is a valid month, day-first only when the first
 * component would be an invalid month).
 *
 * Meal labels are user-renameable in MFP, so the map below accepts
 * the four built-ins plus a handful of common renames seen in
 * support tickets. Unknown labels fall through to `"snack"` — the
 * least disruptive bucket.
 */
function mapMfpMealToSlot(
  raw: string,
): "breakfast" | "lunch" | "dinner" | "snack" {
  const c = canonHeader(raw);
  if (c.startsWith("break") || c === "morning" || c === "am") return "breakfast";
  if (c.startsWith("lunch") || c === "noon" || c === "midday") return "lunch";
  if (
    c.startsWith("dinner") ||
    c.startsWith("supper") ||
    c === "evening" ||
    c === "pm"
  )
    return "dinner";
  return "snack";
}

export const mfpAdapter: CsvImportAdapter = {
  source: "mfp",
  displayName: "MyFitnessPal",
  headers: {
    date: ["date"],
    meal: ["meal", "mealtype"],
    name: ["food", "fooddescription", "name"],
    calories: ["calories", "energy", "kcal"],
    protein: ["protein", "proteing"],
    carbs: ["carbs", "carbohydrates", "carbohydrate"],
    fat: ["fat", "totalfat"],
    sodium: ["sodium", "sodiummg"],
    sugar: ["sugar", "sugars", "sugarg"],
    fiber: ["fiber", "fibre"],
  },
  // Hard requirements — every other column may be missing without
  // failing the import; the row is just marked incomplete.
  requiredColumns: ["date", "name"],
  parseDate: parseLocaleDate,
  mapMeal: mapMfpMealToSlot,
  /**
   * Detection: MFP's hallmark is the combo of `meal` + `food` + a
   * macro column, with NO separate quantity/units column (those are
   * baked into the food name). The "no separate quantity column"
   * check is what distinguishes MFP from Lose It (which always
   * exports `Quantity` + `Units` as separate columns). The `!has("servings")`
   * guard distinguishes MFP from MacroFactor, which exports both
   * `Serving Size` + `Servings` alongside `Food`.
   */
  detect(canonicalHeaders) {
    const has = (k: string) => canonicalHeaders.includes(k);
    return (
      has("food") &&
      (has("meal") || has("mealtype")) &&
      has("calories") &&
      !has("quantity") &&
      !has("units") &&
      !has("servings") &&
      !has("servingsize")
    );
  },
};

export { mapMfpMealToSlot };
