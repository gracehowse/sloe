/**
 * Remaining macros helper — single source of truth for
 * "how much calories / protein / carbs / fat / fiber are left in
 * the user's daily budget", shared across web and mobile.
 *
 * Pure: no React, no Date, no network, no Supabase. Importing this
 * file from a React Native component is safe.
 *
 * Two operating modes:
 *  • `computeRemaining(targets, consumed)` — today's running tally
 *  • `projectRemaining(targets, consumed, candidate)` — "if I log this,
 *    what's left?" preview for the food-search fit-this-in hint.
 *
 * Rounding: integers for display (we do not want "499.3g carbs left").
 * Over-budget: the displayed value is floored at 0, but the
 * `over*` booleans remain true so the UI can switch to "over" styling
 * and show a signed "+N over" number derived from the same helper.
 */

export type MacroTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Optional daily fiber target in grams. Omit or pass 0 to hide fiber. */
  fiber?: number;
};

export type MacroConsumed = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Optional consumed fiber in grams. */
  fiber?: number;
};

export type RemainingMacros = {
  /** kcal remaining, floored at 0. */
  calories: number;
  /** grams protein remaining, floored at 0. */
  protein: number;
  /** grams carbs remaining, floored at 0. */
  carbs: number;
  /** grams fat remaining, floored at 0. */
  fat: number;
  /**
   * Grams fiber remaining, floored at 0. `undefined` when the user has
   * no fiber target (e.g. target 0 / unset). Consumers can branch on
   * this to hide the fiber column entirely.
   */
  fiber?: number;
  overCalories: boolean;
  overProtein: boolean;
  overCarbs: boolean;
  overFat: boolean;
  /** True only when a fiber target exists and it has been exceeded. */
  overFiber: boolean;
  /**
   * Signed deltas (target - consumed) — can be negative. Useful when
   * the UI wants to show "+120 over" without reconstructing the math.
   * Always integers.
   */
  deltas: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    /** Undefined when there is no fiber target. */
    fiber?: number;
  };
};

/** Clamp negative/NaN values to a safe non-negative integer input. */
function safe(value: number | undefined | null): number {
  if (value == null || Number.isNaN(value)) return 0;
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value;
}

/** Round to nearest integer; treats undefined as 0. */
function roundInt(value: number): number {
  return Math.round(value);
}

function hasFiberTarget(targets: MacroTargets): boolean {
  return typeof targets.fiber === "number" && targets.fiber > 0;
}

/**
 * Core computation shared by `computeRemaining` and `projectRemaining`.
 * Inputs are clamped to ≥0 before the subtraction so a buggy caller
 * cannot produce `target - (-50) = target+50` left.
 */
function buildRemaining(
  targets: MacroTargets,
  consumed: MacroConsumed,
): RemainingMacros {
  const tCal = safe(targets.calories);
  const tPro = safe(targets.protein);
  const tCarb = safe(targets.carbs);
  const tFat = safe(targets.fat);

  const cCal = safe(consumed.calories);
  const cPro = safe(consumed.protein);
  const cCarb = safe(consumed.carbs);
  const cFat = safe(consumed.fat);

  const deltaCal = roundInt(tCal - cCal);
  const deltaPro = roundInt(tPro - cPro);
  const deltaCarb = roundInt(tCarb - cCarb);
  const deltaFat = roundInt(tFat - cFat);

  const showFiber = hasFiberTarget(targets);
  let deltaFiber: number | undefined;
  let fiberRemaining: number | undefined;
  let overFiber = false;
  if (showFiber) {
    const tFib = safe(targets.fiber);
    const cFib = safe(consumed.fiber);
    deltaFiber = roundInt(tFib - cFib);
    fiberRemaining = Math.max(0, deltaFiber);
    overFiber = cFib > tFib;
  }

  return {
    calories: Math.max(0, deltaCal),
    protein: Math.max(0, deltaPro),
    carbs: Math.max(0, deltaCarb),
    fat: Math.max(0, deltaFat),
    fiber: fiberRemaining,
    overCalories: cCal > tCal,
    overProtein: cPro > tPro,
    overCarbs: cCarb > tCarb,
    overFat: cFat > tFat,
    overFiber,
    deltas: {
      calories: deltaCal,
      protein: deltaPro,
      carbs: deltaCarb,
      fat: deltaFat,
      fiber: deltaFiber,
    },
  };
}

/**
 * Compute what's left of each macro for the day.
 *
 * @param targets user's daily macro targets (calories, P/C/F, optional fiber)
 * @param consumed totals logged so far today
 */
export function computeRemaining(
  targets: MacroTargets,
  consumed: MacroConsumed,
): RemainingMacros {
  return buildRemaining(targets, consumed);
}

/**
 * "If I log this, how much is left?" — used by the food-search
 * fit-this-in preview. Does not mutate `consumed`.
 *
 * @param targets daily targets
 * @param consumed what's already logged today
 * @param candidate the macros of the portion the user is considering
 */
export function projectRemaining(
  targets: MacroTargets,
  consumed: MacroConsumed,
  candidate: MacroConsumed,
): RemainingMacros {
  const projected: MacroConsumed = {
    calories: safe(consumed.calories) + safe(candidate.calories),
    protein: safe(consumed.protein) + safe(candidate.protein),
    carbs: safe(consumed.carbs) + safe(candidate.carbs),
    fat: safe(consumed.fat) + safe(candidate.fat),
  };
  // Only include fiber in the projected total when the target is set —
  // mirrors the behaviour of `buildRemaining` so the returned shape is
  // identical whether or not fiber is tracked.
  if (hasFiberTarget(targets)) {
    projected.fiber = safe(consumed.fiber) + safe(candidate.fiber);
  }
  return buildRemaining(targets, projected);
}
