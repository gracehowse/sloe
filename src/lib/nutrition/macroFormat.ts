/**
 * Canonical macro format helper.
 *
 * 2026-05-12 (premium-bar audit, cross-cutting copy unify): macro
 * trailers across the app were rendered in three different shapes:
 *
 *   - NorthStarBlock:    `520 kcal · 38P / 42C / 18F`     (slash-separated)
 *   - EatAgain banner:   `520 kcal · P 38g · C 42g · F 18g` (letter-first)
 *   - Recipe / QuickAdd: `520 kcal · P 38g · C 42g · F 18g`  (letter-first)
 *   - Meal sections:     `520 kcal · P 38g · C 42g · F 18g`  (letter-first)
 *   - Eating-out row:    `kcal · 22p`                       (lowercase letter, no `g`)
 *
 * The audit's prescribed canonical shape is:
 *
 *   `520 kcal · 38g P · 42g C · 18g F`
 *
 * — number-with-unit first, label after, "·" separators, sentence
 * case for everything. Consistent across surfaces makes the same
 * row scannable in 1 second on every screen.
 *
 * This helper centralises the format so callers can't drift again.
 * Mobile + web share this module via the `src/lib/` boundary.
 *
 * Cases:
 *  - All four values present → `520 kcal · 38g P · 42g C · 18g F`
 *  - Empty/zero day (no log) → `— kcal · — g P · — g C · — g F`
 *  - Fiber addition (opt-in) → suffix ` · 9g Fb`
 */

export interface MacroFormatInput {
  /** Total kcal for the row. `null` / `undefined` → em-dash placeholder. */
  calories: number | null | undefined;
  /** Protein grams. `null` / `undefined` → em-dash placeholder. */
  protein: number | null | undefined;
  /** Carb grams. `null` / `undefined` → em-dash placeholder. */
  carbs: number | null | undefined;
  /** Fat grams. `null` / `undefined` → em-dash placeholder. */
  fat: number | null | undefined;
  /** Optional fibre grams. When provided + > 0, a fourth segment is
   *  appended (`· 9g Fb`). Omit / pass 0 / null to skip. */
  fiber?: number | null;
}

/** The canonical "kcal · P · C · F" trailer used across Today, Plan,
 *  Eat Again, Recipe rows, QuickAdd, SaveMeal, and the planner. Always
 *  rounds to the nearest integer — sub-gram precision is noise in
 *  scannable surfaces. */
export function formatMacroTrailer(input: MacroFormatInput): string {
  const segs: string[] = [];
  segs.push(`${formatNumber(input.calories)} kcal`);
  segs.push(`${formatGrams(input.protein)} P`);
  segs.push(`${formatGrams(input.carbs)} C`);
  segs.push(`${formatGrams(input.fat)} F`);
  if (input.fiber != null && input.fiber > 0) {
    segs.push(`${formatGrams(input.fiber)} Fb`);
  }
  return segs.join(" · ");
}

/** Internal — kcal renderer. Null/undefined → em-dash. */
function formatNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return String(Math.round(n));
}

/** Internal — gram renderer. Null/undefined → em-dash with unit. */
function formatGrams(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—g";
  return `${Math.round(n)}g`;
}
