/**
 * ENG-1364 (phase 1) — domain selector hooks over `AppDataContext`.
 *
 * `AppDataContext` exposes 109 fields/functions across ~9 domains (profile,
 * recipe library, shopping list, meal planning, targets, activity/hydration,
 * journal, notifications, household) and is consumed directly — with zero
 * indirection — by 23 component files. That makes every consumer coupled to
 * the entire context shape, and makes a future split of the provider itself
 * (phase 2, explicitly deferred) touch every call site at once.
 *
 * This file adds a THIN, PURE indirection layer: each hook below calls
 * `useAppData()` once and returns only the slice of fields/functions that
 * belong to its domain. No new state, no new logic, no behaviour change —
 * every returned value is the exact same reference the context already
 * produces. Consumers that only need one domain's fields can import the
 * matching selector instead of destructuring the raw context; consumers that
 * genuinely span multiple domains keep using `useAppData()` directly (see
 * the phase-1 PR description for which of the 23 were left as-is and why).
 *
 * Do NOT add derived/computed values here — that would be new logic, not
 * indirection, and belongs in a dedicated `use<Feature>()` hook instead.
 */
import { useAppData } from "../AppDataContext.tsx";

/** Notifications inbox: unread count, prefs, and the read/clear actions. */
export function useNotificationsData() {
  const {
    notificationsInbox,
    notificationsUnreadCount,
    notificationPrefs,
    setNotificationPrefs,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    addNotification,
  } = useAppData();
  return {
    notificationsInbox,
    notificationsUnreadCount,
    notificationPrefs,
    setNotificationPrefs,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    addNotification,
  };
}

/**
 * Recipe library: saved/discover recipes, per-recipe library metadata, and
 * user-created collections (ENG-1126). Collections are part of the library
 * domain, not a separate one — they're always keyed by recipe id and only
 * ever consumed alongside the rest of the library surface.
 */
export function useRecipeLibraryData() {
  const {
    discoverRecipes,
    communityFeedCount,
    refreshDiscoverRecipes,
    toggleSaveRecipe,
    ensureRecipeInLibraryWithKind,
    libraryEntryKindByRecipeId,
    savedRecipeMetaById,
    refreshMyLibraryRecipes,
    duplicateRecipeToCreatedDraft,
    isRecipeSaved,
    savedRecipesForLibrary,
    libraryDataReady,
    recipeCollections,
    collectionMembershipByRecipeId,
    createCollection,
    renameCollection,
    deleteCollection,
    addRecipeToCollection,
    removeRecipeFromCollection,
  } = useAppData();
  return {
    discoverRecipes,
    communityFeedCount,
    refreshDiscoverRecipes,
    toggleSaveRecipe,
    ensureRecipeInLibraryWithKind,
    libraryEntryKindByRecipeId,
    savedRecipeMetaById,
    refreshMyLibraryRecipes,
    duplicateRecipeToCreatedDraft,
    isRecipeSaved,
    savedRecipesForLibrary,
    libraryDataReady,
    recipeCollections,
    collectionMembershipByRecipeId,
    createCollection,
    renameCollection,
    deleteCollection,
    addRecipeToCollection,
    removeRecipeFromCollection,
  };
}

/** Shopping list: items, per-item mutations, pantry staples, and plan-sync state. */
export function useShoppingListData() {
  const {
    shoppingItems,
    setShoppingItems,
    toggleShoppingChecked,
    removeShoppingItem,
    addShoppingItem,
    shoppingListOutOfSync,
    shoppingListPlanStartDate,
    pantryStaples,
    savePantryStaples,
    generateShoppingListFromPlan,
    syncShoppingListForPlanEdit,
  } = useAppData();
  return {
    shoppingItems,
    setShoppingItems,
    toggleShoppingChecked,
    removeShoppingItem,
    addShoppingItem,
    shoppingListOutOfSync,
    shoppingListPlanStartDate,
    pantryStaples,
    savePantryStaples,
    generateShoppingListFromPlan,
    syncShoppingListForPlanEdit,
  };
}

/**
 * Nutrition journal: logged meals for the selected day, the full by-day map,
 * the CRUD/copy/duplicate actions, and the selected-date cursor those
 * actions key off. `ensureNutritionHistory` is included since it only
 * widens the journal's own history window (ENG-1324).
 */
export function useJournalData() {
  const {
    selectedDateKey,
    setSelectedDateKey,
    mealsForSelectedDate,
    nutritionByDay,
    nutritionJournalHydrated,
    ensureNutritionHistory,
    addLoggedMeal,
    addLoggedMealForDate,
    removeLoggedMeal,
    updateLoggedMeal,
    copyMealToDate,
    copyMealToDateRange,
    duplicateDay,
    duplicateDayToDateRange,
  } = useAppData();
  return {
    selectedDateKey,
    setSelectedDateKey,
    mealsForSelectedDate,
    nutritionByDay,
    nutritionJournalHydrated,
    ensureNutritionHistory,
    addLoggedMeal,
    addLoggedMealForDate,
    removeLoggedMeal,
    updateLoggedMeal,
    copyMealToDate,
    copyMealToDateRange,
    duplicateDay,
    duplicateDayToDateRange,
  };
}

/** Household: the active household id and member count (Honeydew parity, ENG-849). */
export function useHouseholdData() {
  const { activeHouseholdId, householdMemberCount } = useAppData();
  return { activeHouseholdId, householdMemberCount };
}
