"use client";

import { useCallback } from "react";
import {
  foodSelectionAnalyticsSource,
  foodSelectionSourceLabel,
  foodSelectionToMealMacros,
  type FoodSelectionLike,
} from "./foodSelectionToMeal.ts";
import { mealImageFields } from "./foodHistory.ts";
import type { FoodHistoryItem } from "./foodHistory.ts";
import type { LoggedMeal } from "../../types/recipe.ts";
import type { FoodLoggedSource } from "../analytics/events.ts";

/** Structural superset of the panel's `FoodSearchSelection` this hook needs. */
export type LogSheetFoodSelection = FoodSelectionLike & {
  /** ENG-772 — consumption instant from the preview time picker. */
  eatenAt?: string;
  /** ENG-1502 — per-item trust bit (see `FoodSearchSelection.verified`). */
  verified?: boolean;
};

export interface UseLogSheetFoodCommitsArgs {
  selectedDateKey: string;
  mealSlot: string;
  timeLabel: string;
  addLoggedMealForDate: (
    dateKey: string,
    meal: Omit<LoggedMeal, "id">,
    analyticsSource?: FoodLoggedSource,
  ) => string;
  eatenAtForCurrentLog: () => Pick<LoggedMeal, "eatenAt">;
  presentLogSheetConfirmation: (payload: {
    title: string;
    kcal: number;
    mealIds: string[];
    /** ENG-1502 — per-item trust bit; absent = honest `~` (ENG-1417). */
    kcalIsVerified?: boolean;
  }) => void;
}

/**
 * ENG-1502 (extraction pass, screen-budget ratchet ENG-621/717) — the two
 * LogSheet food-commit paths, lifted byte-for-byte out of
 * `NutritionTracker.tsx`. Mobile mirror stays inline in `TodayScreen.tsx`
 * (`commitLogSheetFoodSelection` / `logHistoryItemFromSheet`).
 *
 * - `commitFoodSearchSelection` — canonical food-search selection commit.
 *   Used by both the `<FoodSearch>` dialog and the inline `<FoodSearchPanel>`
 *   mounted inside `<LogSheet>`. Both surfaces produce the exact same
 *   `FoodSearchSelection` payload so the journal row, source label,
 *   caffeine/alcohol auto-track, and OFF micro persistence stay identical
 *   regardless of entry point. Returns the ENG-1502 `kcalIsVerified` trust
 *   bit (true only for verified-USDA / Suppr-generic rows) so the S13
 *   confirmation renders the unqualified kcal only when the data genuinely
 *   is verified.
 *
 * - `logHistoryItemFromSheet` — re-log of a prior journal row (go-tos /
 *   Recent). The journal doesn't persist the ENG-1417 trust bit, so this
 *   path always presents `kcalIsVerified: false` — unknown trust must never
 *   read as confident.
 */
export function useLogSheetFoodCommits({
  selectedDateKey,
  mealSlot,
  timeLabel,
  addLoggedMealForDate,
  eatenAtForCurrentLog,
  presentLogSheetConfirmation,
}: UseLogSheetFoodCommitsArgs) {
  const commitFoodSearchSelection = useCallback(
    (
      selection: LogSheetFoodSelection,
    ): { id: string; title: string; kcal: number; kcalIsVerified: boolean } => {
      const sourceLabel = foodSelectionSourceLabel(selection.source);

      // ENG-1046 — shared scaling core (mobile parity).
      const {
        calories: mealCalories,
        protein: mealProtein,
        carbs: mealCarbs,
        fat: mealFat,
        fiberG: mealFiberG,
        micros,
      } = foodSelectionToMealMacros(selection);

      const id = addLoggedMealForDate(
        selectedDateKey,
        {
          name: mealSlot,
          recipeTitle: selection.name,
          time: timeLabel,
          calories: mealCalories,
          protein: mealProtein,
          carbs: mealCarbs,
          fat: mealFat,
          source: sourceLabel,
          ...(mealFiberG > 0 ? { fiberG: mealFiberG } : {}),
          ...(Object.keys(micros).length > 0 ? { micros } : {}),
          ...mealImageFields(selection.imageUrl),
          ...(selection.eatenAt
            ? { eatenAt: selection.eatenAt }
            : eatenAtForCurrentLog()),
        },
        foodSelectionAnalyticsSource(selection.source),
      );
      return {
        id,
        title: selection.name,
        kcal: mealCalories,
        kcalIsVerified: selection.verified === true,
      };
    },
    [addLoggedMealForDate, mealSlot, timeLabel, eatenAtForCurrentLog, selectedDateKey],
  );

  const logHistoryItemFromSheet = useCallback(
    (item: FoodHistoryItem, slot: string) => {
      const micros: Record<string, number> = item.micros ? { ...item.micros } : {};
      if (item.caffeineMg != null && item.caffeineMg > 0) micros.caffeineMg = item.caffeineMg;
      if (item.alcoholG != null && item.alcoholG > 0) micros.alcoholG = item.alcoholG;
      const id = addLoggedMealForDate(
        selectedDateKey,
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
      presentLogSheetConfirmation({
        title: item.recipeTitle,
        kcal: item.calories,
        mealIds: [id],
        kcalIsVerified: false,
      });
    },
    [addLoggedMealForDate, presentLogSheetConfirmation, selectedDateKey],
  );

  return { commitFoodSearchSelection, logHistoryItemFromSheet };
}
