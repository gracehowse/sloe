/**
 * Barcode correction — basis-aware per-100g scaling.
 *
 * F-20 (2026-04-19, TestFlight `AIOek8w6GKW5DdY1XK9avkE`). The "Correct
 * This Product" form lets users enter nutrition either "Per 100 g"
 * (DB-native) or "Per serving" (how many products actually print their
 * label). This helper collapses the two inputs down to the per-100g
 * snapshot the DB stores, returning `null` for any state that isn't
 * yet safe to save (no calories, missing serving size in per-serving
 * mode, etc) so the submit button can gate on a single value.
 *
 * Intentionally pure + sync — no network, no Supabase. The mobile
 * `BarcodeScannerModal` owns the input state, wiring, and the submit
 * RPC. If we port corrections to web later the scaling rule lives here
 * so both surfaces stay in sync.
 */

export type CorrectionBasis = "per100g" | "perServing";

export type CorrectionInput = {
  basis: CorrectionBasis;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /**
   * Required when `basis === "perServing"`. Ignored otherwise. Must be
   * positive for a valid per-100g projection; <= 0 returns `null`.
   */
  servingGrams?: number;
};

export type CorrectionPer100g = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

function roundTenth(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Project the user's input onto per-100g numbers, or return `null` if
 * the input is not yet valid enough to save.
 *
 *   per100g === per100g: identity (just normalise precision).
 *   perServing === scale by 100 / servingGrams.
 *
 * Calorie values are rounded to integers; macros to one decimal. Both
 * match the pre-existing DB write in `submitFoodCorrection`.
 */
export function scaleCorrectionToPer100g(input: CorrectionInput): CorrectionPer100g | null {
  const cal = Number(input.calories) || 0;
  const pro = Number(input.protein) || 0;
  const car = Number(input.carbs) || 0;
  const fat = Number(input.fat) || 0;
  if (cal <= 0) return null;

  if (input.basis === "per100g") {
    return {
      calories: Math.round(cal),
      protein: roundTenth(pro),
      carbs: roundTenth(car),
      fat: roundTenth(fat),
    };
  }

  const sg = Number(input.servingGrams);
  if (!(sg > 0)) return null;
  const f = 100 / sg;
  return {
    calories: Math.round(cal * f),
    protein: roundTenth(pro * f),
    carbs: roundTenth(car * f),
    fat: roundTenth(fat * f),
  };
}
