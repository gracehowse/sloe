/**
 * Total food mass in grams for scaling per-100g nutrition on the recipe verify screen.
 *
 * Density-aware as of P0-2 (2026-04-25). Resolution priority:
 *   1. `chosenPortion.gramWeight` when present and not the trivial `ml→1g`
 *      placeholder used by STANDARD_UNITS in the verify screen.
 *   2. `options.gPerMl` when supplied by the caller (overrides name lookup).
 *   3. `densityForName(ing.name)` via the STAPLES table (olive oil ≈ 0.92,
 *      honey ≈ 1.42, water 1.00, etc.).
 *   4. Refused: returns 0 when unit is `ml` and none of the above resolve.
 *      Caller must surface a "needs density" affordance.
 *
 * Plain `g` units pass through as grams unchanged. Unknown / non-g/ml units
 * with no `chosenPortion` fall back to the per-100g convention (×100).
 *
 * Policy reference: `docs/product/nutrition-approximation-policy.md` §A2.
 */

import { densityForName } from "./estimateIngredientMacros";

export type VerifyScaleIngredient = {
  /** Ingredient name. Used to resolve density via STAPLES when unit is ml
   *  and chosenPortion does not carry a non-trivial gramWeight. Optional so
   *  bare unit-test fixtures still type-check. */
  name?: string;
  unit: string | null;
  chosenPortion: { label: string; gramWeight: number } | null;
};

export type VerifyScaleOptions = {
  /** Explicit g-per-ml density override. Wins over name-resolved density. */
  gPerMl?: number;
};

/**
 * Detailed form — returns grams plus a flag indicating whether the result
 * leaned on a defaulted / refused density resolution. Use this when the
 * caller wants to render an "estimated" / "needs density" hint.
 */
export type VerifyScaleResult = {
  grams: number;
  /** True when unit was `ml` and no density could be resolved (gramWeight=0). */
  densityRefused?: boolean;
};

export function totalGramsForVerifyScaleDetailed(
  ing: VerifyScaleIngredient,
  amountNum: number,
  options?: VerifyScaleOptions,
): VerifyScaleResult {
  if (!Number.isFinite(amountNum) || amountNum <= 0) return { grams: 0 };

  const unitLower = (ing.unit ?? "").trim().toLowerCase();
  const portionLabel = (ing.chosenPortion?.label ?? "").trim().toLowerCase();
  const portionGw = ing.chosenPortion?.gramWeight;

  // 1. chosenPortion with a non-trivial gramWeight always wins. The "trivial"
  //    placeholder is the {label:"ml", gramWeight:1} shape used by
  //    STANDARD_UNITS in apps/mobile/app/recipe/verify.tsx — that legacy
  //    convention is the same ml=g bug just embedded in the portion config,
  //    so we route it through density resolution instead.
  if (portionGw != null && Number.isFinite(portionGw) && portionGw > 0) {
    const isTrivialMl = portionLabel === "ml" && portionGw === 1;
    if (!isTrivialMl) return { grams: portionGw * amountNum };
  }

  // 2. Plain g — pass through.
  if (unitLower === "g" || portionLabel === "g") return { grams: amountNum };

  // 3. ml — needs density.
  const isMl = unitLower === "ml" || portionLabel === "ml";
  if (isMl) {
    const density =
      options?.gPerMl ??
      (ing.name ? densityForName(ing.name) : undefined);
    if (density != null && Number.isFinite(density) && density > 0) {
      return { grams: amountNum * density };
    }
    // 4. Refuse rather than report ml as g.
    return { grams: 0, densityRefused: true };
  }

  // 5. No portion, non-g/ml unit → per-100g convention.
  return { grams: 100 * amountNum };
}

/**
 * Grams-only form, preserved for backward compatibility with existing
 * call sites. Prefer {@link totalGramsForVerifyScaleDetailed} when the
 * caller needs to render a "needs density" hint.
 */
export function totalGramsForVerifyScale(
  ing: VerifyScaleIngredient,
  amountNum: number,
  options?: VerifyScaleOptions,
): number {
  return totalGramsForVerifyScaleDetailed(ing, amountNum, options).grams;
}
