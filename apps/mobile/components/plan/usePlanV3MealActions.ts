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
 * usePlanV3MealActions — the v3 Plan surface's meal handlers, lifted out of the
 * pinned planner screen (ENG-1225 Block 3). `onOpenMeal` routes a real meal to
 * its recipe detail (falling back to the swap picker when the recipe can't be
 * resolved); `onAddToSlot` opens the swap picker so the empty slot can be filled
 * from the library. Both take (dayIndex, slotIndex) where slotIndex is the
 * position in ALL_MEAL_SLOTS.
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
