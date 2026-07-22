import { startTransition, useCallback } from "react";

import { track, isFeatureEnabled } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { newMealId, type ByDay, type JournalMeal } from "@/lib/nutritionJournal";
import {
  foodSelectionAnalyticsSource,
  foodSelectionToMealMacros,
} from "@suppr/nutrition-core/foodSelectionToMeal";
import {
  defaultEatenAtForNewLog,
  nutritionEntryDateKeyAndEatenAt,
} from "@suppr/nutrition-core/mealEatenAt";
import type { FoodHistoryItem } from "@suppr/nutrition-core/foodHistory";
import { useLogSessionTray } from "@suppr/shared/nutrition/useLogSessionTray";
import {
  committedToTrayItem,
  type CommittedLogItem,
  type LogSessionTrayItem,
} from "@suppr/shared/nutrition/logSessionTray";
import type { SelectedFood as FoodSearchSelectedFood } from "@/components/FoodSearchModal";
import type { LogSheetProps } from "@/components/today/LogSheet";

type LogSheetConfirmation = NonNullable<LogSheetProps["confirmation"]>;

type LogSheetConfirmationPayload = {
  title: string;
  kcal: number;
  mealIds: string[];
  /** ENG-1502 — per-item trust bit; absent = honest `~` (ENG-1417). */
  kcalIsVerified?: boolean;
};

export interface UseLogSheetCommitsArgs {
  activeMealSlot: string;
  dayKey: string;
  profileTimeZone: string | null;
  setByDay: React.Dispatch<React.SetStateAction<ByDay>>;
  persistMealsImmediate: (dayKey: string, meals: JournalMeal[]) => unknown;
  setLogSheetConfirmation: (payload: LogSheetConfirmation | null) => void;
  setFabSheetOpen: (open: boolean) => void;
  /** Existing per-row removal path (also used by the tray's per-item Undo). */
  deleteMeal: (mealId: string) => void;
  /** ENG-1643 — flag ON: participating adds append to the tray and keep the
   *  sheet open instead of presenting the S13 confirmation. */
  sessionTrayEnabled: boolean;
}

/**
 * ENG-1643 (extraction pass, screen-budget ratchet ENG-621/717) — the LogSheet
 * food-commit cluster lifted out of `TodayScreen.tsx` (a pinned only-shrink
 * screen-budget file). This mirrors web's ENG-1502 `useLogSheetFoodCommits`,
 * closing a noted platform-structure divergence, AND is the budget offset for
 * the tray wiring.
 *
 * Spec: `docs/specs/2026-07-21-log-session-tray.md`.
 *
 * Owns `commitLogSheetFoodSelection` / `logHistoryItemFromSheet` /
 * `presentLogSheetConfirmation` (byte-for-byte behaviour) PLUS the session-tray
 * state (via the shared pure `useLogSessionTray`). Under `sessionTrayEnabled`,
 * the participating add paths append the commit RESULT to the tray and keep the
 * sheet open; flag OFF is byte-identical to the pre-ENG-1643 S13 flow.
 */
export function useLogSheetCommits({
  activeMealSlot,
  dayKey,
  profileTimeZone,
  setByDay,
  persistMealsImmediate,
  setLogSheetConfirmation,
  setFabSheetOpen,
  deleteMeal,
  sessionTrayEnabled,
}: UseLogSheetCommitsArgs) {
  const tray = useLogSessionTray({ onRemoveItem: deleteMeal });
  const appendLogSessionTray = tray.append;

  const undoLogSessionTray = useCallback(
    (item: LogSessionTrayItem) => {
      try {
        track(AnalyticsEvents.log_session_tray_undo, { kcal: item.kcal });
      } catch {
        // noop
      }
      return tray.undo(item);
    },
    [tray],
  );

  const presentLogSheetConfirmation = useCallback(
    (payload: LogSheetConfirmationPayload) => {
      setLogSheetConfirmation({
        title: payload.title,
        kcal: Math.round(payload.kcal),
        ...(payload.kcalIsVerified !== undefined
          ? { kcalIsVerified: payload.kcalIsVerified }
          : {}),
        slot: activeMealSlot,
        onDone: () => {
          setLogSheetConfirmation(null);
          setFabSheetOpen(false);
        },
        onUndo: () => {
          for (const mealId of payload.mealIds) deleteMeal(mealId);
          setLogSheetConfirmation(null);
        },
      });
    },
    [activeMealSlot, deleteMeal, setLogSheetConfirmation, setFabSheetOpen],
  );

  const commitLogSheetFoodSelection = useCallback(
    (result: FoodSearchSelectedFood): CommittedLogItem => {
      const scaled = foodSelectionToMealMacros(result);
      const {
        calories: mealCalories,
        protein: mealProtein,
        carbs: mealCarbs,
        fat: mealFat,
        fiberG: mealFiberG,
        micros,
      } = scaled;
      const source =
        result.source === "CUSTOM"
          ? "custom_food"
          : result.source === "OFF"
            ? "Open Food Facts"
            : result.source === "Edamam"
              ? "Edamam"
              : result.source === "FatSecret"
                ? "FatSecret"
                : "USDA FoodData Central";
      const eatenAt =
        result.eatenAt ??
        (isFeatureEnabled("editable_eaten_at")
          ? defaultEatenAtForNewLog(dayKey, profileTimeZone)
          : undefined);
      const { dateKey: resolvedDateKey } = nutritionEntryDateKeyAndEatenAt(
        { eatenAt },
        dayKey,
        null,
        { timeZone: profileTimeZone },
      );
      const meal: JournalMeal = {
        id: newMealId(),
        name: activeMealSlot,
        recipeTitle: result.name,
        time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
        calories: mealCalories,
        protein: mealProtein,
        carbs: mealCarbs,
        fat: mealFat,
        source,
        ...(mealFiberG > 0 ? { fiberG: mealFiberG } : {}),
        ...(Object.keys(micros).length > 0 ? { micros } : {}),
        ...(result.imageUrl ? { recipeImageUrl: String(result.imageUrl).trim() } : {}),
        ...(eatenAt ? { eatenAt } : {}),
      };
      startTransition(() => {
        setByDay((prev) => ({
          ...prev,
          [resolvedDateKey]: [...(prev[resolvedDateKey] ?? []), meal],
        }));
      });
      void persistMealsImmediate(dayKey, [meal]);
      try {
        track(AnalyticsEvents.food_logged, {
          source: foodSelectionAnalyticsSource(result.source),
          calories: meal.calories,
          slot: activeMealSlot,
        });
      } catch {
        // noop
      }
      // ENG-1502 — the trust bit rides the selection from the search panel
      // (true only for verified-USDA / Suppr-generic rows); the confirmation
      // surface renders the unqualified kcal only when this is true.
      return {
        id: meal.id,
        title: result.name,
        kcal: mealCalories,
        protein: mealProtein,
        carbs: mealCarbs,
        fat: mealFat,
        slot: activeMealSlot,
        kcalIsVerified: result.verified === true,
      };
    },
    [activeMealSlot, dayKey, persistMealsImmediate, profileTimeZone, setByDay],
  );

  const logHistoryItemFromSheet = useCallback(
    (item: FoodHistoryItem) => {
      const micros: Record<string, number> = item.micros ? { ...item.micros } : {};
      if (item.caffeineMg != null && item.caffeineMg > 0) micros.caffeineMg = item.caffeineMg;
      if (item.alcoholG != null && item.alcoholG > 0) micros.alcoholG = item.alcoholG;
      const meal: JournalMeal = {
        id: newMealId(),
        name: activeMealSlot,
        recipeTitle: item.recipeTitle,
        ...(item.recipeId ? { recipeId: item.recipeId } : {}),
        time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        ...(item.fiber != null ? { fiberG: item.fiber } : {}),
        ...(item.source ? { source: item.source } : {}),
        ...(Object.keys(micros).length > 0 ? { micros } : {}),
        ...(isFeatureEnabled("editable_eaten_at")
          ? { eatenAt: defaultEatenAtForNewLog(dayKey, profileTimeZone) }
          : {}),
      };
      startTransition(() => {
        setByDay((prev) => ({
          ...prev,
          [dayKey]: [...(prev[dayKey] ?? []), meal],
        }));
      });
      // Commit confirm haptic fires once inside the funnel (ENG-1016).
      void persistMealsImmediate(dayKey, [meal]);
      try {
        track(AnalyticsEvents.food_logged, { source: "quick_add", slot: activeMealSlot });
      } catch {
        // noop
      }
      // ENG-1643 — flag ON appends to the tray (sheet stays open); OFF presents
      // S13. Either way trust is unknown (a history re-log copies a prior
      // journal row that doesn't persist the ENG-1417 bit) → honest `~`.
      if (sessionTrayEnabled) {
        appendLogSessionTray(
          committedToTrayItem({
            id: meal.id,
            title: item.recipeTitle,
            kcal: item.calories,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            slot: activeMealSlot,
            kcalIsVerified: false,
          }),
        );
        return;
      }
      presentLogSheetConfirmation({
        title: item.recipeTitle,
        kcal: item.calories,
        mealIds: [meal.id],
        kcalIsVerified: false,
      });
    },
    [
      activeMealSlot,
      dayKey,
      persistMealsImmediate,
      presentLogSheetConfirmation,
      profileTimeZone,
      sessionTrayEnabled,
      appendLogSessionTray,
      setByDay,
    ],
  );

  return {
    commitLogSheetFoodSelection,
    logHistoryItemFromSheet,
    presentLogSheetConfirmation,
    sessionTrayItems: tray.items,
    sessionTrayPendingUndoIds: tray.pendingUndoIds,
    appendLogSessionTray,
    undoLogSessionTray,
    resetLogSessionTray: tray.reset,
  };
}
