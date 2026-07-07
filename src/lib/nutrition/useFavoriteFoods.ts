"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase/browserClient.ts";
import {
  addFavorite,
  favoriteKey as favoriteFoodKey,
  listFavorites,
  removeFavorite,
  type FavoriteFood,
} from "./favoriteFoods.ts";

/**
 * ENG-1360 (second extraction pass, split out of `useSavedMealsAndFavorites`
 * to keep both files under the 400-line screen budget) — the host-owned
 * favourite-foods cluster: `hostFavorites`, the load effect, the optimistic
 * star/unstar toggle (`toggleFoodFavorite`), and the favourites-first
 * ordering key set. Byte-for-byte lift of the original state/effect/handler
 * that used to live inline in NutritionTracker — same queries, same
 * optimistic-update + revert-on-failure shape — just relocated. No behavior
 * change.
 *
 * Favourites-in-search (teardown #1, ENG-1041) — the user's starred foods,
 * loaded once and threaded into the LogSheet's inline FoodSearchPanel so
 * favourites surface IN search (a "Favourites" group above "Past logged" +
 * favourites-first in the empty-query Recent strip + a per-row star toggle).
 * The same `user_favorite_foods` model QuickAddPanel uses; the host owns the
 * list here because the LogSheet is a host-owned surface. Mobile parity:
 * `apps/mobile/app/(tabs)/index.tsx`.
 */
export function useFavoriteFoods(authedUserId: string | null | undefined) {
  const [hostFavorites, setHostFavorites] = useState<FavoriteFood[]>([]);
  const [favoritePendingKeys, setFavoritePendingKeys] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    let cancelled = false;
    if (!authedUserId) {
      setHostFavorites([]);
      return;
    }
    listFavorites(supabase, authedUserId)
      .then((rows) => {
        if (!cancelled) setHostFavorites(rows);
      })
      .catch((err) => {
        console.warn("NutritionTracker listFavorites failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, [authedUserId]);

  /** Optimistic star/unstar from a food-search row. Mirrors the mobile host
   *  + QuickAddPanel `toggleFavorite`: add/remove immediately, revert on
   *  Supabase failure, guard double-submit via `favoritePendingKeys`. */
  const toggleFoodFavorite = useCallback(
    async (food: {
      recipeTitle: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number;
      source?: string;
      favoriteId?: string;
    }) => {
      if (!authedUserId) return;
      const key = favoriteFoodKey(food.recipeTitle, food.calories);
      if (favoritePendingKeys.has(key)) return;
      setFavoritePendingKeys((s) => new Set(s).add(key));
      const snapshot = hostFavorites;
      const wasStarred = Boolean(food.favoriteId);
      try {
        if (wasStarred && food.favoriteId) {
          setHostFavorites((prev) => prev.filter((f) => f.id !== food.favoriteId));
          await removeFavorite(supabase, authedUserId, food.favoriteId);
        } else {
          const tempId = `temp-${key}`;
          const optimistic: FavoriteFood = {
            id: tempId,
            recipeTitle: food.recipeTitle,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            ...(food.fiber != null ? { fiber: food.fiber } : {}),
            ...(food.source ? { source: food.source } : {}),
            count: 1,
            createdAt: new Date().toISOString(),
          };
          setHostFavorites((prev) => [optimistic, ...prev]);
          const saved = await addFavorite(supabase, authedUserId, {
            recipeTitle: food.recipeTitle,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            fiber: food.fiber,
            source: food.source ?? null,
          });
          setHostFavorites((prev) => [saved, ...prev.filter((f) => f.id !== tempId)]);
        }
      } catch (err) {
        setHostFavorites(snapshot);
        console.warn("NutritionTracker food favourite toggle failed", err);
      } finally {
        setFavoritePendingKeys((s) => {
          const n = new Set(s);
          n.delete(key);
          return n;
        });
      }
    },
    [authedUserId, hostFavorites, favoritePendingKeys],
  );

  /** Favourite key set — drives favourites-first ordering of the empty-query
   *  Recent browse list (web's empty-query recent strip lives in the LogSheet
   *  `recent` browse tab, not the panel, so the ordering is applied here). */
  const favoriteKeySetForRecent = useMemo(
    () =>
      new Set(hostFavorites.map((f) => favoriteFoodKey(f.recipeTitle, f.calories))),
    [hostFavorites],
  );

  return {
    hostFavorites,
    favoritePendingKeys,
    toggleFoodFavorite,
    favoriteKeySetForRecent,
  };
}
