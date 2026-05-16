import { useEffect } from "react";

import { supabase } from "@/lib/supabase";
import { dateKeyFromDate, newMealId, type JournalMeal } from "@/lib/nutritionJournal";
import { refreshAdaptiveTdeeForUser } from "@/lib/refreshAdaptiveTdee";
import { writeMealToHealthKitIfEnabled } from "@/lib/healthKitMealWriter";
import { snapshotDailyTargetIfMissing } from "../../../src/lib/nutrition/dailyTargetSnapshot";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 2026-05-16 — Today extract #3.
 *
 * Owns the per-day debounced sync of in-memory journal meals to the
 * canonical `nutrition_entries` relational table. Triggers two
 * downstream side-effects on a successful sync:
 *   1. Adaptive-TDEE refresh (`refreshAdaptiveTdeeForUser`) — the
 *      adaptive TDEE engine reads from `nutrition_entries`, so the
 *      sync is what unblocks it.
 *   2. First-log-of-day target snapshot (`snapshotDailyTargetIfMissing`)
 *      — freezes today's target on first log so later edits to
 *      activity_level / plan_pace / goal don't retroactively shift
 *      historical days. Insert is `on conflict do nothing`, cheap no-op
 *      on repeat calls.
 *   3. Per-meal Apple HealthKit write (`writeMealToHealthKitIfEnabled`)
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

  useEffect(() => {
    if (!userId || !hydrated) return;
    const t = setTimeout(() => {
      const dk = dateKeyFromDate(selectedDate);
      const todayMeals = byDay[dk] ?? [];
      if (todayMeals.length > 0) {
        const rows = todayMeals.map((m) => ({
          id: UUID_RE.test(m.id) ? m.id : newMealId(),
          user_id: userId,
          date_key: dk,
          name: m.name,
          recipe_title: m.recipeTitle,
          time_label: m.time,
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
          fiber_g: m.fiberG ?? null,
          water_ml: m.waterMl ?? null,
          portion_multiplier: m.portionMultiplier ?? 1,
          nutrition_micros: m.micros && Object.keys(m.micros).length > 0 ? m.micros : {},
          source: m.source ?? null,
        }));
        void supabase
          .from("nutrition_entries")
          .upsert(rows, { onConflict: "id" })
          .then(({ error }) => {
            if (error) {
              console.error("[tracker] sync failed:", error.message);
              return;
            }
            void refreshAdaptiveTdeeForUser(supabase, userId);
            // F-2 (2026-04-19) — freeze today's target on first log of
            // the day. Past days stop moving when the user later edits
            // activity_level / plan_pace / goal. Fire-and-forget — the
            // insert has `on conflict do nothing` so repeat calls are
            // cheap no-ops.
            void snapshotDailyTargetIfMissing(supabase, userId);
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
              void writeMealToHealthKitIfEnabled({
                mealId: UUID_RE.test(m.id) ? m.id : "",
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
