"use client";

import * as React from "react";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase/browserClient.ts";
import { track } from "../../../lib/analytics/track.ts";
import { AnalyticsEvents } from "../../../lib/analytics/events.ts";
import {
  createSavedMeal,
  incrementLogCount,
  listSavedMeals,
  type SavedMeal,
  type SavedMealItem,
} from "../../../lib/nutrition/savedMeals";
import { useFavoriteFoods } from "../../../lib/nutrition/useFavoriteFoods.ts";
import { useUsualMealHint } from "../../../lib/nutrition/useUsualMealHint.ts";
import { useMealLogging } from "../../../lib/nutrition/useMealLogging.ts";
import { scaleMicrosPerServing } from "../../../lib/nutrition/scaleMicrosPerServing";
import { isMealSlot, type MealSlot } from "../../../lib/nutrition/mealSlots";
import { normalizeJournalSlotName } from "../../../lib/nutrition/journalSlot.ts";
import { scaledMacro } from "../../../lib/nutrition/portionMultiplier.ts";
import {
  PENDING_USUAL_MEAL_SAVE_KEY,
  parsePendingUsualMealSave,
} from "../../../lib/nutrition/pendingUsualMealSave";
import type { LoggedMeal } from "../../../types/recipe.ts";
import type { FoodLoggedSource } from "../../../lib/analytics/events.ts";
import { SaveMealDialog } from "./save-meal-dialog";

export interface UseSavedMealsAndFavoritesArgs {
  authedUserId: string | null | undefined;
  mealSlot: string;
  selectedDateKey: string;
  nutritionByDay: Record<string, LoggedMeal[]>;
  mealsForSelectedDate: LoggedMeal[];
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
 * ENG-1360 (second extraction pass) — the saved-meals / favourites /
 * usual-meal-hint cluster: `logHistoryItem`, `logSavedMeal`, the save-combo
 * dialog state + `SaveMealDialog` render, the host-owned `hostSavedMeals` /
 * `hostFavorites` lists (+ optimistic favourite toggle), the usual-meal-hint
 * dismiss/shown-tracking state, and the pending-usual-meal-save deep-link
 * consumer. Byte-for-byte lift of the state/memos/effects/handlers that used
 * to live inline in NutritionTracker — same queries, same analytics, same
 * dependency arrays — just relocated so the host's local state list and JSX
 * both shrink. No behavior change.
 */
export function useSavedMealsAndFavorites({
  authedUserId,
  mealSlot,
  selectedDateKey,
  nutritionByDay,
  mealsForSelectedDate,
  addLoggedMeal,
  addLoggedMealForDate,
}: UseSavedMealsAndFavoritesArgs) {
  // ENG-1360 — the two base logging primitives (logHistoryItem,
  // logSavedMeal) moved to `useMealLogging` (split out to keep this file
  // under the 400-line screen budget). Same analytics, same dependency
  // arrays — just relocated.
  const { logHistoryItem, logSavedMeal } = useMealLogging({
    selectedDateKey,
    addLoggedMeal,
    addLoggedMealForDate,
  });

  // -- Save-usual-meal dialog (audit H4, 2026-04-18; Ship M1, 2026-04-18) --
  //
  // `SaveMealDialog` and its creation flow were lifted out of
  // `QuickAddPanel` so the host is the single owner of the dialog.
  // Replaces the prior save-combo CustomEvent bridge with a plain prop
  // callback (`onOpenSaveCombo`) + a refresh token the panel watches to
  // refetch `listSavedMeals`.
  //
  // Ship M1: the host also owns the full saved-meals list so the meal-slot
  // section can render the `Log usual: {name}` pill directly (no duplicate
  // fetch in `QuickAddPanel`).
  const [saveComboOpen, setSaveComboOpen] = React.useState(false);
  const [saveComboSeedItems, setSaveComboSeedItems] = React.useState<
    Array<Omit<SavedMealItem, "id" | "position">>
  >([]);
  const [saveComboDefaultSlot, setSaveComboDefaultSlot] = React.useState<
    "Breakfast" | "Lunch" | "Dinner" | "Snacks" | undefined
  >(undefined);
  const [saveComboSuggestedName, setSaveComboSuggestedName] = React.useState<string>("");
  const [savedMealsRefreshToken, setSavedMealsRefreshToken] = React.useState(0);

  // Ship M1 — saved meals shared between `TodayMealsSection` (for the
  // "Log usual" slot-header pill + full-width save row visibility) and
  // `QuickAddPanel` (for the Usual meals tab). Host is now the owner of
  // record so both surfaces read the same list.
  const [hostSavedMeals, setHostSavedMeals] = React.useState<SavedMeal[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    if (!authedUserId) {
      setHostSavedMeals([]);
      return;
    }
    listSavedMeals(supabase, authedUserId)
      .then((rows) => {
        if (!cancelled) setHostSavedMeals(rows);
      })
      .catch((err) => {

        console.warn("NutritionTracker listSavedMeals failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, [authedUserId, savedMealsRefreshToken]);

  // ENG-1360 — favourites-in-search cluster (hostFavorites, the load
  // effect, the optimistic toggle, the favourites-first key set) moved to
  // `useFavoriteFoods` (split out to keep this file under the 400-line
  // screen budget). Same behavior, same queries — just relocated.
  const { hostFavorites, favoritePendingKeys, toggleFoodFavorite, favoriteKeySetForRecent } =
    useFavoriteFoods(authedUserId);

  const savedMealSlots = React.useMemo(() => {
    const s = new Set<string>();
    for (const m of hostSavedMeals) {
      if (m.defaultMealSlot) s.add(m.defaultMealSlot);
    }
    return s;
  }, [hostSavedMeals]);

  // ENG-1360 — usual-meal first-run hint cluster (dismiss state, per-slot
  // visibility check, shown-tracking, dismiss handler) moved to
  // `useUsualMealHint` (split out to keep this file under the 400-line
  // screen budget). Same storage key, same analytics, same gating logic.
  const { hintVisibleForSlot, dismissUsualMealHint } = useUsualMealHint(
    nutritionByDay,
    selectedDateKey,
    savedMealSlots,
  );

  /** Open the save-combo dialog with pre-filled `seedItems` + optional
   * default `slot`. Wired to both the meal-slot header chip (directly)
   * and to the `QuickAddPanel` via the `onOpenSaveCombo` prop so the
   * panel can request the dialog without touching the global event bus. */
  const handleOpenSaveCombo = React.useCallback(
    (
      slot?: string,
      seedItems?: Array<Omit<SavedMealItem, "id" | "position">>,
    ) => {
      if (!authedUserId) {
        toast.info("Sign in to save a usual meal.");
        return;
      }
      const items = seedItems ?? [];
      if (items.length < 2) {
        toast.info("Log 2 or more items first, then save as a usual meal.");
        return;
      }
      setSaveComboSeedItems(items);
      // Canonical slot via shared guard (audit L5, 2026-04-18).
      const normalisedSlot: MealSlot | undefined = isMealSlot(slot) ? slot : undefined;
      setSaveComboDefaultSlot(normalisedSlot);
      setSaveComboSuggestedName(
        slot ? `My usual ${slot.toLowerCase()}` : `My usual ${mealSlot.toLowerCase()}`,
      );
      setSaveComboOpen(true);
    },
    [authedUserId, mealSlot],
  );

  /**
   * Post-ship #4 (2026-04-18) — consume the "save your usual" deep-link
   * the weekly-recap card stashed in sessionStorage. Fires once per
   * auth-session arrival on Today. Pops the stored payload, validates
   * the TTL inside `parsePendingUsualMealSave`, then opens
   * `SaveMealDialog` pre-seeded with the slot and items the helper
   * picked on Progress.
   *
   * The clear-unconditionally rule means a stale or malformed blob is
   * always cleared — we never want an old payload to re-fire on the
   * next mount.
   */
  const pendingUsualMealConsumedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!authedUserId) return;
    if (pendingUsualMealConsumedRef.current === authedUserId) return;
    if (typeof window === "undefined") return;
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(PENDING_USUAL_MEAL_SAVE_KEY);
    } catch {
      return;
    }
    pendingUsualMealConsumedRef.current = authedUserId;
    if (!raw) return;
    try {
      window.sessionStorage.removeItem(PENDING_USUAL_MEAL_SAVE_KEY);
    } catch {
      /* ignore — worst case the blob fires once then TTL-expires. */
    }
    const pending = parsePendingUsualMealSave(raw);
    if (!pending) return;
    handleOpenSaveCombo(pending.slot, pending.items);
  }, [authedUserId, handleOpenSaveCombo]);

  /** Gather the items in `slotName` from the active day and open the
   * save-as-usual-meal dialog. Called from the per-slot full-width save
   * row and from the first-run hint's "Save as usual" CTA (Ship M1). */
  const openSaveMealDialog = React.useCallback(
    (slotName: string) => {
      const slotMeals = mealsForSelectedDate.filter(
        (m) => normalizeJournalSlotName(m.name ?? "") === slotName,
      );
      if (slotMeals.length < 2) {
        toast.info("Log 2 or more items first, then save as a usual meal.");
        return;
      }
      const items: Array<Omit<SavedMealItem, "id" | "position">> = slotMeals.map((m) => {
        const pm = m.portionMultiplier ?? 1;
        const item: Omit<SavedMealItem, "id" | "position"> = {
          recipeTitle: m.recipeTitle,
          calories: scaledMacro(m.calories, pm),
          protein: scaledMacro(m.protein, pm),
          carbs: scaledMacro(m.carbs, pm),
          fat: scaledMacro(m.fat, pm),
          portionMultiplier: 1, // snapshot macros are already scaled
        };
        if (m.fiberG != null) item.fiber = m.fiberG;
        if (m.waterMl != null) item.waterMl = m.waterMl;
        if (m.source) item.source = m.source;
        if (m.micros && Object.keys(m.micros).length > 0) {
          const scaled = scaleMicrosPerServing(m.micros, pm);
          if (Object.keys(scaled).length > 0) item.nutritionMicros = scaled;
        }
        return item;
      });
      handleOpenSaveCombo(slotName, items);
    },
    [handleOpenSaveCombo, mealsForSelectedDate],
  );

  /** Ship M1 — the first-run hint's "Save as usual" CTA. Fires the
   * accepted-analytics event then opens the save-usual-meal dialog
   * pre-seeded with the current slot's items. */
  const acceptUsualMealHint = React.useCallback(
    (slot: string) => {
      try {
        track(AnalyticsEvents.usual_meal_hint_accepted, { slot });
      } catch {
        /* analytics fire-and-forget */
      }
      openSaveMealDialog(slot);
    },
    [openSaveMealDialog],
  );

  /** Ship M1 — slot-header "Log usual" pill handler. Logs the saved meal
   * into `slot` via the shared `logSavedMeal` helper, then optimistically
   * reorders `hostSavedMeals` so the re-logged one bubbles to the top
   * (matches the Quick Add panel's post-log ordering). */
  const logSavedMealFromSlotHeader = React.useCallback(
    (meal: SavedMeal, slot: string) => {
      logSavedMeal(meal, slot);
      try {
        track(AnalyticsEvents.usual_meal_log_tapped, {
          slot,
          itemCount: meal.items.length,
        });
      } catch {
        /* analytics fire-and-forget */
      }
      try {
        track(AnalyticsEvents.saved_meal_logged, {
          itemCount: meal.items.length,
          defaultMealSlot: meal.defaultMealSlot,
          // L6 G3 (2026-04-18) — join key for the create→logged funnel.
          savedMealId: meal.id,
        });
      } catch {
        /* analytics fire-and-forget */
      }
      setHostSavedMeals((prev) => {
        const next = prev.map((m) =>
          m.id === meal.id
            ? { ...m, logCount: m.logCount + 1, lastLoggedAt: new Date().toISOString() }
            : m,
        );
        next.sort((a, b) => {
          const ta = a.lastLoggedAt ? Date.parse(a.lastLoggedAt) : 0;
          const tb = b.lastLoggedAt ? Date.parse(b.lastLoggedAt) : 0;
          if (ta !== tb) return tb - ta;
          return Date.parse(b.createdAt) - Date.parse(a.createdAt);
        });
        return next;
      });
      if (authedUserId) {
        void incrementLogCount(supabase, authedUserId, meal.id).catch((err) => {

          console.warn("NutritionTracker slot-header usual-meal log bump failed", err);
        });
      }
      // Bump the refresh token so `QuickAddPanel` rereads its own list —
      // this keeps the Usual meals tab in sync after a slot-header log.
      setSavedMealsRefreshToken((n) => n + 1);
    },
    [authedUserId, logSavedMeal],
  );

  /** Persist a new saved-meal combo from the lifted `SaveMealDialog`,
   * then bump `savedMealsRefreshToken` so `QuickAddPanel` refetches its
   * "My meals" tab and jumps to it (preserves Batch 2.6 post-save UX). */
  const handleCreateSavedMeal = React.useCallback(
    async (payload: {
      name: string;
      defaultMealSlot?: "Breakfast" | "Lunch" | "Dinner" | "Snacks";
      items: Array<Omit<SavedMealItem, "id" | "position">>;
    }) => {
      if (!authedUserId) return;
      try {
        const created = await createSavedMeal(supabase, authedUserId, payload);
        try {
          track(AnalyticsEvents.saved_meal_created, {
            itemCount: payload.items.length,
            defaultMealSlot: payload.defaultMealSlot,
            // L6 G3 (2026-04-18) — carry the new combo's id so the
            // create → later-logged funnel (F3 habit loop) can join
            // on a single stable key.
            savedMealId: created.id,
          });
        } catch {
          /* analytics is fire-and-forget */
        }
        toast.success(`Saved "${payload.name}".`);
        setSavedMealsRefreshToken((n) => n + 1);
      } catch (err) {
        toast.error("Couldn't save that meal. Try again.");

        console.error("NutritionTracker saved-meal create failed", err);
      }
    },
    [authedUserId],
  );

  /** Audit H4 (2026-04-18) — Save-combo dialog lifted out of QuickAddPanel
   *  so the host is the single owner. Opened via `handleOpenSaveCombo` (the
   *  meal-slot chip + the panel's `onOpenSaveCombo` prop both fire it). */
  const dialog = (
    <SaveMealDialog
      open={saveComboOpen}
      onOpenChange={setSaveComboOpen}
      initialItems={saveComboSeedItems}
      defaultSlot={saveComboDefaultSlot}
      onSave={handleCreateSavedMeal}
      suggestedName={saveComboSuggestedName}
    />
  );

  return {
    dialog,
    logHistoryItem,
    logSavedMeal,
    hostSavedMeals,
    hostFavorites,
    favoritePendingKeys,
    toggleFoodFavorite,
    favoriteKeySetForRecent,
    savedMealsRefreshToken,
    handleOpenSaveCombo,
    openSaveMealDialog,
    acceptUsualMealHint,
    logSavedMealFromSlotHeader,
    hintVisibleForSlot,
    dismissUsualMealHint,
  };
}
