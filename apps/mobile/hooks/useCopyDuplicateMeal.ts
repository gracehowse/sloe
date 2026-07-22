import { useCallback } from "react";

import { supabase } from "@/lib/supabase";
import { track, isFeatureEnabled } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { newMealId, type ByDay, type JournalMeal } from "@/lib/nutritionJournal";
import { buildNutritionEntryRow } from "@/lib/nutritionEntryRow";
import { reanchorMealEatenAt } from "@suppr/nutrition-core/mealEatenAt";
import { refreshAdaptiveTdeeForUser } from "@/lib/refreshAdaptiveTdee";
import { snapshotDailyTargetIfMissing } from "@suppr/nutrition-core/dailyTargetSnapshot";
import { ENERGY_NUMBERS_V1_FLAG } from "@suppr/nutrition-core/energyNumbers";
import { writeMealToHealthKitIfEnabled } from "@/lib/healthKitMealWriter";
import { captureException } from "@/lib/errorTracking";
import { cloneMealWithoutId, sanitizeCopyTargets, sanitizeCopySlotTargets } from "@suppr/nutrition-core/copyMeals";
import type { useJournalWriteAhead } from "@/hooks/useJournalWriteAhead";

type WriteAhead = ReturnType<typeof useJournalWriteAhead>["writeAhead"];

/** Clones `meal`, renaming it onto `targetSlot` when the caller passed one
 *  and it actually differs from the meal's own slot (`name`) — the slot
 *  field IS the clone target, so a same-slot copy must not "override" it
 *  into a no-op string compare. Module-level: pure function of its
 *  arguments, no hook state to close over. */
function cloneForSlot(meal: JournalMeal, targetSlot?: string): Omit<JournalMeal, "id"> {
  const cloned = cloneMealWithoutId(meal) as Omit<JournalMeal, "id">;
  if (targetSlot && targetSlot !== meal.name) return { ...cloned, name: targetSlot };
  return cloned;
}

/**
 * Batch 1.4 "copy meal" / "duplicate day" — extracted from `TodayScreen.tsx`
 * (a pinned only-shrink screen-budget file, `scripts/screen-line-budget.json`)
 * so ENG-1522's honest-persistence fix didn't grow it past its pin.
 *
 * ENG-1522 — every copy/duplicate path here reports whether the write
 * actually PERSISTED (not just "queued locally"), so `TodayScreen.tsx` can
 * show an honest success/pending message instead of a premature blanket
 * "Copied"/"Duplicated" alert fired before the write even started. Rows
 * stay optimistically visible either way (the write-ahead queue keeps
 * retrying in the background — reverting them would resurrect the ENG-1447
 * "relaunch silently loses a committed log" bug).
 */
export function useCopyDuplicateMeal(args: {
  byDay: ByDay;
  setByDay: React.Dispatch<React.SetStateAction<ByDay>>;
  userId: string | undefined;
  profileTimeZone: string | null;
  writeAhead: WriteAhead;
  confirmLogHapticRef: React.MutableRefObject<() => void>;
}) {
  const { byDay, setByDay, userId, profileTimeZone, writeAhead, confirmLogHapticRef } = args;

  /**
   * Shared insert primitive. Optimistically adds rows to
   * `byDay[targetDayKey]`, then routes the durable write through the same
   * `writeAhead` helper every log-commit path uses. `rows` are clones from
   * `cloneMealWithoutId` (no id yet); a fresh `newMealId()` is minted per
   * row. ENG-1447 — the confirm haptic fires from `writeAhead`'s
   * `onEnqueued` (once durably queued), not right after the optimistic
   * `setByDay`.
   */
  const insertClonedRowsIntoDay = useCallback(
    async (
      targetDayKey: string,
      clones: Omit<JournalMeal, "id">[],
      opts?: { suppressFailureAlert?: boolean },
    ): Promise<{ count: number; persisted: boolean; ids: string[] }> => {
      if (clones.length === 0) return { count: 0, persisted: true, ids: [] };
      // Re-anchor each clone's `eatenAt` onto the TARGET day before it
      // reaches memory/DB — `buildNutritionEntryRow` derives `date_key`
      // from `eaten_at`, so skipping this buckets the copy back onto the
      // source day (launch-audit 2026-06-12 copy-path fix).
      const withIds: JournalMeal[] = clones.map((c) =>
        reanchorMealEatenAt(
          { ...c, id: newMealId() } as JournalMeal,
          targetDayKey,
          { timeZone: profileTimeZone },
        ),
      );
      setByDay((prev) => ({
        ...prev,
        [targetDayKey]: [...(prev[targetDayKey] ?? []), ...withIds],
      }));
      const ids = withIds.map((m) => m.id);
      if (!userId) return { count: withIds.length, persisted: true, ids };
      // Single shared row shape (launch-audit P1-2) — builder guarantees
      // eaten_at/date_key + recipe_id FK propagation (Schema refactor P2).
      const dbRows = withIds.map((m) =>
        buildNutritionEntryRow(m, targetDayKey, userId, profileTimeZone),
      );
      // onConflict: "id" (via writeAhead's upsert) — copy/duplicate is a
      // log commit like any other; a retried write-ahead flush of the same
      // ids must never duplicate-key.
      const { persisted } = await writeAhead(targetDayKey, dbRows, {
        onEnqueued: () => confirmLogHapticRef.current(),
        suppressFailureAlert: opts?.suppressFailureAlert,
      });
      if (!persisted) return { count: withIds.length, persisted: false, ids };
      void refreshAdaptiveTdeeForUser(supabase, userId);
      // F-2 — snapshot today's target regardless of `targetDayKey`.
      void snapshotDailyTargetIfMissing(supabase, userId, { canonicalEnergyInputs: isFeatureEnabled(ENERGY_NUMBERS_V1_FLAG) });
      // Tracking-extras (2026-05-02) / F-74 F-103: micros carry via
      // cloneMealWithoutId, chip totals re-sum from byDay — no ledger bump.
      // Audit 2026-04-30 — per-meal HK write; fresh ids avoid dedupe
      // suppression (same idempotency as the debounce path).
      for (const m of withIds) {
        void writeMealToHealthKitIfEnabled({
          mealId: m.id,
          userId,
          name: m.recipeTitle || m.name,
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
          fiberG: m.fiberG ?? null,
          date: new Date().toISOString(),
          source: m.source ?? null,
          origin: "duplicate",
        });
      }
      return { count: withIds.length, persisted: true, ids };
    },
    [profileTimeZone, userId, writeAhead, setByDay, confirmLogHapticRef],
  );

  const copyMealToDate = useCallback(
    async (
      sourceDayKey: string,
      mealId: string,
      targetDayKey: string,
      targetSlot?: string,
    ): Promise<boolean> => {
      if (!sourceDayKey || !mealId || !targetDayKey) return false;
      if (sourceDayKey === targetDayKey) return false;
      const meal = (byDay[sourceDayKey] ?? []).find((m) => m.id === mealId);
      if (!meal) return false;
      const cloned = cloneForSlot(meal, targetSlot);
      const { persisted } = await insertClonedRowsIntoDay(targetDayKey, [cloned]);
      try { track(AnalyticsEvents.meal_copied, { source: "copy_meal", batchSize: 1, targetDayCount: 1 }); } catch { /* noop */ }
      return persisted;
    },
    [byDay, insertClonedRowsIntoDay],
  );

  const copyMealToDateRange = useCallback(
    async (
      sourceDayKey: string,
      mealId: string,
      targetDayKeys: string[],
      targetSlot?: string,
    ): Promise<{ succeeded: string[]; failed: string[] }> => {
      if (!sourceDayKey || !mealId) return { succeeded: [], failed: [] };
      const meal = (byDay[sourceDayKey] ?? []).find((m) => m.id === mealId);
      if (!meal) return { succeeded: [], failed: [] };
      const clean = sanitizeCopySlotTargets(sourceDayKey, meal.name, targetSlot ?? meal.name, targetDayKeys);
      if (clean.length === 0) return { succeeded: [], failed: [] };
      let totalInserted = 0;
      const succeeded: string[] = [];
      const failed: string[] = [];
      for (const t of clean) {
        const cloned = cloneForSlot(meal, targetSlot);
        // Suppress the per-day writeAhead alert — see copyDuplicateBatchAlert.
        const { count, persisted } = await insertClonedRowsIntoDay(t, [cloned], { suppressFailureAlert: true });
        totalInserted += count;
        (persisted ? succeeded : failed).push(t);
      }
      try {
        track(AnalyticsEvents.meal_copied, { source: "copy_meal", batchSize: 1, targetDayCount: clean.length });
      } catch { /* noop */ }
      // Audit M3 (2026-04-18): fire ONE batched food_logged event for the
      // whole copy-range, not N events.
      if (totalInserted > 0) {
        try {
          track(AnalyticsEvents.food_logged, {
            count: totalInserted,
            batched: true,
            source: "copy_meal",
          });
        } catch { /* noop */ }
      }
      return { succeeded, failed };
    },
    [byDay, insertClonedRowsIntoDay],
  );

  /**
   * ENG-786 rebuild (2026-07-21) — "Copy to another day" replaces the old
   * instant same-slot-same-day "Log again" (`logAgainSlot`, deleted:
   * silently doubled a whole slot's calories with no confirmation, no
   * undo, and stamped clones with the CURRENT wall-clock time even when
   * the viewed day was in the past). Copies every entry currently in
   * `sourceSlot` on `sourceDayKey` to each of `targetDayKeys`, optionally
   * renaming the slot on the way (`targetSlot`). `cloneForSlot` preserves
   * each source entry's own `time` (never re-stamped to "now") — the same
   * guarantee the single-item copy path already had via
   * `cloneMealWithoutId`'s default (no `time` override).
   *
   * Returns `createdIdsByDay` (every id minted, keyed by the target day it
   * landed on) so the host can offer a real Undo via `undoCopyToSlot` even
   * when the multi-day quick-range wrote to several days the user isn't
   * currently viewing.
   */
  const copySlotToDateRange = useCallback(
    async (
      sourceDayKey: string,
      sourceSlot: string,
      targetSlot: string,
      targetDayKeys: string[],
    ): Promise<{
      succeeded: string[];
      failed: string[];
      itemCount: number;
      createdIdsByDay: Record<string, string[]>;
    }> => {
      const empty = { succeeded: [], failed: [], itemCount: 0, createdIdsByDay: {} };
      if (!sourceDayKey || !sourceSlot) return empty;
      const sourceMeals = (byDay[sourceDayKey] ?? []).filter((m) => (m.name || "Other") === sourceSlot);
      if (sourceMeals.length === 0) return empty;
      const clean = sanitizeCopySlotTargets(sourceDayKey, sourceSlot, targetSlot, targetDayKeys);
      if (clean.length === 0) return empty;
      let totalInserted = 0;
      const succeeded: string[] = [];
      const failed: string[] = [];
      const createdIdsByDay: Record<string, string[]> = {};
      for (const t of clean) {
        const clones = sourceMeals.map((m) => cloneForSlot(m, targetSlot));
        // Suppress the per-day writeAhead alert — see copyDuplicateBatchAlert.
        const { count, persisted, ids } = await insertClonedRowsIntoDay(t, clones, { suppressFailureAlert: true });
        totalInserted += count;
        if (ids.length > 0) createdIdsByDay[t] = ids;
        (persisted ? succeeded : failed).push(t);
      }
      try {
        track(AnalyticsEvents.meal_copied, {
          source: "copy_slot",
          batchSize: sourceMeals.length,
          targetDayCount: clean.length,
        });
      } catch { /* noop */ }
      if (totalInserted > 0) {
        try {
          track(AnalyticsEvents.food_logged, {
            count: totalInserted,
            batched: true,
            source: "copy_slot",
          });
        } catch { /* noop */ }
      }
      return { succeeded, failed, itemCount: sourceMeals.length, createdIdsByDay };
    },
    [byDay, insertClonedRowsIntoDay],
  );

  /**
   * Undo for `copySlotToDateRange` — removes exactly the rows it created,
   * per target day, both from local `byDay` state and Supabase. Deliberately
   * simpler than the primary swipe-delete path (`TodayScreen.tsx`'s
   * `deleteMeal`): it skips that path's Apple Health tombstone handling,
   * because these are same-session, just-created copy clones — undoing
   * within the ~5s toast window on a copy of an `apple_health`-sourced
   * entry is a narrow edge where, at worst, a later HK sync could re-import
   * the (already-undone) clone. Acceptable for a first cut; not a silent
   * gap since it's documented here.
   */
  const undoCopyToSlot = useCallback(
    (createdIdsByDay: Record<string, string[]>) => {
      const allIds = Object.values(createdIdsByDay).flat();
      if (allIds.length === 0) return;
      setByDay((prev) => {
        const next = { ...prev };
        for (const [day, ids] of Object.entries(createdIdsByDay)) {
          const idSet = new Set(ids);
          next[day] = (next[day] ?? []).filter((m) => !idSet.has(m.id));
        }
        return next;
      });
      if (!userId) return;
      void supabase
        .from("nutrition_entries")
        .delete()
        .in("id", allIds)
        .then(({ error }) => {
          if (error) captureException(error);
        });
    },
    [userId, setByDay],
  );

  const duplicateDay = useCallback(
    async (sourceDayKey: string, targetDayKey: string): Promise<boolean> => {
      if (!sourceDayKey || !targetDayKey) return false;
      if (sourceDayKey === targetDayKey) return false;
      const src = byDay[sourceDayKey] ?? [];
      if (src.length === 0) return false;
      const clones = src.map((m) => cloneMealWithoutId(m) as Omit<JournalMeal, "id">);
      const { count: inserted, persisted } = await insertClonedRowsIntoDay(targetDayKey, clones);
      try {
        track(AnalyticsEvents.day_duplicated, { source: "duplicate_day", batchSize: src.length, targetDayCount: 1 });
      } catch { /* noop */ }
      // Audit M3 (2026-04-18): single batched food_logged per duplicate.
      if (inserted > 0) {
        try {
          track(AnalyticsEvents.food_logged, {
            count: inserted,
            batched: true,
            source: "duplicate_day",
          });
        } catch { /* noop */ }
      }
      return persisted;
    },
    [byDay, insertClonedRowsIntoDay],
  );

  const duplicateDayToDateRange = useCallback(
    async (
      sourceDayKey: string,
      targetDayKeys: string[],
    ): Promise<{ succeeded: string[]; failed: string[] }> => {
      if (!sourceDayKey) return { succeeded: [], failed: [] };
      const clean = sanitizeCopyTargets(sourceDayKey, targetDayKeys);
      if (clean.length === 0) return { succeeded: [], failed: [] };
      const src = byDay[sourceDayKey] ?? [];
      if (src.length === 0) return { succeeded: [], failed: [] };
      let totalInserted = 0;
      const succeeded: string[] = [];
      const failed: string[] = [];
      for (const t of clean) {
        const clones = src.map((m) => cloneMealWithoutId(m) as Omit<JournalMeal, "id">);
        // Suppress the per-day writeAhead alert — see copyDuplicateBatchAlert.
        const { count, persisted } = await insertClonedRowsIntoDay(t, clones, { suppressFailureAlert: true });
        totalInserted += count;
        (persisted ? succeeded : failed).push(t);
      }
      try {
        track(AnalyticsEvents.day_duplicated, { source: "duplicate_day", batchSize: src.length, targetDayCount: clean.length });
      } catch { /* noop */ }
      // Audit M3 (2026-04-18): ONE batched food_logged for the 7-day range,
      // not N events per inserted row.
      if (totalInserted > 0) {
        try {
          track(AnalyticsEvents.food_logged, {
            count: totalInserted,
            batched: true,
            source: "duplicate_day",
          });
        } catch { /* noop */ }
      }
      return { succeeded, failed };
    },
    [byDay, insertClonedRowsIntoDay],
  );

  return { copyMealToDate, copyMealToDateRange, copySlotToDateRange, undoCopyToSlot, duplicateDay, duplicateDayToDateRange };
}
