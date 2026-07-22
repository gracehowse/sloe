// Extensionless relative imports — mobile-safe (Metro + the mobile tsconfig).
//
// ENG-1634 — web host glue for the shopping-list "Smart suggestions" section.
// Fetches the (small, already-loaded-elsewhere-in-spirit) candidate pool's
// ingredient rows, resolves today's remaining macro budget from data
// `useAppData()` already holds (no new fetch — `nutritionTargets` +
// `nutritionByDay` are populated for Today/Progress and are free to reuse
// here), and drives the pure `rankIngredientOverlapSuggestions`. "Add to
// plan" reuses the ENG-957 `syncShoppingListForPlanEdit` — the SAME
// mechanism the plan-swap flow already calls (`MealPlanner.tsx`) — rather
// than a bespoke shopping-list append.
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase/browserClient.ts";
import { track, isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { AnalyticsEvents } from "../../../lib/analytics/events.ts";
import { computeRemaining } from "../../../lib/nutrition/remainingMacros.ts";
import { todayKey } from "../../../lib/nutrition/trackerDate.ts";
import {
  rankIngredientOverlapSuggestions,
  type OverlapCandidateRecipe,
  type ShoppingSmartSuggestion,
} from "../../../lib/planning/shoppingSmartSuggestions.ts";
import type { PlanShoppingEditRef } from "../../../lib/planning/planShoppingSyncHost.ts";
import type { DayPlan, LoggedMeal, RecipeCard, ShoppingItem } from "../../../types/recipe.ts";
import type { MacroTargets } from "../../../types/profile.ts";

type IngredientsByRecipeId = Map<string, Array<{ name: string }>>;

async function fetchIngredientNamesByRecipeId(
  recipeIds: readonly string[],
): Promise<IngredientsByRecipeId> {
  const map: IngredientsByRecipeId = new Map();
  const ids = [...new Set(recipeIds.filter(Boolean))];
  if (ids.length === 0) return map;
  const { data, error } = await supabase
    .from("recipe_ingredients")
    .select("recipe_id, name")
    .in("recipe_id", ids);
  if (error || !data) return map;
  for (const row of data as Array<{ recipe_id: string | null; name: string | null }>) {
    const rid = row.recipe_id ?? "";
    const name = row.name ?? "";
    if (!rid || !name) continue;
    const bucket = map.get(rid) ?? [];
    bucket.push({ name });
    map.set(rid, bucket);
  }
  return map;
}

export function useShoppingSmartSuggestions(input: {
  userId: string | null;
  shoppingItems: readonly ShoppingItem[];
  savedRecipesForLibrary: readonly RecipeCard[];
  nutritionTargets: MacroTargets;
  nutritionByDay: Record<string, LoggedMeal[]>;
  mealPlan: DayPlan[] | null;
  syncShoppingListForPlanEdit: (edit: PlanShoppingEditRef) => Promise<void>;
}): {
  enabled: boolean;
  suggestions: ShoppingSmartSuggestion[];
  addingRecipeId: string | null;
  addedRecipeIds: ReadonlySet<string>;
  addToPlan: (suggestion: ShoppingSmartSuggestion) => Promise<void>;
} {
  const enabled = isFeatureEnabled("smart_suggestions_v1");
  const poolIds = useMemo(
    () => input.savedRecipesForLibrary.map((r) => r.id),
    [input.savedRecipesForLibrary],
  );
  const poolKey = poolIds.join(",");
  const [ingredientsByRecipeId, setIngredientsByRecipeId] = useState<IngredientsByRecipeId>(
    new Map(),
  );
  const [addingRecipeId, setAddingRecipeId] = useState<string | null>(null);
  const [addedRecipeIds, setAddedRecipeIds] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!enabled || !input.userId || poolIds.length === 0) {
      setIngredientsByRecipeId(new Map());
      return;
    }
    let cancelled = false;
    void fetchIngredientNamesByRecipeId(poolIds).then((map) => {
      if (!cancelled) setIngredientsByRecipeId(map);
    });
    return () => {
      cancelled = true;
    };
    // poolKey (not poolIds) is the intentional dep — a stable identity check
    // so this doesn't re-fetch on every render when the array is recreated
    // with the same ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, input.userId, poolKey]);

  const remainingBudget = useMemo(() => {
    const consumed = (input.nutritionByDay[todayKey()] ?? []).reduce(
      (acc, m) => ({
        calories: acc.calories + (m.calories || 0),
        protein: acc.protein + (m.protein || 0),
        carbs: acc.carbs + (m.carbs || 0),
        fat: acc.fat + (m.fat || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
    return computeRemaining(input.nutritionTargets, consumed);
  }, [input.nutritionTargets, input.nutritionByDay]);

  const excludeRecipeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const day of input.mealPlan ?? []) {
      for (const meal of day.meals) {
        if (meal.recipeId) ids.add(meal.recipeId);
      }
    }
    return ids;
  }, [input.mealPlan]);

  const candidates = useMemo((): OverlapCandidateRecipe[] => {
    const out: OverlapCandidateRecipe[] = [];
    for (const r of input.savedRecipesForLibrary) {
      const ingredients = ingredientsByRecipeId.get(r.id);
      if (!ingredients?.length) continue;
      out.push({
        id: r.id,
        title: r.title,
        ingredients,
        caloriesPerServing: r.calories,
        proteinPerServing: r.protein,
        carbsPerServing: r.carbs,
        fatPerServing: r.fat,
      });
    }
    return out;
  }, [input.savedRecipesForLibrary, ingredientsByRecipeId]);

  const suggestions = useMemo(() => {
    if (!enabled) return [];
    return rankIngredientOverlapSuggestions({
      currentIngredientNames: input.shoppingItems.map((i) => i.name),
      candidates,
      remainingBudget,
      excludeRecipeIds,
    });
  }, [enabled, input.shoppingItems, candidates, remainingBudget, excludeRecipeIds]);

  const addToPlan = async (suggestion: ShoppingSmartSuggestion) => {
    if (addingRecipeId) return;
    setAddingRecipeId(suggestion.recipeId);
    try {
      // Reuses the ENG-957 add-to-plan→list sync verbatim (the same call the
      // plan-swap flow makes) — merges the recipe's ingredients into the
      // shopping list without a full delete-and-replace. It owns its own
      // error toast on failure; we don't duplicate that here.
      await input.syncShoppingListForPlanEdit({
        kind: "add",
        recipe: { id: suggestion.recipeId, title: suggestion.title },
      });
      track(AnalyticsEvents.shopping_smart_suggestion_add_to_plan, {
        recipeId: suggestion.recipeId,
        overlapCount: suggestion.overlapCount,
        hasMacroFit: suggestion.macroFit != null,
        platform: "web",
      });
      setAddedRecipeIds((prev) => new Set(prev).add(suggestion.recipeId));
      toast.success(`Added — ${suggestion.title}'s ingredients joined your shopping list.`);
    } finally {
      setAddingRecipeId(null);
    }
  };

  return { enabled, suggestions, addingRecipeId, addedRecipeIds, addToPlan };
}
