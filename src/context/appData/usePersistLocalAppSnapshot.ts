import { useEffect } from "react";
import { STORAGE_KEY, type PersistedSnapshot } from "./persistence.ts";

/** Writes the in-browser snapshot whenever core local state changes. */
export function usePersistLocalAppSnapshot(snapshot: PersistedSnapshot): void {
  const {
    savedRecipeIds,
    savedAtById,
    shoppingItems,
    nutritionByDay,
    mealPlan,
    nutritionTargets,
    extraWaterByDay,
    activityBurnKcal,
  } = snapshot;

  useEffect(() => {
    const payload: PersistedSnapshot = {
      savedRecipeIds,
      savedAtById,
      shoppingItems,
      nutritionByDay,
      mealPlan,
      nutritionTargets,
      extraWaterByDay,
      activityBurnKcal,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    savedRecipeIds,
    savedAtById,
    shoppingItems,
    nutritionByDay,
    mealPlan,
    nutritionTargets,
    extraWaterByDay,
    activityBurnKcal,
  ]);
}
