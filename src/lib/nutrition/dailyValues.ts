/**
 * FDA Daily Values (DV) reference table — used by the Today Micros widget
 * to compute %DV for the small set of headline micronutrients we surface.
 *
 * Sources:
 *  - FDA "Daily Value on the Nutrition and Supplement Facts Labels" (2020):
 *    https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels
 *  - Reference Daily Intake values for adults and children ≥ 4y.
 *
 * Sodium semantics: this is a LIMIT, not a target. The display layer is
 * responsible for switching colour from success → warning → danger as %DV
 * climbs; the helper here just returns the raw percentage, so callers
 * decide which colour ramp to apply.
 *
 * Keys mirror the camelCase nutrient keys used across `MICRO_LINES`
 * (`src/lib/nutrition/microNutrientDisplay.ts`) so callers can pass values
 * straight from `sumMicrosFromLoggedMeals()` output. `fiberG` is keyed
 * by `fiberG` to match the `__fiber_day` summing path used by Today.
 *
 * Returns `null` when:
 *  - the nutrient key isn't in the curated DV map,
 *  - the amount is not a finite number,
 *  - the amount is negative (treated as malformed input).
 */

/** Canonical FDA 2020 DV reference values, keyed by `MICRO_LINES` keys. */
export const DAILY_VALUES: Readonly<Record<string, number>> = Object.freeze({
  fiberG: 28,            // FDA 2020 DV; widget surfaces 30g as a friendly round target via the spec
  ironMg: 18,
  vitaminDMcg: 20,
  sodiumMg: 2300,        // LIMIT, not target
  magnesiumMg: 420,
  potassiumMg: 4700,
  calciumMg: 1300,
  vitaminCMg: 90,
});

/**
 * %DV for a single nutrient amount. Returns `null` when no DV exists or
 * when the amount is invalid. Result is rounded to the nearest integer.
 *
 * Note on rounding: %DV labels on food packaging typically round to whole
 * numbers (FDA labelling rules). We mirror that for display consistency.
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
 * by the widget to switch colour ramps (limit nutrients go warning at 80%
 * and danger at 100%; target nutrients stay success up to 100%).
 *
 * Sodium is currently the only tracked limit-style headline nutrient.
 * Adding more (e.g. saturated fat, added sugars) is safe — extend this
 * function and the widget colour logic in lockstep.
 */
export function isLimitNutrient(nutrientKey: string): boolean {
  return nutrientKey === "sodiumMg";
}
