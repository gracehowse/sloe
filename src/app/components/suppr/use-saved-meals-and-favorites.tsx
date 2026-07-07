"use client";

import * as React from "react";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase/browserClient.ts";
import { track } from "../../../lib/analytics/track.ts";
import { AnalyticsEvents } from "../../../lib/analytics/events.ts";
import { buildMealEntriesFromSavedMeal } from "../../../lib/nutrition/savedMealsLogic";
import {
  createSavedMeal,
  incrementLogCount,
  listSavedMeals,
  type SavedMeal,
  type SavedMealItem,
} from "../../../lib/nutrition/savedMeals";
import {
  addFavorite,
  favoriteKey as favoriteFoodKey,
  listFavorites,
  removeFavorite,
  type FavoriteFood,
} from "../../../lib/nutrition/favoriteFoods";
import { scaleMicrosPerServing } from "../../../lib/nutrition/scaleMicrosPerServing";
import { isMealSlot, type MealSlot } from "../../../lib/nutrition/mealSlots";
import { normalizeJournalSlotName } from "../../../lib/nutrition/journalSlot.ts";
import { scaledMacro } from "../../../lib/nutrition/portionMultiplier.ts";
import {
  parseDismissedSlots,
  serializeDismissedSlots,
  shouldShowUsualMealHint,
  USUAL_MEAL_HINT_STORAGE_KEY,
} from "../../../lib/nutrition/usualMealHint";
import {
  PENDING_USUAL_MEAL_SAVE_KEY,
  parsePendingUsualMealSave,
} from "../../../lib/nutrition/pendingUsualMealSave";
import type { FoodHistoryItem } from "../../../lib/nutrition/foodHistory";
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
  /** Log a history row (Favourite / Frequent / Recent) into the active
   * meal slot. Shared by the QuickAddPanel history rows so the event
   * shape is consistent. */
  const logHistoryItem = React.useCallback(
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
  const logSavedMeal = React.useCallback(
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

  /** Favourites-in-search (teardown #1, ENG-1041) — the user's starred foods,
   *  loaded once and threaded into the LogSheet's inline FoodSearchPanel so
   *  favourites surface IN search (a "Favourites" group above "Past logged"
   *  + favourites-first in the empty-query Recent strip + a per-row star
   *  toggle). The same `user_favorite_foods` model QuickAddPanel uses; the
   *  host owns the list here because the LogSheet is a host-owned surface.
   *  Mobile parity: `apps/mobile/app/(tabs)/index.tsx`. */
  const [hostFavorites, setHostFavorites] = React.useState<FavoriteFood[]>([]);
  const [favoritePendingKeys, setFavoritePendingKeys] = React.useState<Set<string>>(
    () => new Set(),
  );
  React.useEffect(() => {
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
  const toggleFoodFavorite = React.useCallback(
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
  const favoriteKeySetForRecent = React.useMemo(
    () =>
      new Set(hostFavorites.map((f) => favoriteFoodKey(f.recipeTitle, f.calories))),
    [hostFavorites],
  );

  // Ship M1 — usual-meal first-run hint dismiss state. Persisted under a
  // versioned key; hydrated once on mount and rehydrated when a different
  // tab writes to localStorage.
  const [usualMealHintDismissed, setUsualMealHintDismissed] = React.useState<Set<string>>(
    () => new Set<string>(),
  );
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(USUAL_MEAL_HINT_STORAGE_KEY);
      setUsualMealHintDismissed(parseDismissedSlots(raw));
    } catch {
      /* storage access can throw in private modes — ignore */
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === USUAL_MEAL_HINT_STORAGE_KEY) {
        setUsualMealHintDismissed(parseDismissedSlots(e.newValue));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const savedMealSlots = React.useMemo(() => {
    const s = new Set<string>();
    for (const m of hostSavedMeals) {
      if (m.defaultMealSlot) s.add(m.defaultMealSlot);
    }
    return s;
  }, [hostSavedMeals]);

  const usualMealHintShownRef = React.useRef<Set<string>>(new Set());
  const hintVisibleForSlot = React.useCallback(
    (slot: string) => {
      if (!isMealSlot(slot)) return false;
      return shouldShowUsualMealHint({
        byDay: nutritionByDay,
        slot,
        todayKey: selectedDateKey,
        dismissedSlots: usualMealHintDismissed,
        savedMealSlots,
      });
    },
    [nutritionByDay, selectedDateKey, usualMealHintDismissed, savedMealSlots],
  );
  // Fire `usual_meal_hint_shown` once per (slot) per mount when it first
  // passes the gate. `useEffect` runs after render so the impression
  // matches what the user actually saw.
  React.useEffect(() => {
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

  const dismissUsualMealHint = React.useCallback(
    (slot: string) => {
      if (!isMealSlot(slot)) return;
      setUsualMealHintDismissed((prev) => {
        const next = new Set(prev);
        next.add(slot);
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(
              USUAL_MEAL_HINT_STORAGE_KEY,
              serializeDismissedSlots(next),
            );
          } catch {
            /* ignore storage failures */
          }
        }
        return next;
      });
      try {
        track(AnalyticsEvents.usual_meal_hint_dismissed, { slot });
      } catch {
        /* analytics fire-and-forget */
      }
    },
    [],
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
