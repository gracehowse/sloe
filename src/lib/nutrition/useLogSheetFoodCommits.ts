"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import {
  foodSelectionAnalyticsSource,
  foodSelectionSourceLabel,
  foodSelectionToMealMacros,
  type FoodSelectionLike,
} from "./foodSelectionToMeal.ts";
import { mealImageFields } from "./foodHistory.ts";
import type { FoodHistoryItem } from "./foodHistory.ts";
import type { LoggedMeal } from "../../types/recipe.ts";
import type { SavedMealItem } from "./savedMeals.ts";
import { track } from "../analytics/track.ts";
import { AnalyticsEvents, type FoodLoggedSource } from "../analytics/events.ts";
import { useLogSessionTray } from "./useLogSessionTray.ts";
import {
  committedToTrayItem,
  sessionTrayToSavedMealItems,
  sessionTrayTotals,
  type CommittedLogItem,
  type LogSessionTrayItem,
  type LogSessionTrayProps,
} from "./logSessionTray.ts";
import type { LogSheetProps } from "../../app/components/suppr/log-sheet.tsx";

type LogSheetConfirmationState = NonNullable<LogSheetProps["confirmation"]>;

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
  /** S13 confirmation state setter (host-owned). */
  setLogSheetConfirmation: Dispatch<SetStateAction<LogSheetConfirmationState | null>>;
  /** Closes the sheet (Done, and the S13 onDone). */
  setLogSheetOpen: Dispatch<SetStateAction<boolean>>;
  /** Existing removal path — the S13 Undo and the tray's per-item Undo. */
  removeLoggedMeal: (mealId: string) => void;
  /** ENG-1643 — flag ON: participating adds append to the tray and keep the
   *  sheet open instead of presenting the S13 confirmation. */
  sessionTrayEnabled: boolean;
  /** Opens the seeded save-as-usual-meal flow with the tray's items (§4.6). */
  onOpenSaveMeal: (items: Omit<SavedMealItem, "id" | "position">[]) => void;
}

/**
 * ENG-1502/1643 (extraction pass, screen-budget ratchet ENG-621/717) — the
 * LogSheet food-commit cluster + the S13 presentation + the session-tray state,
 * lifted out of `NutritionTracker.tsx`. The exact parity mirror of mobile
 * `apps/mobile/app/(tabs)/_today/useLogSheetCommits.ts`.
 *
 * Spec: `docs/specs/2026-07-21-log-session-tray.md`.
 *
 * - `commitFoodSearchSelection` — canonical food-search selection commit. Used
 *   by both the `<FoodSearch>` dialog and the inline `<FoodSearchPanel>`. Returns
 *   the committed row id + macros + the ENG-1502 `kcalIsVerified` trust bit.
 * - `logHistoryItemFromSheet` — re-log of a prior journal row (go-tos / Recent).
 *   Trust is unknown (journal rows don't persist the ENG-1417 bit) → honest `~`.
 * - Flag ON: both participating paths append the commit RESULT to the tray and
 *   keep the sheet open; flag OFF presents the honest S13 confirmation.
 */
export function useLogSheetFoodCommits({
  selectedDateKey,
  mealSlot,
  timeLabel,
  addLoggedMealForDate,
  eatenAtForCurrentLog,
  setLogSheetConfirmation,
  setLogSheetOpen,
  removeLoggedMeal,
  sessionTrayEnabled,
  onOpenSaveMeal,
}: UseLogSheetFoodCommitsArgs) {
  const tray = useLogSessionTray({ onRemoveItem: removeLoggedMeal });
  const appendLogSessionTray = tray.append;

  const undoLogSessionTray = useCallback(
    (item: LogSessionTrayItem) => {
      try {
        track(AnalyticsEvents.log_session_tray_undo, { kcal: item.kcal });
      } catch {
        /* analytics fire-and-forget */
      }
      return tray.undo(item);
    },
    [tray],
  );

  const presentLogSheetConfirmation = useCallback(
    (payload: {
      title: string;
      kcal: number;
      mealIds: string[];
      /** ENG-1502 — per-item trust bit; absent = honest `~` (ENG-1417). */
      kcalIsVerified?: boolean;
    }) => {
      setLogSheetConfirmation({
        title: payload.title,
        kcal: Math.round(payload.kcal),
        ...(payload.kcalIsVerified !== undefined
          ? { kcalIsVerified: payload.kcalIsVerified }
          : {}),
        slot: mealSlot,
        onDone: () => {
          setLogSheetConfirmation(null);
          setLogSheetOpen(false);
        },
        onUndo: () => {
          for (const mealId of payload.mealIds) removeLoggedMeal(mealId);
          setLogSheetConfirmation(null);
        },
      });
    },
    [mealSlot, removeLoggedMeal, setLogSheetConfirmation, setLogSheetOpen],
  );

  const commitFoodSearchSelection = useCallback(
    (selection: LogSheetFoodSelection): CommittedLogItem => {
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
        protein: mealProtein,
        carbs: mealCarbs,
        fat: mealFat,
        slot: mealSlot,
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
      // ENG-1643 — flag ON appends to the tray (sheet stays open); OFF presents
      // S13. Trust is unknown either way (a history re-log copies a prior
      // journal row that doesn't persist the ENG-1417 bit) → honest `~`.
      if (sessionTrayEnabled) {
        appendLogSessionTray(
          committedToTrayItem({
            id,
            title: item.recipeTitle,
            kcal: item.calories,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            slot,
            kcalIsVerified: false,
          }),
        );
        return;
      }
      presentLogSheetConfirmation({
        title: item.recipeTitle,
        kcal: item.calories,
        mealIds: [id],
        kcalIsVerified: false,
      });
    },
    [
      addLoggedMealForDate,
      presentLogSheetConfirmation,
      selectedDateKey,
      sessionTrayEnabled,
      appendLogSessionTray,
    ],
  );

  const sessionTrayProp: LogSessionTrayProps | undefined = sessionTrayEnabled
    ? {
        items: tray.items,
        pendingUndoIds: tray.pendingUndoIds,
        onUndo: undoLogSessionTray,
        onDone: () => {
          try {
            track(AnalyticsEvents.log_session_tray_done, {
              items: tray.items.length,
              kcal: sessionTrayTotals(tray.items).kcal,
            });
          } catch {
            /* analytics fire-and-forget */
          }
          setLogSheetOpen(false);
        },
        onSaveMeal: () => {
          try {
            track(AnalyticsEvents.log_session_tray_save_meal_opened, {
              items: tray.items.length,
            });
          } catch {
            /* analytics fire-and-forget */
          }
          onOpenSaveMeal(sessionTrayToSavedMealItems(tray.items));
        },
      }
    : undefined;

  return {
    commitFoodSearchSelection,
    logHistoryItemFromSheet,
    presentLogSheetConfirmation,
    appendLogSessionTray,
    resetLogSessionTray: tray.reset,
    sessionTrayProp,
  };
}
