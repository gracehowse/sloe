/**
 * P2-26 (2026-04-25) — shared net-carbs lens.
 *
 * Net carbs (US convention) = total carbs − fibre. Sugar alcohols
 * (erythritol, xylitol, maltitol) are subtracted in some keto
 * communities but Suppr does not currently track sugar alcohols at the
 * row level — adding the column to `nutrition_entries` and `recipes`
 * is a future expansion. v0 ships `carbs − fibre` only.
 *
 * Single source of truth so web + mobile can't drift on the
 * subtraction rule. Every surface that swaps "Carbs" for "Net carbs"
 * (Tracker macro tile, Settings copy, Recipe Detail nutrition table,
 * planner row, weekly recap) consumes one of these helpers.
 *
 * The lens is opt-in via `profiles.net_carbs_lens_enabled`. When
 * disabled, every helper returns the total-carbs value unchanged.
 */

/**
 * Compute net carbs for a row given total carbs + optional fibre.
 *
 * Returns total carbs unchanged when `lensEnabled` is false. When the
 * lens is on:
 *   - Subtracts fibre from carbs.
 *   - Floors at 0 (a row with more fibre than carbs from a parsing or
 *     rounding error must not flip negative).
 *   - Returns total carbs unchanged when fibre is null / undefined /
 *     non-finite — refuse rather than guess fibre.
 */
export function netCarbsForRow(
  carbs: number,
  fibre: number | null | undefined,
  lensEnabled: boolean,
): number {
  if (!lensEnabled) return carbs;
  if (typeof fibre !== "number" || !Number.isFinite(fibre) || fibre <= 0) return carbs;
  const net = carbs - fibre;
  return net > 0 ? net : 0;
}

/**
 * Display-side label switching. Returns "Net carbs" when the lens is
 * on AND fibre is known (so the math is meaningful); otherwise
 * "Carbs". Centralising here keeps the labels consistent across
 * platforms and prevents "Net carbs: 30g" headlines from rendering
 * with no fibre data behind them (i.e. silently equal to total carbs).
 */
export function carbsLabel(
  fibre: number | null | undefined,
  lensEnabled: boolean,
): "Net carbs" | "Carbs" {
  if (!lensEnabled) return "Carbs";
  if (typeof fibre !== "number" || !Number.isFinite(fibre) || fibre <= 0) {
    return "Carbs";
  }
  return "Net carbs";
}

/**
 * Short-form label for compact surfaces (macro tile glyphs, planner
 * rows). Uppercase prefix; same fallback as `carbsLabel`.
 */
export function carbsShortLabel(
  fibre: number | null | undefined,
  lensEnabled: boolean,
): "NET C" | "C" {
  return carbsLabel(fibre, lensEnabled) === "Net carbs" ? "NET C" : "C";
}
