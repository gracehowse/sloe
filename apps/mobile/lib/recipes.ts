import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { formatRecipeMinutes } from "./formatRecipeMinutes";
import { supabase } from "./supabase";
import { cacheDiscoverRecipes, getCachedDiscoverRecipes } from "./offlineCache";
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
        "id, title, image_url, servings, calories, protein, carbs, fat, fiber_g, is_verified, created_at, author_id, meal_type, source_url, source_name, prep_time_min, cook_time_min",
      )
      .eq("published", true)
      .not("author_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (!error && data) {
      const mapped: RecipeCard[] = data.map((r: any) => {
        const prepM = r.prep_time_min != null ? Number(r.prep_time_min) : NaN;
        const cookM = r.cook_time_min != null ? Number(r.cook_time_min) : NaN;
        const prepOk = Number.isFinite(prepM) && prepM > 0;
        const cookOk = Number.isFinite(cookM) && cookM > 0;
        return {
          id: r.id,
          title: r.title ?? "Untitled",
          image: r.image_url ?? DEFAULT_IMAGE,
          creatorName: r.source_name ?? "Community",
          creatorImage: DEFAULT_AVATAR,
          servings: r.servings ?? 1,
          calories: r.calories ?? 0,
          protein: r.protein ?? 0,
          carbs: r.carbs ?? 0,
          fat: r.fat ?? 0,
          fiberG: r.fiber_g ?? 0,
          isVerified: r.is_verified ?? false,
          savedCount: 0,
          isSaved: false,
          authorId: r.author_id,
          sourceUrl: r.source_url ?? null,
          mealSlots: Array.isArray(r.meal_type) ? r.meal_type : r.meal_type ? [r.meal_type] : undefined,
          feedSource: "community" as const,
          prepTimeMin: prepOk ? Math.round(prepM) : null,
          cookTimeMin: cookOk ? Math.round(cookM) : null,
          prepTime: formatRecipeMinutes(prepOk ? prepM : null),
          cookTime: formatRecipeMinutes(cookOk ? cookM : null),
        };
      });
      setRecipes(mapped);
      void cacheDiscoverRecipes(mapped); // Cache for offline
    } else if (error) {
      // Network failure — try offline cache
      console.error("[useDiscoverRecipes] DB failed, trying cache:", error.message);
      const cached = await getCachedDiscoverRecipes();
      if (cached && Array.isArray(cached)) {
        setRecipes(cached as RecipeCard[]);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { recipes, loading, refresh };
}

/** Free-tier save limit — must match web (src/context/appData/constants.ts). */
const FREE_SAVE_LIMIT = 10;

/** Fetch user's saved recipe IDs. */
export function useSavedRecipes(userId: string | null) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [userTier, setUserTier] = useState<"free" | "base" | "pro">("free");

  // Load user tier once
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("user_tier")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.user_tier) setUserTier(data.user_tier as "free" | "base" | "pro");
      });
  }, [userId]);

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
    if (!userId) {
      console.warn("[toggleSave] no userId — user not logged in");
      return;
    }

    setSavedIds((prev) => {
      const isSaved = prev.has(recipeId);

      // Enforce free-tier save limit (matches web FREE_SAVE_LIMIT).
      if (!isSaved && userTier === "free" && prev.size >= FREE_SAVE_LIMIT) {
        Alert.alert(
          "Save limit reached",
          `Free plan is limited to ${FREE_SAVE_LIMIT} saved recipes. Upgrade to save more.`,
        );
        return prev; // no change
      }
      const next = new Set(prev);
      if (isSaved) next.delete(recipeId);
      else next.add(recipeId);

      // Fire DB operation in background (using current isSaved, not stale closure)
      (async () => {
        const { error } = isSaved
          ? await supabase.from("saves").delete().eq("user_id", userId).eq("recipe_id", recipeId)
          : await supabase.from("saves").insert({ user_id: userId, recipe_id: recipeId });

        if (error) {
          console.error("[toggleSave] failed:", error.message, "| userId:", userId, "| recipeId:", recipeId);
          // Roll back the optimistic update first so the UI stays truthful.
          setSavedIds((curr) => {
            const rollback = new Set(curr);
            if (isSaved) rollback.add(recipeId);
            else rollback.delete(recipeId);
            return rollback;
          });
          // When the RLS policy `saves_insert_own` rejects the insert
          // (see `supabase/migrations/20260426100000_saves_free_tier_cap.sql`),
          // Postgres returns code 42501 or a "row-level security" message.
          // Surface the paywall-style prompt instead of a generic failure.
          const msg = (error.message ?? "").toLowerCase();
          const code = (error as { code?: string }).code;
          if (!isSaved && (code === "42501" || msg.includes("row-level security") || msg.includes("row level security"))) {
            Alert.alert(
              "Save limit reached",
              `Free plan is limited to ${FREE_SAVE_LIMIT} saved recipes. Upgrade to save more.`,
            );
          }
        }
      })();

      return next;
    });
  }, [userId, userTier]);

  return { savedIds, loading, refresh, toggleSave, isSaved: (id: string) => savedIds.has(id) };
}

/**
 * Full recipe rows for everything in the user's library, including
 * private imports and created drafts.
 *
 * Library contents (F-7, TestFlight `AO2jdncS2GxyJaeXPPFR30M`,
 * 2026-04-18): the union of
 *   1. Explicit saves (`saves` rows) — bookmarked via the Save toggle.
 *   2. Anything authored by the user (`recipes.author_id = userId`) —
 *      imports and created drafts are "mine by nature", so they stay
 *      in Library even when unsaved. Web parity:
 *      `src/context/AppDataContext.tsx#savedRecipesForLibrary` and the
 *      shared pure composer `src/lib/recipes/composeLibraryEntries.ts`.
 *
 * Order: newest `saves.created_at` first for explicitly-saved rows,
 * followed by recipes authored by the user but not in `saves`
 * (ordered by `recipes.created_at` desc). `isSaved` on each card
 * reflects whether it's in `saves` so the bookmark icon tells the
 * truth — author-owned rows that are not in `saves` carry
 * `isSaved: false`.
 *
 * F-8 (TestFlight `AAHS7CjeXNC-mwzyLgWFuKQ`, 2026-04-18): when a save
 * references a recipe that no longer exists (orphan), the `.in("id",
 * saveIds)` lookup silently drops it — no "Unavailable" card is ever
 * rendered. We emit a single telemetry log when the drop count is
 * non-zero so we can track cleanup debt. Server-side orphan cleanup
 * happens on web (longer-lived auth); mobile observation-only.
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

    // Parallel fetch: saves + author-owned recipes. Either can be
    // empty independently (brand-new user with one created draft, or
    // a user who only bookmarks community recipes).
    const [savesRes, authoredRes] = await Promise.all([
      supabase
        .from("saves")
        .select("recipe_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("recipes")
        .select(
          "id, title, image_url, servings, calories, protein, carbs, fat, fiber_g, is_verified, author_id, meal_type, source_url, source_name, prep_time_min, cook_time_min, created_at, author:profiles!author_id(display_name, avatar_url)",
        )
        .eq("author_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    const saves = savesRes.data ?? [];
    const authoredRows = authoredRes.data ?? [];

    if (saves.length === 0 && authoredRows.length === 0) {
      setRecipes([]);
      setLoading(false);
      return;
    }

    const saveIds = saves.map((s: { recipe_id: string }) => s.recipe_id);
    const saveIdSet = new Set(saveIds);

    // Fetch full rows for saves that are NOT already in the author
    // list (authored recipes are fetched in full above). Avoids
    // re-fetching when a user has saved their own recipe.
    const authoredIdSet = new Set(authoredRows.map((r: any) => r.id as string));
    const extraIds = saveIds.filter((id) => !authoredIdSet.has(id));

    let savedOnlyRows: any[] = [];
    if (extraIds.length > 0) {
      const { data: extraRows, error: recErr } = await supabase
        .from("recipes")
        .select(
          "id, title, image_url, servings, calories, protein, carbs, fat, fiber_g, is_verified, author_id, meal_type, source_url, source_name, prep_time_min, cook_time_min, created_at, author:profiles!author_id(display_name, avatar_url)",
        )
        .in("id", extraIds);
      if (!recErr && Array.isArray(extraRows)) {
        savedOnlyRows = extraRows;
        if (extraRows.length < extraIds.length) {
          // F-8 telemetry: orphan saves referenced a deleted recipe.
          // Silent log only — no user-facing error.
          console.info(
            "[useSavedLibraryRecipes] dropping orphan save rows:",
            extraIds.length - extraRows.length,
          );
        }
      }
    }

    const rows = [...authoredRows, ...savedOnlyRows];
    if (rows.length === 0) {
      setRecipes([]);
      setLoading(false);
      return;
    }

    const byId = new Map(
      (rows as any[]).map((r) => {
        const importAttribution = (r.source_name as string | null | undefined)?.trim() ?? "";
        const authorDisplay = (r.author?.display_name as string | null | undefined)?.trim() ?? "";
        const isOwn = r.author_id === userId;
        const creatorName =
          importAttribution || (isOwn ? "You" : authorDisplay || "Community");
        const creatorImage =
          (r.author?.avatar_url as string | null | undefined)?.trim() || DEFAULT_AVATAR;
        const prepM = r.prep_time_min != null ? Number(r.prep_time_min) : NaN;
        const cookM = r.cook_time_min != null ? Number(r.cook_time_min) : NaN;
        const prepOk = Number.isFinite(prepM) && prepM > 0;
        const cookOk = Number.isFinite(cookM) && cookM > 0;
        const card: RecipeCard = {
          id: r.id,
          title: r.title ?? "Untitled",
          image: r.image_url ?? DEFAULT_IMAGE,
          creatorName,
          creatorImage,
          servings: r.servings ?? 1,
          calories: r.calories ?? 0,
          protein: r.protein ?? 0,
          carbs: r.carbs ?? 0,
          fat: r.fat ?? 0,
          fiberG: r.fiber_g ?? 0,
          isVerified: r.is_verified ?? false,
          savedCount: 0,
          // F-7: `isSaved` reflects `saves` membership only — author-
          // owned rows unioned in keep `false` so the bookmark icon on
          // Recipe Detail can toggle between saved/unsaved without
          // lying about state.
          isSaved: saveIdSet.has(r.id),
          authorId: r.author_id,
          sourceUrl: r.source_url ?? null,
          mealSlots: Array.isArray(r.meal_type) ? r.meal_type : r.meal_type ? [r.meal_type] : undefined,
          prepTimeMin: prepOk ? Math.round(prepM) : null,
          cookTimeMin: cookOk ? Math.round(cookM) : null,
          prepTime: formatRecipeMinutes(prepOk ? prepM : null),
          cookTime: formatRecipeMinutes(cookOk ? cookM : null),
        };
        return [r.id as string, card] as const;
      }),
    );

    // Compose the ordered list:
    //   1. Explicit saves first, in saves.created_at order (newest first).
    //   2. Author-owned recipes not in saves, in recipes.created_at
    //      order (authoredRows already sorted desc by the query).
    const ordered: RecipeCard[] = [];
    const emitted = new Set<string>();
    for (const id of saveIds) {
      const c = byId.get(id);
      if (c && !emitted.has(id)) {
        ordered.push(c);
        emitted.add(id);
      }
    }
    for (const r of authoredRows as { id: string }[]) {
      if (emitted.has(r.id)) continue;
      const c = byId.get(r.id);
      if (c) {
        ordered.push(c);
        emitted.add(r.id);
      }
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
      .select("*")
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
