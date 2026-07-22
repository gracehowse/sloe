import { useCallback, useEffect, useMemo, useState } from "react";
import {
  computeSmartRecipeSuggestions,
  type SmartSuggestion,
} from "../lib/planning/smartSuggestions";
import type { PlannerTargets } from "../lib/nutrition/mealPlanAlgo";
import type { DayPlan, RecipeCard, ShoppingItem } from "../types/recipe";
import { supabase } from "../lib/supabase/browserClient";

type UseShoppingSmartSuggestionsInput = {
  enabled: boolean;
  userId: string | null;
  shoppingItems: readonly ShoppingItem[];
  mealPlan: DayPlan[] | null;
  savedRecipes: readonly RecipeCard[];
  discoverRecipes: readonly RecipeCard[];
  planTargets?: PlannerTargets | null;
};

export function useShoppingSmartSuggestions({
  enabled,
  userId,
  shoppingItems,
  mealPlan,
  savedRecipes,
  discoverRecipes,
  planTargets,
}: UseShoppingSmartSuggestionsInput): {
  suggestions: SmartSuggestion[];
  loadingIngredients: boolean;
} {
  const [suggestionIngredients, setSuggestionIngredients] = useState<
    Map<string, string[]>
  >(new Map());
  const [loadingIngredients, setLoadingIngredients] = useState(false);

  const recipePool = useMemo(
    () => [...savedRecipes, ...discoverRecipes],
    [savedRecipes, discoverRecipes],
  );

  const recipeTitleToId = useCallback(
    (title: string) => recipePool.find((r) => r.title === title)?.id ?? null,
    [recipePool],
  );

  const ingredientFetchIds = useMemo(() => recipePool.map((r) => r.id), [recipePool]);
  const ingredientFetchKey = ingredientFetchIds.join(",");

  const uncheckedCount = useMemo(
    () => shoppingItems.filter((i) => !i.checked).length,
    [shoppingItems],
  );

  useEffect(() => {
    if (!enabled || !userId || ingredientFetchIds.length === 0) {
      setSuggestionIngredients(new Map());
      setLoadingIngredients(false);
      return;
    }
    let cancelled = false;
    setLoadingIngredients(true);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("recipe_ingredients")
          .select("recipe_id, name")
          .in("recipe_id", ingredientFetchIds);
        if (cancelled) return;
        if (error) {
          setSuggestionIngredients(new Map());
          return;
        }
        const map = new Map<string, string[]>();
        for (const row of data ?? []) {
          const recipeId = String((row as { recipe_id: string }).recipe_id ?? "");
          const name = String((row as { name: string }).name ?? "");
          if (!recipeId || !name) continue;
          const bucket = map.get(recipeId) ?? [];
          bucket.push(name);
          map.set(recipeId, bucket);
        }
        setSuggestionIngredients(map);
      } finally {
        if (!cancelled) setLoadingIngredients(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, userId, ingredientFetchKey, ingredientFetchIds]);

  const suggestions = useMemo(() => {
    if (!enabled || uncheckedCount === 0) return [];
    return computeSmartRecipeSuggestions({
      mealPlan,
      titleToId: recipeTitleToId,
      dbIngredientsByRecipeId: suggestionIngredients,
      extraRecipePool: recipePool,
      shoppingListItems: shoppingItems,
      planTargets,
      rankByMacroFit: true,
      max: 8,
    });
  }, [
    enabled,
    uncheckedCount,
    mealPlan,
    recipeTitleToId,
    suggestionIngredients,
    recipePool,
    shoppingItems,
    planTargets,
  ]);

  return { suggestions, loadingIngredients };
}
