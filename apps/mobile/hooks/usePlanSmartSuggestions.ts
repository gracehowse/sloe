import { useCallback, useEffect, useMemo, useState } from "react";
import {
  computeSmartRecipeSuggestions,
  type SmartSuggestion,
} from "@suppr/shared/planning/smartSuggestions";
import type { RecipeCard } from "@/lib/types";
import { supabase } from "@/lib/supabase";

export type PlanSmartSuggestionsDayPlan = ReadonlyArray<{
  day: number;
  meals: ReadonlyArray<{
    recipeTitle: string;
    isPlaceholder?: boolean;
  }>;
}>;

type UsePlanSmartSuggestionsInput = {
  enabled: boolean;
  userId: string | null;
  mealPlan: PlanSmartSuggestionsDayPlan | null;
  planHasRealMeals: boolean;
  savedRecipes: readonly RecipeCard[];
  discoverRecipes: readonly RecipeCard[];
};

export function usePlanSmartSuggestions({
  enabled,
  userId,
  mealPlan,
  planHasRealMeals,
  savedRecipes,
  discoverRecipes,
}: UsePlanSmartSuggestionsInput): {
  suggestions: SmartSuggestion[];
  loadingIngredients: boolean;
  recipeTitleToId: (title: string) => string | null;
} {
  const [suggestionIngredients, setSuggestionIngredients] = useState<
    Map<string, string[]>
  >(new Map());
  const [loadingIngredients, setLoadingIngredients] = useState(false);

  const recipeTitleToId = useCallback(
    (title: string) => {
      const pool = [...savedRecipes, ...discoverRecipes];
      return pool.find((r) => r.title === title)?.id ?? null;
    },
    [savedRecipes, discoverRecipes],
  );

  const suggestionPoolIds = useMemo(
    () => savedRecipes.map((r) => r.id),
    [savedRecipes],
  );
  const suggestionPoolKey = suggestionPoolIds.join(",");

  useEffect(() => {
    if (!enabled || !userId || suggestionPoolIds.length === 0) {
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
          .in("recipe_id", suggestionPoolIds);
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
  }, [enabled, userId, suggestionPoolKey, suggestionPoolIds]);

  const suggestions = useMemo(() => {
    if (!enabled || !planHasRealMeals) return [];
    return computeSmartRecipeSuggestions({
      mealPlan: mealPlan as Parameters<
        typeof computeSmartRecipeSuggestions
      >[0]["mealPlan"],
      titleToId: recipeTitleToId,
      dbIngredientsByRecipeId: suggestionIngredients,
      extraRecipePool: savedRecipes as Parameters<
        typeof computeSmartRecipeSuggestions
      >[0]["extraRecipePool"],
      max: 4,
    });
  }, [
    enabled,
    planHasRealMeals,
    mealPlan,
    recipeTitleToId,
    suggestionIngredients,
    savedRecipes,
  ]);

  return { suggestions, loadingIngredients, recipeTitleToId };
}
