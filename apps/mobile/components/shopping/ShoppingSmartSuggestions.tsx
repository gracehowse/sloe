import type { ShoppingScope } from "@suppr/shared/household/shoppingScope";
import { useShoppingSmartSuggestions } from "@/hooks/useShoppingSmartSuggestions";
import { ShoppingSmartSuggestionsView } from "./ShoppingSmartSuggestionsView";

/**
 * ENG-1634 — "Smart suggestions" section on the mobile Shopping screen.
 * Flag-gated (`smart_suggestions_v1`, default OFF). Mirrors web
 * `src/app/components/shopping/ShoppingSmartSuggestions.tsx`.
 */
export interface ShoppingSmartSuggestionsProps {
  userId: string | null;
  scope: ShoppingScope | null;
  shoppingItemNames: readonly string[];
}

export function ShoppingSmartSuggestions({
  userId,
  scope,
  shoppingItemNames,
}: ShoppingSmartSuggestionsProps) {
  const { enabled, suggestions, addingRecipeId, addedRecipeIds, addToPlan } =
    useShoppingSmartSuggestions({ userId, scope, shoppingItemNames });

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

export default ShoppingSmartSuggestions;
