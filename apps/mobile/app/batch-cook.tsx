import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";

import { BatchCookSurface } from "@/components/plan/BatchCookSurface";
import { useAuth } from "@/context/auth";
import { useSavedLibraryRecipes } from "@/lib/recipes";
import { supabase } from "@/lib/supabase";
import { useSafeBack } from "@/hooks/use-safe-back";
import {
  isBatchCookCandidate,
  recipeTotalTimeMin,
  type BatchCookRecipeCandidate,
} from "@suppr/shared/planning/batchCook";
import { scaleBatchCookToShoppingList } from "@suppr/shared/planning/scaleBatchCookToShoppingList";
import { parsePantryStaples } from "@suppr/shared/planning/pantryStaples";
import { getMyHousehold } from "@suppr/shared/household/householdClient";
import { shoppingScopeFor } from "@suppr/shared/household/shoppingScope";

/** ENG-1255 — Batch cook pushed screen (`suppr:///batch-cook`). */
export default function BatchCookScreen() {
  const router = useRouter();
  const goBack = useSafeBack("/(tabs)/planner");
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { recipes: saved } = useSavedLibraryRecipes(userId);
  const [saving, setSaving] = useState(false);

  const candidates = useMemo<BatchCookRecipeCandidate[]>(() => {
    return saved
      .filter((r) => isBatchCookCandidate({ servings: r.servings ?? null }))
      .slice(0, 12)
      .map((r) => ({
        id: r.id,
        title: r.title,
        calories: r.calories ?? 0,
        protein: r.protein ?? 0,
        timeMin: recipeTotalTimeMin(r.prepTimeMin, r.cookTimeMin),
        servings: r.servings ?? 1,
        imageUrl: r.image ?? null,
      }));
  }, [saved]);

  const scaleToShopping = useCallback(
    async (recipe: BatchCookRecipeCandidate, portions: number) => {
      if (!userId) {
        Alert.alert("Sign in required", "Sign in to update your shopping list.");
        return false;
      }
      const { data: ingredients, error } = await supabase
        .from("recipe_ingredients")
        .select("name, amount, unit, recipe_id")
        .eq("recipe_id", recipe.id);
      if (error || !ingredients?.length) {
        Alert.alert("No ingredients", "This recipe has no ingredient lines to scale yet.");
        return false;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("pantry_staples")
        .eq("id", userId)
        .maybeSingle();

      // ENG-1600 — resolve household scope the same way the single-recipe
      // "Add to shopping list" action does (ENG-943's
      // `AddToShoppingListButton.tsx`), so a household user's batch-cook
      // items land in the shared household list, not a solo-only row.
      let householdId: string | null = null;
      try {
        const { data } = await getMyHousehold(supabase as never, userId);
        householdId = data?.household?.id ?? null;
      } catch {
        householdId = null;
      }
      const scope = shoppingScopeFor({ userId, householdId });

      const res = await scaleBatchCookToShoppingList({
        client: supabase as never,
        scope,
        recipeTitle: recipe.title,
        recipeServings: recipe.servings,
        portions,
        ingredients: ingredients.map((ing) => ({
          name: String(ing.name ?? ""),
          amount: ing.amount != null ? String(ing.amount) : "",
          unit: String(ing.unit ?? ""),
        })),
        pantryStaples: parsePantryStaples(profile?.pantry_staples),
      });
      if (!res.ok) {
        Alert.alert("Couldn't update shopping list", res.error);
        return false;
      }
      return true;
    },
    [userId],
  );

  const onSave = useCallback(
    async (recipe: BatchCookRecipeCandidate, portions: number) => {
      setSaving(true);
      try {
        const ok = await scaleToShopping(recipe, portions);
        if (ok) {
          Alert.alert("Batch saved", "Shopping list scaled to your batch.", [
            { text: "View list", onPress: () => router.push("/shopping") },
            { text: "Done", style: "cancel", onPress: goBack },
          ]);
        }
      } finally {
        setSaving(false);
      }
    },
    [goBack, router, scaleToShopping],
  );

  const onCook = useCallback(
    async (recipe: BatchCookRecipeCandidate, portions: number) => {
      setSaving(true);
      try {
        await scaleToShopping(recipe, portions);
      } finally {
        setSaving(false);
      }
      router.push(`/recipe/${recipe.id}?cook=1` as never);
    },
    [router, scaleToShopping],
  );

  return (
    <BatchCookSurface
      recipes={candidates}
      saving={saving}
      onBack={goBack}
      onSave={onSave}
      onCook={onCook}
    />
  );
}
