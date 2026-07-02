import { useCallback } from "react";
import { type Href, useRouter } from "expo-router";

import { ALL_MEAL_SLOTS } from "@/lib/mealPlanAlgo";
import type { DayPlan } from "@/lib/types";

/** Map an ALL_MEAL_SLOTS index back to its slot name (Snacks is the fallback). */
function slotNameForIndex(slotIndex: number): string {
  return ALL_MEAL_SLOTS[slotIndex] ?? "Snacks";
}

interface PlanV3PoolRecipe {
  id: string;
  title: string;
}

export interface UsePlanV3MealActionsArgs {
  plan: DayPlan[] | null;
  savedRecipes: PlanV3PoolRecipe[];
  discoverRecipes: PlanV3PoolRecipe[];
  /** Open the swap picker for (dayIndex, slotIndex). */
  swapMeal: (dayIndex: number, mealIndex: number, slotName: string) => void;
  /** ENG-1238 — open the legacy row action sheet for a populated meal. */
  openMealMenu?: (dayIndex: number, slotIndex: number) => void;
}

/**
 * usePlanV3MealActions — v3 Plan meal open/add/options handlers.
 *
 * ENG-1238 parity note: web hosts the action sheet in
 * `usePlanV3MealActions.tsx` + `PlanMealActionDialog`; mobile keeps the
 * sheet UI in `planner.tsx` (`rowMenu` bottom sheet) and threads
 * `openMealMenu` here so card ⋯ taps share one entry point.
 */
export function usePlanV3MealActions({
  plan,
  savedRecipes,
  discoverRecipes,
  swapMeal,
  openMealMenu,
}: UsePlanV3MealActionsArgs) {
  const router = useRouter();

  const onAddToSlot = useCallback(
    (dayIndex: number, slotIndex: number) =>
      swapMeal(dayIndex, slotIndex, slotNameForIndex(slotIndex)),
    [swapMeal],
  );

  const onOpenMeal = useCallback(
    (dayIndex: number, slotIndex: number) => {
      const meal = plan?.[dayIndex]?.meals[slotIndex];
      if (!meal || meal.isPlaceholder) {
        swapMeal(dayIndex, slotIndex, slotNameForIndex(slotIndex));
        return;
      }
      const id =
        meal.recipeId ??
        savedRecipes.find((x) => x.title === meal.recipeTitle)?.id ??
        discoverRecipes.find((x) => x.title === meal.recipeTitle)?.id;
      if (id) router.push(`/recipe/${id}` as Href);
      else swapMeal(dayIndex, slotIndex, slotNameForIndex(slotIndex));
    },
    [plan, savedRecipes, discoverRecipes, router, swapMeal],
  );

  const onOpenMealOptions = useCallback(
    (dayIndex: number, slotIndex: number) => {
      const meal = plan?.[dayIndex]?.meals[slotIndex];
      if (!meal || meal.isPlaceholder) {
        swapMeal(dayIndex, slotIndex, slotNameForIndex(slotIndex));
        return;
      }
      openMealMenu?.(dayIndex, slotIndex);
    },
    [plan, openMealMenu, swapMeal],
  );

  return { onOpenMeal, onAddToSlot, onOpenMealOptions };
}

export default usePlanV3MealActions;
