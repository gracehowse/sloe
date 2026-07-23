// ENG-1634 — mobile host glue for the shopping-list "Smart suggestions"
// section. Web reuses `nutritionTargets`/`nutritionByDay` that `useAppData()`
// already holds app-wide; mobile has no equivalent always-mounted context
// (the Shopping screen is its own route, not nested inside Today's state),
// so this hook does two small, bounded queries of its own — today's profile
// targets and today's `nutrition_entries` sum — rather than pulling in
// Today's whole state machine. "Add to plan" reuses the ENG-957
// `syncPlanEditToShoppingList` (the SAME mechanism the plan-swap flow calls)
// via the shared `@suppr/shared/planning/shoppingSmartSuggestions` ranker.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isFeatureEnabled, track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { useSavedLibraryRecipes } from "@/lib/recipes";
import type { ShoppingScope } from "@suppr/shared/household/shoppingScope";
import { syncPlanEditToShoppingList } from "@/lib/planShoppingSync";
import { computeRemaining, type MacroTargets } from "@suppr/nutrition-core/remainingMacros";
import { dateKeyFromDate } from "@suppr/shared/datetime/dateKey";
import {
  rankIngredientOverlapSuggestions,
  type OverlapCandidateRecipe,
  type RemainingMacroBudget,
  type ShoppingSmartSuggestion,
} from "@suppr/shared/planning/shoppingSmartSuggestions";

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

/** Today's remaining macro budget, or `null` when the user has no targets
 *  set yet — never a fabricated budget (nutrition-trust rule). */
function useTodayRemainingMacros(userId: string | null): RemainingMacroBudget | null {
  const [budget, setBudget] = useState<RemainingMacroBudget | null>(null);

  useEffect(() => {
    if (!userId) {
      setBudget(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [{ data: profile }, { data: entries }] = await Promise.all([
        supabase
          .from("profiles")
          .select("target_calories, target_protein, target_carbs, target_fat")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("nutrition_entries")
          .select("calories, protein, carbs, fat")
          .eq("user_id", userId)
          .eq("date_key", dateKeyFromDate(new Date())),
      ]);
      if (cancelled) return;
      const hasTargets = Boolean(
        profile?.target_calories && profile.target_protein && profile.target_carbs && profile.target_fat,
      );
      if (!hasTargets) {
        setBudget(null);
        return;
      }
      const targets: MacroTargets = {
        calories: profile!.target_calories as number,
        protein: profile!.target_protein as number,
        carbs: profile!.target_carbs as number,
        fat: profile!.target_fat as number,
      };
      const consumed = (entries ?? []).reduce(
        (acc, e) => ({
          calories: acc.calories + (Number(e.calories) || 0),
          protein: acc.protein + (Number(e.protein) || 0),
          carbs: acc.carbs + (Number(e.carbs) || 0),
          fat: acc.fat + (Number(e.fat) || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
      setBudget(computeRemaining(targets, consumed));
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return budget;
}

export function useShoppingSmartSuggestions(input: {
  userId: string | null;
  scope: ShoppingScope | null;
  shoppingItemNames: readonly string[];
}): {
  enabled: boolean;
  suggestions: ShoppingSmartSuggestion[];
  addingRecipeId: string | null;
  addedRecipeIds: ReadonlySet<string>;
  addToPlan: (suggestion: ShoppingSmartSuggestion) => Promise<void>;
} {
  const enabled = isFeatureEnabled("smart_suggestions_v1");
  const { recipes: savedRecipes } = useSavedLibraryRecipes(input.userId);
  const remainingBudget = useTodayRemainingMacros(input.userId);

  const poolKey = useMemo(() => savedRecipes.map((r) => r.id).join(","), [savedRecipes]);
  const [ingredientsByRecipeId, setIngredientsByRecipeId] = useState<IngredientsByRecipeId>(
    new Map(),
  );
  const [addingRecipeId, setAddingRecipeId] = useState<string | null>(null);
  const [addedRecipeIds, setAddedRecipeIds] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!enabled || !input.userId || savedRecipes.length === 0) {
      setIngredientsByRecipeId(new Map());
      return;
    }
    let cancelled = false;
    void fetchIngredientNamesByRecipeId(savedRecipes.map((r) => r.id)).then((map) => {
      if (!cancelled) setIngredientsByRecipeId(map);
    });
    return () => {
      cancelled = true;
    };
    // poolKey is the intentional stable dep — avoids re-fetching every time
    // `savedRecipes` is recreated with the same ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, input.userId, poolKey]);

  const candidates = useMemo((): OverlapCandidateRecipe[] => {
    const out: OverlapCandidateRecipe[] = [];
    for (const r of savedRecipes) {
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
  }, [savedRecipes, ingredientsByRecipeId]);

  const suggestions = useMemo(() => {
    if (!enabled) return [];
    return rankIngredientOverlapSuggestions({
      currentIngredientNames: input.shoppingItemNames,
      candidates,
      remainingBudget,
    });
  }, [enabled, input.shoppingItemNames, candidates, remainingBudget]);

  const addToPlan = useCallback(
    async (suggestion: ShoppingSmartSuggestion) => {
      if (addingRecipeId) return;
      setAddingRecipeId(suggestion.recipeId);
      try {
        // Reuses the ENG-957 add-to-plan→list sync verbatim (the same call
        // the plan-swap flow makes on mobile) — merges the recipe's
        // ingredients into the shopping list; the realtime subscription
        // already on the Shopping screen refreshes `items` automatically.
        // `syncPlanEditToShoppingList` is fire-and-forget/best-effort by
        // design (see its own doc comment) — a `null` return (flag off /
        // signed out / nothing resolvable / transient failure) is a silent
        // no-op there, and the existing swap/remove convenience wrappers
        // treat it the same way, so we match that rather than surfacing a
        // bespoke error path for this one caller.
        const count = await syncPlanEditToShoppingList(input.scope, {
          kind: "add",
          recipe: { id: suggestion.recipeId, title: suggestion.title },
        });
        track(AnalyticsEvents.shopping_smart_suggestion_add_to_plan, {
          recipeId: suggestion.recipeId,
          overlapCount: suggestion.overlapCount,
          hasMacroFit: suggestion.macroFit != null,
          platform: "mobile",
        });
        if (count != null) {
          setAddedRecipeIds((prev) => new Set(prev).add(suggestion.recipeId));
        }
      } finally {
        setAddingRecipeId(null);
      }
    },
    [addingRecipeId, input.scope],
  );

  return { enabled, suggestions, addingRecipeId, addedRecipeIds, addToPlan };
}
