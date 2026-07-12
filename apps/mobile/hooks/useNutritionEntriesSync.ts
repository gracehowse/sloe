import { useEffect, useRef } from "react";

import { supabase } from "@/lib/supabase";
import { dateKeyFromDate, type JournalMeal } from "@/lib/nutritionJournal";
import {
  buildNutritionEntryRow,
  NUTRITION_ENTRY_UUID_RE as UUID_RE,
} from "@/lib/nutritionEntryRow";
import { writeMealToHealthKitIfEnabled } from "@/lib/healthKitMealWriter";
import { isFeatureEnabled } from "@/lib/analytics";
import { snapshotDailyTargetIfMissing } from "@suppr/nutrition-core/dailyTargetSnapshot";
import { ENERGY_NUMBERS_V1_FLAG } from "@suppr/nutrition-core/energyNumbers";

/**
 * 2026-05-16 — Today extract #3.
 *
 * Owns the per-day debounced sync of in-memory journal meals to the
 * canonical `nutrition_entries` relational table. Triggers two
 * downstream side-effects on a successful sync:
 *   1. First-log-of-day target snapshot (`snapshotDailyTargetIfMissing`)
 *      — freezes today's target on first log so later edits to
 *      activity_level / plan_pace / goal don't retroactively shift
 *      historical days. Insert is `on conflict do nothing`, cheap no-op
 *      on repeat calls.
 *   2. Per-meal Apple HealthKit write (`writeMealToHealthKitIfEnabled`)
 *      — idempotent on meal.id so re-renders don't double-count.
 *      Only fires for the selected day's meals; past-day backfills go
 *      through their own insert path.
 *
 * ## Debounce contract
 *
 * 600ms delay before the sync fires. Returning a cleanup that clears
 * the timeout means a fast sequence of `byDay` mutations (e.g. the
 * user logging two meals in quick succession from the LogSheet)
 * collapses to one Supabase round-trip.
 *
 * ## Guards
 *
 * - No userId or not yet hydrated → skip silently (parent owns
 *   hydration semantics).
 * - Empty meals for the selected day → skip (no rows to insert).
 *
 * ## Failure mode
 *
 * Supabase upsert error is logged via `console.error` but doesn't
 * throw. None of the downstream side-effects fire on error. The next
 * `byDay` mutation will retry naturally.
 */
export function useNutritionEntriesSync(args: {
  userId: string | null | undefined;
  hydrated: boolean;
  byDay: Record<string, JournalMeal[]>;
  selectedDate: Date;
}): void {
  const { userId, hydrated, byDay, selectedDate } = args;
  /** Meal ids already handed to HealthKit on this day — skip re-writes on
   *  every debounced upsert so logging one item doesn't queue N bridge calls. */
  const healthKitWrittenIdsRef = useRef<{ dayKey: string; ids: Set<string> }>({
    dayKey: "",
    ids: new Set(),
  });

  useEffect(() => {
    if (!userId || !hydrated) return;
    const t = setTimeout(() => {
      const dk = dateKeyFromDate(selectedDate);
      const todayMeals = byDay[dk] ?? [];
      if (healthKitWrittenIdsRef.current.dayKey !== dk) {
        healthKitWrittenIdsRef.current = { dayKey: dk, ids: new Set() };
      }
      if (todayMeals.length > 0) {
        // ENG (launch-audit P1-2) — route the backstop through the SAME
        // row-builder the immediate-persist paths use. Pre-fix this inline
        // map omitted `eaten_at` and hard-coded `date_key` to the selected
        // day, so a heterogeneous batch (or any future cross-day edit) could
        // NULL a real consumption time or reset day-attribution. The builder
        // derives `eaten_at` (preserved verbatim, or null) + an eaten-derived
        // `date_key` (falling back to the selected day `dk` when null) and
        // guarantees a uniform column set across every meal in the batch.
        const rows = todayMeals.map((m) => buildNutritionEntryRow(m, dk, userId));
        void supabase
          .from("nutrition_entries")
          .upsert(rows, { onConflict: "id" })
          .then(({ error }) => {
            if (error) {
              console.error("[tracker] sync failed:", error.message);
              return;
            }
            // F-2 (2026-04-19) — freeze today's target on first log of
            // the day. Past days stop moving when the user later edits
            // activity_level / plan_pace / goal. Fire-and-forget — the
            // insert has `on conflict do nothing` so repeat calls are
            // cheap no-ops.
            void snapshotDailyTargetIfMissing(supabase, userId, { canonicalEnergyInputs: isFeatureEnabled(ENERGY_NUMBERS_V1_FLAG) });
            // Audit/2026-04-30 — per-meal Apple HealthKit write
            // (parity with MFP / Cal AI). The debounced upsert covers
            // every entry-point that mutates `byDay` (LogSheet barcode
            // confirm, FoodSearch, manual add, copy-meal, plan-meal
            // log). Idempotent on `meal.id`, so re-renders / multi-
            // upserts don't double-count. Only fires for the
            // selected day's meals — past-day backfills go through
            // their own insert path which calls
            // `writeMealToHealthKitIfEnabled` directly.
            for (const m of todayMeals) {
              const mealId = UUID_RE.test(m.id) ? m.id : "";
              if (!mealId || healthKitWrittenIdsRef.current.ids.has(mealId)) {
                continue;
              }
              healthKitWrittenIdsRef.current.ids.add(mealId);
              void writeMealToHealthKitIfEnabled({
                mealId,
                userId,
                name: m.recipeTitle || m.name,
                calories: m.calories,
                protein: m.protein,
                carbs: m.carbs,
                fat: m.fat,
                fiberG: m.fiberG ?? null,
                date: m.createdAt ?? undefined,
                source: m.source ?? null,
                origin: "journal-sync",
              });
            }
          });
      }
    }, 600);
    return () => clearTimeout(t);
  }, [userId, hydrated, byDay, selectedDate]);
}
