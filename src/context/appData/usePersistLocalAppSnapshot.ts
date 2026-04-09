import { useEffect } from "react";
import { STORAGE_KEY, type PersistedSnapshot } from "./persistence.ts";

/** Writes the in-browser snapshot whenever core local state changes. */
export function usePersistLocalAppSnapshot(snapshot: PersistedSnapshot): void {
  const {
    savedRecipeIds,
    savedAtById,
    savedRecipeMetaById,
    libraryEntryKindByRecipeId,
    shoppingItems,
    shoppingListSourceFingerprint,
    nutritionByDay,
    mealPlan,
    mealPlanSlots,
    activeMealPlanSlotId,
    nutritionTargets,
    extraWaterByDay,
    activityBurnKcal,
    activityBurnByDay,
    notificationsInbox,
    notificationPrefs,
  } = snapshot;

  useEffect(() => {
    const payload: PersistedSnapshot = {
      savedRecipeIds,
      savedAtById,
      savedRecipeMetaById,
      libraryEntryKindByRecipeId,
      shoppingItems,
      shoppingListSourceFingerprint,
      nutritionByDay,
      mealPlan,
      mealPlanSlots,
      activeMealPlanSlotId,
      nutritionTargets,
      extraWaterByDay,
      activityBurnKcal,
      activityBurnByDay,
      notificationsInbox,
      notificationPrefs,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    savedRecipeIds,
    savedAtById,
    savedRecipeMetaById,
    libraryEntryKindByRecipeId,
    shoppingItems,
    shoppingListSourceFingerprint,
    nutritionByDay,
    mealPlan,
    mealPlanSlots,
    activeMealPlanSlotId,
    nutritionTargets,
    extraWaterByDay,
    activityBurnKcal,
    activityBurnByDay,
    notificationsInbox,
    notificationPrefs,
  ]);
}
