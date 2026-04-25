// F-77 (2026-04-25) — reject physically-impossible OFF / Edamam / USDA-branded
// nutrition rows before they reach search results. Closes the "Eggs · 1 egg
// 40 g · 210 kcal · 3 g protein" failure mode where an OFF user-uploaded row
// for an unrelated food named "Eggs" outranked verified USDA generics.
//
// Atwater check: kcal_per_100g should be within tolerance of
// 4·protein + 4·carbs + 9·fat. Strict by default; the tolerance covers
// real-world rounding, alcohol kcal (7 kcal/g, not modelled here), fibre
// kcal differences, and per-source rounding on the macros.

export type MacrosPer100gShape = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type PlausibilityVerdict =
  | { ok: true }
  | { ok: false; reason: "atwater_mismatch" | "out_of_range" | "all_zero" | "single_macro_only" };

const KCAL_MIN = 0;
const KCAL_MAX = 900; // pure fat tops at 900 kcal/100g; anything above is junk
const TOL_ABS = 25;   // absolute kcal tolerance
const TOL_PCT = 0.20; // 20% relative tolerance

/**
 * Returns ok:true when the per-100g macros pass an Atwater plausibility
 * check. Use at every ingest point that can persist a search hit
 * (OFF search, OFF barcode lookup, Edamam search) so user-facing surfaces
 * never see a row whose claimed kcal does not match its claimed macros.
 *
 * Reasons:
 *  - all_zero: every macro AND kcal is 0/missing — caller should treat as
 *    "no nutrition data" and skip.
 *  - out_of_range: kcal/100g outside 0–900 window.
 *  - single_macro_only: only one macro is non-zero AND kcal is implied to
 *    come from that macro, but kcal disagrees with it (e.g. 210 kcal claimed
 *    from "3 g protein" alone). This catches the screenshot case.
 *  - atwater_mismatch: |kcal − (4P + 4C + 9F)| exceeds max(TOL_ABS, TOL_PCT·kcal).
 */
export function checkMacroPlausibility(m: MacrosPer100gShape): PlausibilityVerdict {
  const cal = Number(m.calories) || 0;
  const p = Number(m.protein) || 0;
  const c = Number(m.carbs) || 0;
  const f = Number(m.fat) || 0;

  if (cal === 0 && p === 0 && c === 0 && f === 0) {
    return { ok: false, reason: "all_zero" };
  }

  if (cal < KCAL_MIN || cal > KCAL_MAX) {
    return { ok: false, reason: "out_of_range" };
  }

  const atwater = 4 * p + 4 * c + 9 * f;
  const tol = Math.max(TOL_ABS, cal * TOL_PCT);
  const diff = Math.abs(cal - atwater);

  // Single-macro case (the screenshot bug): one macro non-zero, kcal
  // disagrees substantially with it.
  const nonZeroCount = (p > 0 ? 1 : 0) + (c > 0 ? 1 : 0) + (f > 0 ? 1 : 0);
  if (nonZeroCount === 1 && cal > 50 && diff > tol) {
    return { ok: false, reason: "single_macro_only" };
  }

  // General case: macros provided, but kcal disagrees with Atwater sum.
  // Skip the check when all three macros are zero (kcal-only row) — those
  // are handled by the all_zero / out_of_range cases above.
  if (nonZeroCount > 0 && diff > tol) {
    return { ok: false, reason: "atwater_mismatch" };
  }

  return { ok: true };
}

export function isPlausibleMacrosPer100g(m: MacrosPer100gShape): boolean {
  return checkMacroPlausibility(m).ok;
}
