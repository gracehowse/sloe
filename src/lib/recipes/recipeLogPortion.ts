/**
 * Recipe structured-log helpers — map portion-picker state to scaled
 * macros + micros multiplier (ENG-736).
 */

import {
  buildRecipeYieldPortionPicker,
  canLogRecipeByGrams,
  canLogRecipeByUnits,
  parseRecipeYieldDefinition,
  scaleRecipePortionMacros,
  type RecipeMacroPanel,
  type RecipePortionSelection,
  type RecipeYieldDefinition,
} from "../nutrition/recipeYield";
import { stateToGrams, type PortionState } from "../nutrition/portionPicker";

export function recipeYieldDefinitionFromRecipe(
  yieldRaw: unknown,
  servings: number,
): RecipeYieldDefinition {
  return parseRecipeYieldDefinition(yieldRaw, servings);
}

/** True when structured yield unlocks gram or unit logging (flag-gated UI). */
export function recipeSupportsStructuredPortionLog(yieldDef: RecipeYieldDefinition): boolean {
  return canLogRecipeByGrams(yieldDef) || canLogRecipeByUnits(yieldDef);
}

export function recipePortionSelectionFromPickerState(
  state: PortionState,
): RecipePortionSelection {
  switch (state.unit.kind) {
    case "gram":
    case "ounce":
      return { mode: "grams", grams: stateToGrams(state) };
    case "serving":
      return { mode: "servings", servings: state.amount };
    case "count":
      return { mode: "units", units: state.amount };
    default: {
      const _exhaustive: never = state.unit;
      return _exhaustive;
    }
  }
}

export function scaleRecipeLogMacros(
  perServing: RecipeMacroPanel,
  baseServings: number,
  yieldDef: RecipeYieldDefinition,
  portion: RecipePortionSelection,
): RecipeMacroPanel | null {
  return scaleRecipePortionMacros(perServing, baseServings, yieldDef, portion);
}

/** Per-serving multiplier for `fetchPlannedMealMicros` / inline micro scaling. */
export function recipeLogMicrosMultiplier(
  perServing: RecipeMacroPanel,
  baseServings: number,
  yieldDef: RecipeYieldDefinition,
  portion: RecipePortionSelection,
): number {
  const scaled = scaleRecipePortionMacros(perServing, baseServings, yieldDef, portion);
  if (!scaled) return 1;
  const baseCal = perServing.calories;
  if (!Number.isFinite(baseCal) || baseCal <= 0) return 1;
  return scaled.calories / baseCal;
}

export function buildRecipeStructuredLogPicker(
  perServing: RecipeMacroPanel,
  baseServings: number,
  yieldDef: RecipeYieldDefinition,
) {
  return buildRecipeYieldPortionPicker(perServing, baseServings, yieldDef);
}

export function formatRecipePortionLogLabel(
  portion: RecipePortionSelection,
  yieldDef: RecipeYieldDefinition,
): string {
  switch (portion.mode) {
    case "grams":
      return `${Math.round(portion.grams * 10) / 10} g`;
    case "servings":
      return portion.servings === 1 ? "1 serving" : `${portion.servings} servings`;
    case "units": {
      const label =
        portion.units === 1
          ? yieldDef.kind === "units" || yieldDef.kind === "weight_and_units"
            ? yieldDef.singular
            : "unit"
          : yieldDef.kind === "units" || yieldDef.kind === "weight_and_units"
            ? yieldDef.plural
            : "units";
      return `${portion.units} ${label}`;
    }
    default: {
      const _exhaustive: never = portion;
      return _exhaustive;
    }
  }
}
