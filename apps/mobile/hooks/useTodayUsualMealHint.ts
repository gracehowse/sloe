import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { dateKeyFromDate, type ByDay } from "@/lib/nutritionJournal";
import { isMealSlot } from "@suppr/nutrition-core/mealSlots";
import {
  parseDismissedSlots,
  serializeDismissedSlots,
  shouldShowUsualMealHint,
  USUAL_MEAL_HINT_STORAGE_KEY,
} from "@suppr/nutrition-core/usualMealHint";
import type { SavedMeal } from "@suppr/nutrition-core/savedMeals";

type UseTodayUsualMealHintParams = {
  byDay: ByDay;
  selectedDate: Date;
  hostSavedMeals: SavedMeal[];
};

export type UseTodayUsualMealHintResult = {
  /** Slots that already have >=1 saved meal with a matching default slot —
   *  exposed read-only in case a future caller needs the raw set (the
   *  slot-header "Log usual" pill computation in TodayScreen reads
   *  `hostSavedMeals` directly instead). */
  savedMealSlots: Set<string>;
  hintVisibleForSlot: (slot: string) => boolean;
  dismissUsualMealHint: (slot: string) => void;
};

/**
 * ENG-1361 — Today extract (round 2, real domain hook, not a re-export
 * shim). Owns the "usual meal hint" first-run nudge (Ship M1): the
 * dismissed-slots set (hydrated from/persisted to AsyncStorage), the
 * `savedMealSlots` derivation, the visibility gate per slot, and the
 * once-per-slot `usual_meal_hint_shown` analytics fire.
 *
 * ## Why a hook
 *
 * The dismissed-slots state, its AsyncStorage hydrate/persist, the
 * `savedMealSlots` memo, and the shown/dismissed analytics only need
 * `byDay`, `selectedDate`, and `hostSavedMeals` as external inputs — no
 * other Today state reads the internals, only the two exported
 * functions cross the boundary.
 *
 * ## What stays in TodayScreen
 *
 * `acceptUsualMealHint` (the hint's "Save as usual" CTA) stays in
 * TodayScreen because it delegates to `openSaveMealSheetForSlot`, which
 * is owned by the save-meal-sheet state cluster — pulling that apart is
 * a separate, larger extraction outside this pass's scope.
 *
 * ## Failure modes
 *
 * - AsyncStorage read/write fails → dismissed-slots hydration/persist
 *   silently no-ops, matching pre-extraction behaviour (worst case a
 *   dismissed hint resurfaces once more).
 * - `slot` is not a canonical meal slot → `hintVisibleForSlot` returns
 *   `false` and `dismissUsualMealHint` no-ops rather than persisting a
 *   junk key.
 */
export function useTodayUsualMealHint({
  byDay,
  selectedDate,
  hostSavedMeals,
}: UseTodayUsualMealHintParams): UseTodayUsualMealHintResult {
  /** Ship M1 — usual-meal first-run hint dismiss state. Persisted via
   *  AsyncStorage under a versioned key. Hydrated once on mount. */
  const [usualMealHintDismissed, setUsualMealHintDismissed] = useState<Set<string>>(
    () => new Set<string>(),
  );
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(USUAL_MEAL_HINT_STORAGE_KEY)
      .then((raw) => {
        if (!cancelled) setUsualMealHintDismissed(parseDismissedSlots(raw));
      })
      .catch(() => {
        /* ignore storage failures */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const savedMealSlots = useMemo(() => {
    const s = new Set<string>();
    for (const m of hostSavedMeals) {
      if (m.defaultMealSlot) s.add(m.defaultMealSlot);
    }
    return s;
  }, [hostSavedMeals]);

  const usualMealHintShownRef = useRef<Set<string>>(new Set());
  const hintVisibleForSlot = useCallback(
    (slot: string) => {
      if (!isMealSlot(slot)) return false;
      const currentDayKey = dateKeyFromDate(selectedDate);
      return shouldShowUsualMealHint({
        byDay,
        slot,
        todayKey: currentDayKey,
        dismissedSlots: usualMealHintDismissed,
        savedMealSlots,
      });
    },
    [byDay, selectedDate, usualMealHintDismissed, savedMealSlots],
  );
  useEffect(() => {
    for (const slot of ["Breakfast", "Lunch", "Dinner", "Snacks"] as const) {
      if (hintVisibleForSlot(slot) && !usualMealHintShownRef.current.has(slot)) {
        usualMealHintShownRef.current.add(slot);
        try {
          track(AnalyticsEvents.usual_meal_hint_shown, { slot });
        } catch {
          /* analytics fire-and-forget */
        }
      }
    }
  }, [hintVisibleForSlot]);

  const dismissUsualMealHint = useCallback((slot: string) => {
    if (!isMealSlot(slot)) return;
    setUsualMealHintDismissed((prev) => {
      const next = new Set(prev);
      next.add(slot);
      void AsyncStorage.setItem(
        USUAL_MEAL_HINT_STORAGE_KEY,
        serializeDismissedSlots(next),
      ).catch(() => {
        /* ignore storage failures */
      });
      return next;
    });
    try {
      track(AnalyticsEvents.usual_meal_hint_dismissed, { slot });
    } catch {
      /* analytics fire-and-forget */
    }
  }, []);

  return {
    savedMealSlots,
    hintVisibleForSlot,
    dismissUsualMealHint,
  };
}
