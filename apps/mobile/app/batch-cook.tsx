import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";

import { BatchCookSurface } from "@/components/plan/BatchCookSurface";
import { useAuth } from "@/context/auth";
import { useSavedLibraryRecipes } from "@/lib/recipes";
import { supabase } from "@/lib/supabase";
import { useSafeBack } from "@/hooks/use-safe-back";
import {
  batchShoppingMultiplier,
  isBatchCookCandidate,
  recipeTotalTimeMin,
  type BatchCookRecipeCandidate,
} from "@suppr/shared/planning/batchCook";
import { generateShoppingListFromRecipeEntriesAsync } from "@suppr/shared/planning/generateShoppingList";
import { upsertShoppingListJsonItems } from "@suppr/shared/supabase/shoppingJsonFallback";
import { filterShoppingItemsByPantry, parsePantryStaples } from "@suppr/shared/planning/pantryStaples";

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
      const multiplier = batchShoppingMultiplier(portions, recipe.servings);
      const titleToId = (title: string) => (title === recipe.title ? recipe.id : null);
      const ingredientsByRecipeId = new Map<
        string,
        Array<{ name: string; amount: string; unit: string }>
      >([
        [
          recipe.id,
          ingredients.map((ing) => ({
            name: String(ing.name ?? ""),
            amount: ing.amount != null ? String(ing.amount) : "",
            unit: String(ing.unit ?? ""),
          })),
        ],
      ]);
      const generated = await generateShoppingListFromRecipeEntriesAsync({
        entries: [{ title: recipe.title, multiplier }],
        recipeTitleToId: titleToId,
        fetchDbIngredients: async (recipeId) => ingredientsByRecipeId.get(recipeId) ?? [],
        fetchDbIngredientsBatch: async () => ingredientsByRecipeId,
      });
      const { data: profile } = await supabase
        .from("profiles")
        .select("pantry_staples")
        .eq("id", userId)
        .maybeSingle();
      const filtered = filterShoppingItemsByPantry(generated, parsePantryStaples(profile?.pantry_staples));
      const items = filtered.map((it) => ({
        name: it.name,
        amount: it.amount,
        unit: it.unit,
        category: it.category,
        checked: false,
      }));
      const { error: upErr } = await upsertShoppingListJsonItems(supabase, userId, items);
      if (upErr) {
        Alert.alert("Couldn't update shopping list", upErr.message);
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
