/**
 * formatMacro (2026-04-25) — single source of truth for macro display rounding.
 *
 * Background: pre-fix, each render site rolled its own rounding. RecipeDetail
 * used `Math.round(value)` for protein/carbs/fat (integer), MacroDetailPanel
 * used `Math.round(v * 10) / 10` (1 decimal), TodayDashboardMacroTiles did
 * neither. Result: floating-point leakage like "C 105.80000000000001g" reached
 * users when arithmetic (`servings * baseMacro`) was rendered without rounding.
 *
 * Rules (matches MFP / Lose It conventions):
 *   - calories, sodium → integer
 *   - protein, carbs, fat, fibre, sugar → 1 decimal
 *   - everything else → 1 decimal
 *
 * Use `formatMacroValue` when you want a number for math; use `formatMacro`
 * when you want a display string (with units).
 */
export type MacroKey =
  | "calories"
  | "protein"
  | "carbs"
  | "fat"
  | "fiber"
  | "fibre"
  | "sugar"
  | "sodium"
  | "netCarbs"
  | "saturated_fat";

const INTEGER_MACROS: ReadonlySet<string> = new Set(["calories", "sodium"]);

/** Rounds a numeric macro value per the per-macro rule. NaN/Infinity → 0. */
export function formatMacroValue(value: number | null | undefined, macro: MacroKey | string): number {
  if (value == null || !Number.isFinite(value)) return 0;
  if (INTEGER_MACROS.has(macro)) return Math.round(value);
  return Math.round(value * 10) / 10;
}

/**
 * Returns a display string. Pass `unit` only when you want it appended;
 * leave undefined when you'll add the unit yourself in JSX.
 *
 * Notes:
 *   - 1-decimal macros render with a trailing ".0" trimmed (so 105.0 → "105")
 *     because users find ".0" visually noisy.
 */
export function formatMacro(
  value: number | null | undefined,
  macro: MacroKey | string,
  unit?: string,
): string {
  const rounded = formatMacroValue(value, macro);
  let str: string;
  if (INTEGER_MACROS.has(macro)) {
    str = String(rounded);
  } else {
    // Trim trailing ".0" so 105.0 → "105"; keep 1 decimal otherwise (105.8).
    str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }
  return unit ? `${str}${unit}` : str;
}
