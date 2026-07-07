"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { buildMealEntriesFromSavedMeal } from "./savedMealsLogic.ts";
import type { SavedMeal } from "./savedMeals.ts";
import type { FoodHistoryItem } from "./foodHistory.ts";
import type { LoggedMeal } from "../../types/recipe.ts";
import type { FoodLoggedSource } from "../analytics/events.ts";

export interface UseMealLoggingArgs {
  selectedDateKey: string;
  addLoggedMeal: (
    meal: Omit<LoggedMeal, "id">,
    analyticsSource?: FoodLoggedSource,
  ) => string;
  addLoggedMealForDate: (
    dateKey: string,
    meal: Omit<LoggedMeal, "id">,
    analyticsSource?: FoodLoggedSource,
  ) => string;
}

/**
 * ENG-1360 (second extraction pass, split out of `useSavedMealsAndFavorites`
 * to keep both files under the 400-line screen budget) — the two base
 * logging primitives: `logHistoryItem` (Favourite / Frequent / Recent →
 * active meal slot) and `logSavedMeal` (expand a saved-meal combo into
 * individual journal entries). Byte-for-byte lift of the original callbacks
 * that used to live inline in NutritionTracker — same analytics, same
 * dependency arrays — just relocated. No behavior change.
 */
export function useMealLogging({
  selectedDateKey,
  addLoggedMeal,
  addLoggedMealForDate,
}: UseMealLoggingArgs) {
  /** Log a history row (Favourite / Frequent / Recent) into the active
   * meal slot. Shared by the QuickAddPanel history rows so the event
   * shape is consistent. */
  const logHistoryItem = useCallback(
    (item: FoodHistoryItem, slot: string) => {
      // Audit L6 G1 (2026-04-18) — the canonical `food_logged` event
      // is now fired inside `addLoggedMeal` with the supplied source,
      // so we pass "quick_add" here instead of double-emitting. Drops
      // the prior secondary `track(food_logged, { source: "quick_add", slot })`
      // call that could desync from the primitive's payload.
      //
      // Tracking-extras autoupdate (2026-05-01) — re-attach caffeine /
      // alcohol micros so the journal-state insert path picks up the
      // F-13 daily bump. `computeRecentMeals` / `computeFrequentMeals`
      // average per-occurrence stimulant contribution into
      // `item.caffeineMg` / `item.alcoholG`. Missing → no key in
      // `micros` (and `addLoggedMeal` skips the bump).
      const micros: Record<string, number> = item.micros ? { ...item.micros } : {};
      if (item.caffeineMg != null && item.caffeineMg > 0) micros.caffeineMg = item.caffeineMg;
      if (item.alcoholG != null && item.alcoholG > 0) micros.alcoholG = item.alcoholG;
      addLoggedMeal(
        {
          name: slot,
          recipeTitle: item.recipeTitle,
          time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          ...(item.fiber != null ? { fiberG: item.fiber } : {}),
          ...(item.source ? { source: item.source } : {}),
          ...(Object.keys(micros).length > 0 ? { micros } : {}),
        },
        "quick_add",
      );
      toast.success(`Logged ${item.recipeTitle} to ${slot}.`);
    },
    [addLoggedMeal],
  );

  /** Expand a saved-meal combo into individual journal entries and
   * insert each one via the same primitive as manual logs. Batch 2.6. */
  const logSavedMeal = useCallback(
    (meal: SavedMeal, slot: string) => {
      const timeLabel = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      // Build entries — makeId is swallowed because addLoggedMealForDate
      // mints its own id. We pass `() => ""` here; the id field is
      // discarded before insert. Using `newId` is impossible (it is
      // file-local to persistence.ts) and unnecessary.
      const entries = buildMealEntriesFromSavedMeal(meal, slot, timeLabel, () => "");
      for (const entry of entries) {
        const {
          id: _discardedId,
          sourceId: _discardedSourceId,
          ...payload
        } = entry;
        void _discardedId;
        void _discardedSourceId;
        addLoggedMealForDate(selectedDateKey, payload, "saved_meal");
      }
      toast.success(`Logged ${meal.name} to ${slot}.`);
    },
    [addLoggedMealForDate, selectedDateKey],
  );

  return { logHistoryItem, logSavedMeal };
}
