/**
 * Per-ingredient override helpers (Batch 2.7).
 *
 * An imported recipe sometimes has one ingredient row whose USDA / OFF match
 * is simply wrong — or the user knows the real numbers from a packet label
 * and wants those to replace the matched figures. The `overrideMacros` field
 * on an ingredient row lets the user pin the authoritative macros for that
 * row without throwing away the match metadata (name, source, amount, unit).
 *
 * User-added rows (via "+ Add ingredient" on an imported recipe) set
 * `addedByUser: true`. We keep that flag separate from `overrideMacros` so
 * user-added rows that DO have a verified match don't look like overrides.
 *
 * These helpers are pure + platform-agnostic so web (`RecipeDetail`) and
 * mobile (`app/recipe/verify.tsx`) share the same totaliser.
 */

export type IngredientOverride = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
};

/** Minimum shape a recipe ingredient must have for these helpers. */
export type RecipeIngredientLike = {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  /** Web shape uses `fiberG`, mobile `verifyRecipe` uses `fiberG` — both map here. */
  fiberG?: number | null;
  overrideMacros?: IngredientOverride | null;
  addedByUser?: boolean | null;
};

export type EffectiveMacros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
};

function num(x: unknown): number {
  const n = Number(x);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** True when the value looks like a usable override object. */
export function hasOverride(ing: RecipeIngredientLike | null | undefined): boolean {
  if (!ing || !ing.overrideMacros) return false;
  const o = ing.overrideMacros;
  if (!o || typeof o !== "object") return false;
  // Require finite numbers for all 4 macros (fiber is optional).
  return (
    Number.isFinite(o.calories) &&
    Number.isFinite(o.protein) &&
    Number.isFinite(o.carbs) &&
    Number.isFinite(o.fat)
  );
}

/**
 * Return the macros we should actually count for this row.
 * When `overrideMacros` is present we use it as-is; otherwise we use the
 * matched / persisted macros on the row.
 */
export function effectiveMacros(
  ing: RecipeIngredientLike | null | undefined,
): EffectiveMacros {
  if (!ing) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  if (hasOverride(ing)) {
    const o = ing.overrideMacros!;
    const out: EffectiveMacros = {
      calories: num(o.calories),
      protein: num(o.protein),
      carbs: num(o.carbs),
      fat: num(o.fat),
    };
    if (Number.isFinite(o.fiber) && o.fiber != null) {
      out.fiber = num(o.fiber);
    }
    return out;
  }
  const out: EffectiveMacros = {
    calories: num(ing.calories),
    protein: num(ing.protein),
    carbs: num(ing.carbs),
    fat: num(ing.fat),
  };
  // Only surface fiber on the row when it's a positive finite number. A
  // zero fiberG shouldn't cause `recomputeRecipeTotals` to light up the
  // "fiber was tracked" path — most ingredients leave the snapshot at 0.
  if (ing.fiberG != null && Number.isFinite(ing.fiberG) && ing.fiberG > 0) {
    out.fiber = num(ing.fiberG);
  }
  return out;
}

/**
 * Sum effective macros across ingredients and divide by servings to get
 * per-serving totals. Servings <= 0 is clamped to 1 (defensive — the UI
 * should never show 0 servings but we never want to divide by zero).
 *
 * Fiber is only populated in the result when at least one ingredient row
 * contributed fiber. An all-zero fiber result with `fiber === 0` would
 * falsely look "tracked" on the UI.
 */
export function recomputeRecipeTotals(
  ingredients: ReadonlyArray<RecipeIngredientLike>,
  servings: number,
): { calories: number; protein: number; carbs: number; fat: number; fiber?: number } {
  // Clamp zero / negative / non-finite servings to 1 — never divide by
  // zero, and never allow a negative servings value to flip macros
  // negative. Positive fractional servings (e.g. 0.5 for a half-batch)
  // pass through so the sum simply scales up.
  const safeServings =
    Number.isFinite(servings) && (servings as number) > 0 ? (servings as number) : 1;

  let cal = 0;
  let p = 0;
  let c = 0;
  let f = 0;
  let fib = 0;
  let anyFiber = false;

  for (const ing of ingredients) {
    const m = effectiveMacros(ing);
    cal += m.calories;
    p += m.protein;
    c += m.carbs;
    f += m.fat;
    if (m.fiber != null) {
      anyFiber = true;
      fib += m.fiber;
    }
  }

  const out: { calories: number; protein: number; carbs: number; fat: number; fiber?: number } = {
    calories: Math.max(0, Math.round(cal / safeServings)),
    protein: Math.max(0, Math.round((p / safeServings) * 10) / 10),
    carbs: Math.max(0, Math.round((c / safeServings) * 10) / 10),
    fat: Math.max(0, Math.round((f / safeServings) * 10) / 10),
  };
  if (anyFiber) {
    out.fiber = Math.max(0, Math.round((fib / safeServings) * 10) / 10);
  }
  return out;
}

/**
 * Sanitise a free-form override input (typed straight into number fields)
 * into a shape safe to persist. Returns `null` when the user cleared all
 * values — callers interpret that as "reset / remove override".
 */
export function sanitizeOverrideInput(input: {
  calories?: number | string | null;
  protein?: number | string | null;
  carbs?: number | string | null;
  fat?: number | string | null;
  fiber?: number | string | null;
}): IngredientOverride | null {
  const cal = num(input.calories);
  const p = num(input.protein);
  const c = num(input.carbs);
  const f = num(input.fat);
  const fib = input.fiber != null && input.fiber !== "" ? num(input.fiber) : undefined;

  // If everything is zero AND nothing was typed for fiber, treat as "reset".
  if (cal === 0 && p === 0 && c === 0 && f === 0 && (fib == null || fib === 0)) {
    // Keep zeroed overrides only when the user explicitly passed non-empty
    // strings — otherwise an empty dialog shouldn't create a ghost override.
    const explicitlyZero = [input.calories, input.protein, input.carbs, input.fat].some(
      (v) => v === 0 || v === "0",
    );
    if (!explicitlyZero) return null;
  }

  const out: IngredientOverride = { calories: cal, protein: p, carbs: c, fat: f };
  if (fib != null) out.fiber = fib;
  return out;
}
