import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { RecipeCard } from "./types";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop";
const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop";

/** Fetch published community recipes for the Discover feed. */
export function useDiscoverRecipes() {
  const [recipes, setRecipes] = useState<RecipeCard[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("recipes")
      .select(
        "id, title, image_url, servings, calories, protein, carbs, fat, fiber_g, is_verified, created_at, author_id, meal_type, author:profiles(display_name, avatar_url)"
      )
      .eq("published", true)
      .not("author_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      const mapped: RecipeCard[] = data.map((r: any) => ({
        id: r.id,
        title: r.title ?? "Untitled",
        image: r.image_url ?? DEFAULT_IMAGE,
        creatorName: r.author?.display_name ?? "Community",
        creatorImage: r.author?.avatar_url ?? DEFAULT_AVATAR,
        servings: r.servings ?? 1,
        calories: r.calories ?? 0,
        protein: r.protein ?? 0,
        carbs: r.carbs ?? 0,
        fat: r.fat ?? 0,
        fiberG: r.fiber_g ?? undefined,
        isVerified: r.is_verified ?? false,
        authorId: r.author_id,
        mealSlots: r.meal_type ? [r.meal_type] : undefined,
        feedSource: "community" as const,
      }));
      setRecipes(mapped);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { recipes, loading, refresh };
}

/** Fetch user's saved recipe IDs. */
export function useSavedRecipes(userId: string | null) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) { setSavedIds(new Set()); setLoading(false); return; }
    const { data } = await supabase
      .from("saves")
      .select("recipe_id")
      .eq("user_id", userId);

    if (data) {
      setSavedIds(new Set(data.map((r: any) => r.recipe_id)));
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleSave = useCallback(async (recipeId: string) => {
    if (!userId) return;
    const isSaved = savedIds.has(recipeId);

    setSavedIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(recipeId);
      else next.add(recipeId);
      return next;
    });

    if (isSaved) {
      await supabase.from("saves").delete().eq("user_id", userId).eq("recipe_id", recipeId);
    } else {
      await supabase.from("saves").insert({ user_id: userId, recipe_id: recipeId });
    }
  }, [userId, savedIds]);

  return { savedIds, loading, refresh, toggleSave, isSaved: (id: string) => savedIds.has(id) };
}

/**
 * Full recipe rows for everything in the user’s library (saved IDs), including private imports.
 * Order matches save date (newest first).
 */
export function useSavedLibraryRecipes(userId: string | null) {
  const [recipes, setRecipes] = useState<RecipeCard[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setRecipes([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: saves, error: savesErr } = await supabase
      .from("saves")
      .select("recipe_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (savesErr || !saves?.length) {
      setRecipes([]);
      setLoading(false);
      return;
    }

    const ids = saves.map((s: { recipe_id: string }) => s.recipe_id);

    const { data: rows, error: recErr } = await supabase
      .from("recipes")
      .select(
        "id, title, image_url, servings, calories, protein, carbs, fat, fiber_g, is_verified, author_id, meal_type, author:profiles(display_name, avatar_url)",
      )
      .in("id", ids);

    if (recErr || !rows?.length) {
      setRecipes([]);
      setLoading(false);
      return;
    }

    const byId = new Map(
      (rows as any[]).map((r) => {
        const card: RecipeCard = {
          id: r.id,
          title: r.title ?? "Untitled",
          image: r.image_url ?? DEFAULT_IMAGE,
          creatorName: r.author?.display_name ?? "You",
          creatorImage: r.author?.avatar_url ?? DEFAULT_AVATAR,
          servings: r.servings ?? 1,
          calories: r.calories ?? 0,
          protein: r.protein ?? 0,
          carbs: r.carbs ?? 0,
          fat: r.fat ?? 0,
          fiberG: r.fiber_g ?? undefined,
          isVerified: r.is_verified ?? false,
          authorId: r.author_id,
          mealSlots: r.meal_type ? [r.meal_type] : undefined,
        };
        return [r.id as string, card] as const;
      }),
    );

    const ordered: RecipeCard[] = [];
    for (const id of ids) {
      const c = byId.get(id);
      if (c) ordered.push(c);
    }

    setRecipes(ordered);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { recipes, loading, refresh };
}

/** Fetch a single recipe with ingredients. */
export async function fetchRecipeDetail(recipeId: string) {
  const [recipeRes, ingredientsRes] = await Promise.all([
    supabase
      .from("recipes")
      .select("*, author:profiles(display_name, avatar_url)")
      .eq("id", recipeId)
      .maybeSingle(),
    supabase
      .from("recipe_ingredients")
      .select("name, amount, unit, calories, protein, carbs, fat, is_verified, source")
      .eq("recipe_id", recipeId),
  ]);

  return {
    recipe: recipeRes.data,
    ingredients: ingredientsRes.data ?? [],
    error: recipeRes.error ?? ingredientsRes.error,
  };
}
