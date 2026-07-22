import type { DayPlan, RecipeCard } from "../../types/recipe";
import { baseMacrosFromRecipe } from "../nutrition/coerceRecipeMacrosForPlanning";
import { refitDayMealsToTargets, scaleMacros, type PlannerTargets } from "../nutrition/mealPlanAlgo";

/**
 * Place a recipe into an empty plan slot and re-fit the day's portions.
 * Shared by web + mobile smart-suggestion "Add to plan" CTAs.
 */
export function addRecipeToPlanSlot(input: {
  plan: DayPlan[];
  dayIndex: number;
  mealIndex: number;
  recipe: RecipeCard;
  targets: PlannerTargets;
  recipePool: readonly RecipeCard[];
  fiberForMeal?: (meal: DayPlan["meals"][number]) => number;
}): DayPlan[] {
  const { plan, dayIndex, mealIndex, recipe, targets, recipePool, fiberForMeal } = input;
  const baseFromPool = (r: RecipeCard) => baseMacrosFromRecipe(r);

  return plan.map((dp, di) => {
    if (di !== dayIndex) return dp;
    const baseRecipes = dp.meals.map((m, mi) => {
      if (mi === mealIndex) return baseFromPool(recipe);
      const ref = recipePool.find((r) => r.id === m.recipeId);
      if (ref) return baseFromPool(ref);
      return {
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        fiberG: fiberForMeal?.(m) ?? (m as { fiberG?: number }).fiberG ?? 0,
      };
    });
    const fit = refitDayMealsToTargets({ recipes: baseRecipes, targets });
    const newMeals = dp.meals.map((m, mi) => {
      const scaled = scaleMacros(baseRecipes[mi]!, fit.multipliers[mi] ?? 1);
      return {
        ...m,
        ...(mi === mealIndex
          ? {
              recipeTitle: recipe.title,
              recipeId: recipe.id,
              isPlaceholder: false,
              leftoverOf: undefined,
              isLeftover: undefined,
            }
          : {}),
        calories: scaled.calories,
        protein: scaled.protein,
        carbs: scaled.carbs,
        fat: scaled.fat,
        fiberG: scaled.fiberG,
        portionMultiplier: undefined,
      };
    });
    const totals = newMeals.reduce(
      (a, m) => ({
        calories: a.calories + m.calories,
        protein: a.protein + m.protein,
        carbs: a.carbs + m.carbs,
        fat: a.fat + m.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
    return {
      ...dp,
      meals: newMeals,
      totals,
      ...(fit.residualProteinGap < 0 ? { residualProteinGap: fit.residualProteinGap } : {}),
    };
  });
}
