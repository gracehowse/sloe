import { canonHeader, parseLocaleDate } from "../csvPrimitives";
import type { CsvImportAdapter } from "../types";

/**
 * Cronometer CSV adapter (Servings export).
 *
 * Cronometer exports via Settings → Account → Export Data → "Daily
 * Nutrition Summary" or "Servings". Suppr targets the **Servings**
 * export — the row-per-meal-entry shape that mirrors how MFP and
 * Lose It export. The "Daily Nutrition Summary" export is one row
 * per day and isn't useful for history bridging.
 *
 * Servings CSV columns (stable across Cronometer 2024 / 2025 releases):
 *
 *   `Day, Time, Group, Food Name, Amount,`
 *   `Energy (kcal), Alcohol (g), Caffeine (mg), ...,`
 *   `Cholesterol (mg), Fat (g), Fiber (g), Protein (g),`
 *   `Sodium (mg), Carbs (g), Sugars (g), ...` (40+ nutrient columns)
 *
 * Notable differences from MFP and Lose It:
 *
 *   1. `Day` (not `Date`) for the date column. Cronometer uses ISO
 *      `YYYY-MM-DD` by default; account-locale changes can flip it
 *      to `m/d/yyyy` or `d/m/yyyy`. `parseLocaleDate` covers all
 *      three formats with the same ISO-first / US-default ladder.
 *   2. `Group` (not `Meal` / `Type`) for the meal slot. Values:
 *      `Breakfast`, `Lunch`, `Dinner`, `Snacks`, plus user-defined
 *      group names. Built-ins map cleanly; user-renames fall through
 *      to `snack` like MFP.
 *   3. `Food Name` (not `Food` / `Name`) — two words, both
 *      capitalised. `canonHeader` collapses spaces so the canonical
 *      key is `"foodname"`.
 *   4. `Amount` (not `Quantity` + `Units`) — single column with the
 *      portion size baked in as a string ("1 cup", "150 g",
 *      "1 medium"). Macros in the row are pre-multiplied for the
 *      Amount, so the adapter can ignore the column entirely.
 *   5. Macro headers carry unit suffixes (`Fat (g)`, `Energy (kcal)`,
 *      `Sodium (mg)`). The framework's `canonHeader` strips them.
 *   6. Caffeine / Alcohol / Cholesterol / 30+ micronutrient columns
 *      exist but Suppr's canonical row only carries calories +
 *      headline macros + sodium + sugar + fiber — the adapter
 *      ignores everything else.
 *
 * Detection: the combination of `Day` + `Group` + `Food Name` +
 * `Amount` is the unambiguous Cronometer marker. MFP uses
 * `Date` / `Meal` / `Food`, Lose It uses `Date` / `Type` /
 * `Quantity` + `Units`. The `Day` header alone is distinctive
 * (MFP and Lose It both use `Date`).
 */
function mapCronometerGroupToSlot(
  raw: string,
): "breakfast" | "lunch" | "dinner" | "snack" {
  const c = canonHeader(raw);
  if (c === "breakfast" || c.startsWith("break")) return "breakfast";
  if (c === "lunch") return "lunch";
  if (c === "dinner" || c.startsWith("supper")) return "dinner";
  // Cronometer's "Snacks" plural + any user-defined group name.
  // Default fallback is the least disruptive bucket.
  return "snack";
}

export const cronometerAdapter: CsvImportAdapter = {
  source: "cronometer",
  displayName: "Cronometer",
  headers: {
    date: ["day"],
    meal: ["group"],
    name: ["foodname"],
    calories: ["energykcal", "energy", "calories", "kcal"],
    protein: ["proteing", "protein"],
    carbs: ["carbsg", "carbs", "carbohydratesg", "carbohydrates"],
    fat: ["fatg", "fat", "totalfat"],
    sodium: ["sodiummg", "sodium"],
    sugar: ["sugarsg", "sugars", "sugar"],
    fiber: ["fiberg", "fiber", "fibreg", "fibre"],
  },
  requiredColumns: ["date", "name"],
  parseDate: parseLocaleDate,
  mapMeal: mapCronometerGroupToSlot,
  /**
   * Cronometer's distinguishing combination: `Day` + `Group` +
   * `Food Name` + `Amount`. The `Day` header alone is distinctive
   * (MFP + Lose It both use `Date`); requiring the other three
   * eliminates false positives on any future export that reuses
   * `Day` as a column name.
   */
  detect(canonicalHeaders) {
    const has = (k: string) => canonicalHeaders.includes(k);
    return (
      has("day") &&
      has("group") &&
      has("foodname") &&
      has("amount")
    );
  },
};

export { mapCronometerGroupToSlot };
