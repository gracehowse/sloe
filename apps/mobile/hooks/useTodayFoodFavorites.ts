import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";

import { supabase } from "@/lib/supabase";
import { showSignInAlert } from "@/lib/authAlertCopy";
import {
  addFavorite,
  favoriteKey as favoriteFoodKey,
  listFavorites,
  removeFavorite,
  type FavoriteFood,
} from "@suppr/nutrition-core/favoriteFoods";

type UseTodayFoodFavoritesParams = {
  userId: string | undefined;
};

export type UseTodayFoodFavoritesResult = {
  hostFavorites: FavoriteFood[];
  favoritePendingKeys: Set<string>;
  toggleFoodFavorite: (food: {
    recipeTitle: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    source?: string;
    favoriteId?: string;
  }) => Promise<void>;
};

/**
 * ENG-1361 — Today extract (round 2, real domain hook, not a re-export
 * shim). Owns the "favourites-in-search" list (teardown #1, ENG-1041):
 * the user's starred foods, loaded once per `userId` and threaded into
 * the LogSheet's inline FoodSearchPanel so favourites surface IN search
 * (a "Favourites" group + favourites-first in the Recent strip + a
 * per-row star toggle).
 *
 * ## Why a hook
 *
 * The load effect, the pending-key double-submit guard, and the
 * optimistic add/remove-with-rollback toggle are a fully self-contained
 * unit — every piece only reads `userId` (+ the module-level `supabase`
 * client) and touches no other Today state. Pulling it out removes
 * ~100 lines from the Today parent with zero behaviour change.
 *
 * ## Failure modes
 *
 * - Supabase `addFavorite` / `removeFavorite` rejects → local state
 *   rolls back to the pre-toggle snapshot and an `Alert` surfaces so a
 *   star tap never silently "doesn't take".
 * - `userId` not yet resolved → `toggleFoodFavorite` shows the sign-in
 *   alert instead of writing to an unscoped row; the list load effect
 *   clears `hostFavorites` to `[]` rather than leaving a stale list from
 *   a previous session visible.
 */
export function useTodayFoodFavorites({
  userId,
}: UseTodayFoodFavoritesParams): UseTodayFoodFavoritesResult {
  const [hostFavorites, setHostFavorites] = useState<FavoriteFood[]>([]);
  const [favoritePendingKeys, setFavoritePendingKeys] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setHostFavorites([]);
      return;
    }
    listFavorites(supabase, userId)
      .then((rows) => {
        if (!cancelled) setHostFavorites(rows);
      })
      .catch((err) => {
        console.warn("Today listFavorites failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /** Optimistic star/unstar from a food-search row. Mirrors QuickAddPanel's
   *  `toggleFavorite`: add/remove immediately, revert on Supabase failure,
   *  guard double-submit via `favoritePendingKeys`. */
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
      if (!userId) {
        showSignInAlert("save favourites");
        return;
      }
      const key = favoriteFoodKey(food.recipeTitle, food.calories);
      if (favoritePendingKeys.has(key)) return;
      setFavoritePendingKeys((s) => new Set(s).add(key));
      const snapshot = hostFavorites;
      const wasStarred = Boolean(food.favoriteId);
      try {
        if (wasStarred && food.favoriteId) {
          setHostFavorites((prev) => prev.filter((f) => f.id !== food.favoriteId));
          await removeFavorite(supabase, userId, food.favoriteId);
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
          const saved = await addFavorite(supabase, userId, {
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
        Alert.alert(
          wasStarred ? "Could not remove favourite" : "Could not save favourite",
          "Please try again.",
        );
        console.warn("Today food favourite toggle failed", err);
      } finally {
        setFavoritePendingKeys((s) => {
          const n = new Set(s);
          n.delete(key);
          return n;
        });
      }
    },
    [userId, hostFavorites, favoritePendingKeys],
  );

  return {
    hostFavorites,
    favoritePendingKeys,
    toggleFoodFavorite,
  };
}
