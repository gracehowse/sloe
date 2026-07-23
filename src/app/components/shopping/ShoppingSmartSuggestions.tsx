import { useAppData } from "../../../context/AppDataContext.tsx";
import { ShoppingSmartSuggestionsView } from "./ShoppingSmartSuggestionsView.tsx";
import { useShoppingSmartSuggestions } from "./useShoppingSmartSuggestions.ts";

/**
 * ENG-1634 — "Smart suggestions" section on the web Shopping list.
 * Flag-gated (`smart_suggestions_v1`, default ON). Mirrors mobile
 * `apps/mobile/components/shopping/ShoppingSmartSuggestions.tsx`.
 */
export function ShoppingSmartSuggestions() {
  const {
    userId,
    shoppingItems,
    savedRecipesForLibrary,
    nutritionTargets,
    nutritionByDay,
    mealPlan,
    syncShoppingListForPlanEdit,
  } = useAppData();

  const { enabled, suggestions, addingRecipeId, addedRecipeIds, addToPlan } =
    useShoppingSmartSuggestions({
      userId,
      shoppingItems,
      savedRecipesForLibrary,
      nutritionTargets,
      nutritionByDay,
      mealPlan,
      syncShoppingListForPlanEdit,
    });

  if (!enabled || suggestions.length === 0) return null;

  return (
    <ShoppingSmartSuggestionsView
      suggestions={suggestions}
      addingRecipeId={addingRecipeId}
      addedRecipeIds={addedRecipeIds}
      onAddToPlan={(s) => void addToPlan(s)}
    />
  );
}
