/**
 * F-82 (2026-04-25) — gate the macro split chart on data confidence.
 *
 * TestFlight session 2026-04-25 (ui-critic + Grace observation): a Fly By
 * Jing chili crisp logged from Open Food Facts shows 0/0/3g and renders
 * "100% of macro calories" against fat. Technically "true" given the
 * inputs, but reads as "this product is pure fat" when the truth is "OFF
 * only published a fat figure for this product". Premium nutrition apps
 * refuse to draw a chart they can't stand behind.
 *
 * Rule:
 *  - `complete` — at least two of {protein, carbs, fat} are non-zero.
 *    Render the macro bar + per-macro % normally.
 *  - `single_macro` — exactly one of {protein, carbs, fat} is non-zero
 *    AND we have a kcal claim. Macro split is misleading; show an
 *    "incomplete data" state instead.
 *  - `empty` — every macro is zero. Render the neutral skeleton bar.
 *
 * The single-macro case must NOT include legitimate single-macro foods
 * whose kcal matches Atwater for that single macro (e.g. a drop of olive
 * oil at 9g fat = 81 kcal). Those are real, complete data. The check is
 * therefore: single non-zero macro + kcal > 50 + |kcal - Atwater(macro)|
 * exceeds tolerance → incomplete.
 */

export type MacroSplitConfidence =
  | { state: "complete" }
  | { state: "single_macro"; presentMacro: "protein" | "carbs" | "fat" }
  | { state: "empty" };

export type MacroSplitInput = {
  /** Total kcal claimed for the entry. */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const SINGLE_MACRO_KCAL_FLOOR = 50;
const ATWATER_TOL_ABS = 25;
const ATWATER_TOL_PCT = 0.20;

/**
 * Decide which state the macro split should render in.
 *
 * Returns:
 *  - `state: "empty"` — caller renders skeleton bar / "no data" copy.
 *  - `state: "single_macro"` — caller renders the kcal headline only and
 *    a one-line "Only fat reported (3g) — protein and carbs not published"
 *    explainer in place of the % chart.
 *  - `state: "complete"` — caller renders the existing bar + per-macro %.
 *
 * `presentMacro` lets the caller name the dominant macro in the explainer
 * copy without re-deriving it.
 */
export function macroSplitConfidence(m: MacroSplitInput): MacroSplitConfidence {
  const kcal = Math.max(0, Number(m.calories) || 0);
  const p = Math.max(0, Number(m.protein) || 0);
  const c = Math.max(0, Number(m.carbs) || 0);
  const f = Math.max(0, Number(m.fat) || 0);

  const nonZero = (p > 0 ? 1 : 0) + (c > 0 ? 1 : 0) + (f > 0 ? 1 : 0);
  if (nonZero === 0 && kcal <= 0) return { state: "empty" };
  if (nonZero === 0) return { state: "empty" };
  if (nonZero >= 2) return { state: "complete" };

  // Exactly one macro is non-zero. Decide if it's a legitimate
  // single-macro food (kcal matches Atwater for that macro) or an
  // incomplete row from the source.
  const presentMacro: "protein" | "carbs" | "fat" =
    p > 0 ? "protein" : c > 0 ? "carbs" : "fat";

  if (kcal < SINGLE_MACRO_KCAL_FLOOR) {
    // Tiny entries (~3g chili crisp = 27 kcal Atwater fat) — single-macro
    // is fine, no need to gate the chart. Treat as complete.
    return { state: "complete" };
  }

  const atwater = 4 * p + 4 * c + 9 * f;
  const tol = Math.max(ATWATER_TOL_ABS, kcal * ATWATER_TOL_PCT);
  if (Math.abs(kcal - atwater) <= tol) {
    // Real single-macro food (e.g. olive oil, sugar). Render normally.
    return { state: "complete" };
  }

  return { state: "single_macro", presentMacro };
}

const PRESENT_LABEL: Record<"protein" | "carbs" | "fat", string> = {
  protein: "protein",
  carbs: "carbs",
  fat: "fat",
};

const MISSING_LABEL: Record<"protein" | "carbs" | "fat", string> = {
  protein: "carbs and fat",
  carbs: "protein and fat",
  fat: "protein and carbs",
};

/**
 * Helper for caller copy. Returns a single-line explainer like
 * "Only fat reported — protein and carbs not published by source." so
 * the call site doesn't have to assemble the string itself.
 */
export function macroSplitIncompleteCopy(presentMacro: "protein" | "carbs" | "fat"): string {
  return `Only ${PRESENT_LABEL[presentMacro]} reported — ${MISSING_LABEL[presentMacro]} not published by source.`;
}
