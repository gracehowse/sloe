/**
 * FDA Daily Values (DV) reference table — used by the Today Micros widget
 * AND the FullNutrientPanelSheet to compute %DV for the curated set of
 * micronutrients we surface to the user.
 *
 * Sources (canonical):
 *  - FDA "Daily Value on the Nutrition and Supplement Facts Labels" (2020):
 *    https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels
 *  - 21 CFR 101.9(c) — Reference Daily Intake (RDI) for adults and
 *    children ≥ 4y: https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-A/section-101.9
 *
 * Rationale for the breadth (35 entries): the Cronometer power-user
 * persona expects the all-nutrients sheet to show the full Nutrition
 * Facts label set, not just the 8-tile widget headlines. We surface
 * macros + 13 vitamins + 14 minerals so deficiencies in less-talked-
 * about nutrients (e.g. iodine, choline, molybdenum) are visible.
 *
 * Limit semantics: `isLimitNutrient(key) === true` flags that going
 * **over** 100% is a warning, not an achievement. The display layer is
 * responsible for switching colour from success → warning → danger as
 * %DV climbs; the helper here only returns the raw percentage. Three
 * nutrients are LIMIT-style on the standard FDA label:
 *   - sodium (cardiovascular)
 *   - saturated fat
 *   - cholesterol
 *
 * Sugar is intentionally `null` (no DV defined on the FDA label for
 * total sugars; only ADDED sugars carry a DV of 50g, and we currently
 * track total sugar, not added). Callers must handle the null case.
 *
 * Keys mirror the camelCase nutrient keys used across `MICRO_LINES`
 * (`src/lib/nutrition/microNutrientDisplay.ts`) so callers can pass
 * values straight from `sumMicrosFromLoggedMeals()` output. Two macro
 * keys (`totalFatG`, `totalCarbsG`) are added here for the full-panel
 * sheet even though they are summed via the macro path, not the micro
 * path.
 *
 * Returns `null` when:
 *  - the nutrient key isn't in the curated DV map,
 *  - the amount is not a finite number,
 *  - the amount is negative (treated as malformed input).
 */

/**
 * Canonical FDA 2020 DV reference values, keyed to the nutrient keys
 * used throughout the codebase. Frozen at module init so a runtime
 * mutation can't silently drift the labelling.
 *
 * Numbers reflect 21 CFR 101.9(c) Table 1. Where the FDA spec lists a
 * "less than" target (sat fat, sodium, cholesterol), we still record
 * the absolute reference number — the LIMIT semantic comes from
 * `isLimitNutrient()` below.
 */
export const DAILY_VALUES: Readonly<Record<string, number>> = Object.freeze({
  // ---- Macros (g unless noted) ----
  fiberG: 28, // FDA 2020 DV (28g; older 25g rounded up)
  sodiumMg: 2300, // LIMIT
  totalFatG: 78, // 21 CFR 101.9(c)(2)
  saturatedFatG: 20, // LIMIT — 21 CFR 101.9(c)(2)
  cholesterolMg: 300, // LIMIT — 21 CFR 101.9(c)(3)
  totalCarbsG: 275, // 21 CFR 101.9(c)(6)
  proteinG: 50, // 21 CFR 101.9(c)(7)
  // sugarG: NO DV on FDA label for total sugars (added sugars = 50g but
  // we don't track added sugars yet). Intentionally absent from the map.

  // ---- Vitamins ----
  vitaminAMcgRae: 900,
  vitaminCMg: 90,
  vitaminDMcg: 20,
  vitaminEMg: 15,
  vitaminKMcg: 120,
  thiaminMg: 1.2, // B1
  riboflavinMg: 1.3, // B2
  niacinMg: 16, // B3
  vitaminB6Mg: 1.7,
  biotinMcg: 30, // B7
  folateMcg: 400, // B9 — FDA spec is mcg DFE
  vitaminB12Mcg: 2.4,
  pantothenicAcidMg: 5,
  cholineMg: 550,

  // ---- Minerals ----
  calciumMg: 1300,
  ironMg: 18,
  magnesiumMg: 420,
  potassiumMg: 4700,
  zincMg: 11,
  phosphorusMg: 1250,
  iodineMcg: 150,
  copperMg: 0.9,
  seleniumMcg: 55,
  manganeseMg: 2.3,
  chromiumMcg: 35,
  molybdenumMcg: 45,
});

/**
 * Set of nutrient keys whose DV is a *limit*, not a target. Callers
 * (the widget colour ramp, the panel sheet bar tone) use this to flip
 * the 100%-is-good semantic to 100%-is-warning. Sugar is not in this
 * set because it has no DV at all (see comment above).
 */
const LIMIT_NUTRIENT_KEYS: ReadonlySet<string> = new Set<string>([
  "sodiumMg",
  "saturatedFatG",
  "cholesterolMg",
]);

/**
 * %DV for a single nutrient amount. Returns `null` when no DV exists or
 * when the amount is invalid. Result is rounded to the nearest integer.
 *
 * Note on rounding: %DV labels on food packaging typically round to
 * whole numbers (FDA labelling rules). We mirror that for display
 * consistency.
 */
export function dailyValuePercent(
  nutrientKey: string,
  amount: number,
): number | null {
  if (typeof nutrientKey !== "string" || nutrientKey.length === 0) return null;
  const dv = DAILY_VALUES[nutrientKey];
  if (typeof dv !== "number" || dv <= 0) return null;
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  if (amount < 0) return null;
  return Math.round((amount / dv) * 100);
}

/**
 * Whether the nutrient is treated as a LIMIT rather than a target. Used
 * by the widget + panel sheet to switch colour ramps (limit nutrients
 * go warning at 80% and danger at 100%; target nutrients stay success
 * up to 100% and beyond).
 *
 * Currently three keys: sodium, saturated fat, cholesterol — matching
 * the "less than" rows on the FDA Nutrition Facts label.
 */
export function isLimitNutrient(nutrientKey: string): boolean {
  return LIMIT_NUTRIENT_KEYS.has(nutrientKey);
}

/**
 * Stable footer attribution string for any UI surface that displays %DV
 * derived from this table. Centralised here so a future spec revision
 * (e.g. updated DRI) requires changing one string, not N. Mirrors the
 * citation block at the top of this file.
 */
export const DAILY_VALUES_SOURCE_LABEL =
  "Daily Values: FDA 2020 · 21 CFR 101.9(c)";
