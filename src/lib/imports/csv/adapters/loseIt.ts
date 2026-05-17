import { canonHeader, parseLocaleDate } from "../csvPrimitives";
import type { CsvImportAdapter } from "../types";

/**
 * Lose It CSV adapter.
 *
 * Lose It exports via Settings → Export Data on the web app. The CSV
 * format is well-documented and stable across years of releases:
 *
 *   `Date, Name, Type, Quantity, Units, Calories, Fat (g),`
 *   `Cholesterol (mg), Sodium (mg), Carbohydrates (g), Fiber (g),`
 *   `Sugars (g), Protein (g)`
 *
 * Notable differences from MFP:
 *
 *   1. Separate `Quantity` + `Units` columns (MFP bakes both into the
 *      `Food` cell). The macros in the row are PRE-MULTIPLIED for the
 *      `Quantity × Units` portion, so the adapter can ignore those
 *      columns and pass the macros through unchanged.
 *   2. `Type` (not `Meal`) is the slot column. Values: `Breakfast`,
 *      `Lunch`, `Dinner`, `Snacks`. No user-renames possible (unlike
 *      MFP), so the mapper is exhaustive.
 *   3. Macro headers include unit suffixes (`Fat (g)`, `Sodium (mg)`).
 *      The framework's `canonHeader` strips parentheses so
 *      `"fatg"` and `"sodiummg"` are the canonical forms we match.
 *   4. Date format is locale-dependent (US m/d/yyyy by default; the
 *      Lose It export honours the account's locale setting).
 *      Reuses `parseLocaleDate` from `csvPrimitives` for the same
 *      ISO-first / US-default / UK-fallback ladder MFP uses.
 *
 * Detection: the combination of `Quantity` + `Units` columns is the
 * unambiguous Lose It marker — MFP, Cronometer, and MacroFactor all
 * lack BOTH (Cronometer has `Amount`, MFP bakes quantity into the food
 * name). If a future format ever shares those columns the registry
 * will need ordering to disambiguate.
 */
function mapLoseItMealToSlot(
  raw: string,
): "breakfast" | "lunch" | "dinner" | "snack" {
  const c = canonHeader(raw);
  if (c === "breakfast") return "breakfast";
  if (c === "lunch") return "lunch";
  if (c === "dinner") return "dinner";
  // Lose It's "Snacks" plural; framework's canonical slot is singular.
  if (c.startsWith("snack")) return "snack";
  // Defensive fallback (no Lose It-tested user-rename mechanism, but
  // future releases might add one): never throw on unknown labels.
  return "snack";
}

export const loseItAdapter: CsvImportAdapter = {
  source: "lose-it",
  displayName: "Lose It",
  headers: {
    date: ["date"],
    meal: ["type"],
    name: ["name"],
    calories: ["calories", "energy", "kcal"],
    protein: ["protein", "proteing"],
    carbs: ["carbohydrates", "carbohydratesg", "carbs", "carbohydrate"],
    fat: ["fat", "fatg", "totalfat"],
    sodium: ["sodium", "sodiummg"],
    sugar: ["sugars", "sugarsg", "sugar", "sugarg"],
    fiber: ["fiber", "fiberg", "fibre", "fibreg"],
  },
  requiredColumns: ["date", "name"],
  parseDate: parseLocaleDate,
  mapMeal: mapLoseItMealToSlot,
  /**
   * Lose It's distinguishing combination: `Name` + `Type` + `Quantity`
   * + `Units` + macro columns. The `Quantity` + `Units` pair is the
   * cheapest discriminator vs the other CSV exporters Suppr targets.
   */
  detect(canonicalHeaders) {
    const has = (k: string) => canonicalHeaders.includes(k);
    return (
      has("name") &&
      has("type") &&
      has("quantity") &&
      has("units") &&
      has("calories")
    );
  },
};

export { mapLoseItMealToSlot };
