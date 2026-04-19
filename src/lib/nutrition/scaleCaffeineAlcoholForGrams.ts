/**
 * F-13 (2026-04-19) — proportional scaler for caffeine (mg) + alcohol (g)
 * per 100 g references to an actual logged portion mass.
 *
 * Pure: no I/O, no time, no platform APIs. Web and mobile both call this
 * from the `FoodSearch` -> `nutrition_entries` insert path so the daily
 * totals (`profiles.extra_caffeine_by_day`, `profiles.extra_alcohol_g_by_day`)
 * cannot drift between platforms.
 *
 * Contract:
 *   - `grams` — portion weight in grams. Null / non-finite / negative → both
 *     outputs are 0 (never guess).
 *   - `caffeineMgPer100g` — reference per-100 g caffeine in mg. Null means
 *     "source didn't expose the nutrient" — output is 0. Zero / negative /
 *     non-finite also fold to 0.
 *   - `alcoholGPer100g` — same contract, grams of ethanol per 100 g food.
 *
 * Output rounding:
 *   - Caffeine rounded to the nearest integer mg (daily bucket is mg).
 *   - Alcohol rounded to 1 decimal g (ethanol totals are typically 8–30 g
 *     per drink; 1 dp keeps small deltas visible in the weekly sum).
 *
 * Invariants:
 *   - Both outputs are always >= 0.
 *   - Null `caffeineMgPer100g` with a non-null `alcoholGPer100g` still
 *     returns a real `alcoholG` — the two values are independent.
 *   - Project rule: no invented nutrition numbers. If the source didn't
 *     publish the nutrient per 100 g, we return 0 here — callers must not
 *     substitute a heuristic.
 */
export function scaleCaffeineAlcohol(args: {
  grams: number | null;
  caffeineMgPer100g: number | null;
  alcoholGPer100g: number | null;
}): { caffeineMg: number; alcoholG: number } {
  const { grams, caffeineMgPer100g, alcoholGPer100g } = args;

  // Defensive: a missing / zero / negative / non-finite gram weight makes
  // the scaling factor meaningless. Return zeros; do NOT throw — this is
  // called on a hot path after a successful Supabase insert, and we must
  // never roll back the log because of a metadata parse.
  if (grams == null || !Number.isFinite(grams) || grams <= 0) {
    return { caffeineMg: 0, alcoholG: 0 };
  }

  const f = grams / 100;

  // Caffeine — round to integer mg. Clamp at 0 so a pathological negative
  // from a bad upstream envelope can never subtract from the daily total.
  let caffeineMg = 0;
  if (
    typeof caffeineMgPer100g === "number" &&
    Number.isFinite(caffeineMgPer100g) &&
    caffeineMgPer100g > 0
  ) {
    caffeineMg = Math.max(0, Math.round(caffeineMgPer100g * f));
  }

  // Alcohol — round to 1 decimal g. Same clamp.
  let alcoholG = 0;
  if (
    typeof alcoholGPer100g === "number" &&
    Number.isFinite(alcoholGPer100g) &&
    alcoholGPer100g > 0
  ) {
    alcoholG = Math.max(0, Math.round(alcoholGPer100g * f * 10) / 10);
  }

  return { caffeineMg, alcoholG };
}
