import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase/browserClient.ts";
import type { LoggedMeal } from "../../types/recipe.ts";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { track } from "../../lib/analytics/track.ts";
import { looksLikeMissingTableError, syncDisabledBecauseSchemaMessage, syncFailedRetryMessage } from "./supabaseErrors.ts";
import {
  fetchNutritionJournalByDay,
  probeAnyNutritionJournalJsonTable,
} from "../../lib/supabase/phase1LegacyJsonb.ts";
import { newId } from "./persistence.ts";
import { useRetryEnableDbTable } from "./useRetryEnableDbTable.ts";
import { refreshAdaptiveTdeeForUser } from "../../lib/nutrition/refreshAdaptiveTdee.ts";
import { cloneMealWithoutId, sanitizeCopyTargets } from "../../lib/nutrition/copyMeals.ts";

type NutritionEntryRow = {
  id: string;
  date_key: string;
  name: string;
  recipe_title: string;
  time_label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber_g: number | null;
  water_ml: number | null;
  portion_multiplier: number | null;
  source: string | null;
  nutrition_micros?: Record<string, unknown> | null;
};

function parseRowMicros(raw: Record<string, unknown> | null | undefined): Record<string, number> | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n) && n !== 0) out[k] = n;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function rowToLoggedMeal(row: NutritionEntryRow): LoggedMeal {
  const src = row.source;
  const micros = parseRowMicros(row.nutrition_micros);
  return {
    id: row.id,
    name: row.name,
    recipeTitle: row.recipe_title,
    time: row.time_label,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    fiberG: row.fiber_g ?? undefined,
    waterMl: row.water_ml ?? undefined,
    portionMultiplier: row.portion_multiplier ?? undefined,
    ...(micros ? { micros } : {}),
    ...(typeof src === "string" && src.trim() !== "" ? { source: src.trim() } : {}),
  };
}

export function useNutritionJournalState(opts: {
  authedUserId: string | null;
  initialByDay: Record<string, LoggedMeal[]>;
  selectedDateKey: string;
}) {
  const { authedUserId, initialByDay, selectedDateKey } = opts;
  const [nutritionByDay, setNutritionByDay] = useState<Record<string, LoggedMeal[]>>(() => initialByDay);
  const [dbNutritionEnabled, setDbNutritionEnabled] = useState(true);
  const [dbNutritionWarned, setDbNutritionWarned] = useState(false);

  const tryEnableDbNutrition = useCallback(async () => {
    if (!authedUserId) return false;
    const { error } = await supabase.from("nutrition_entries").select("id").limit(1);
    if (error) {
      if (looksLikeMissingTableError(error.message ?? "")) {
        const legacyOk = await probeAnyNutritionJournalJsonTable(supabase);
        if (legacyOk) {
          setDbNutritionEnabled(true);
          return true;
        }
      }
      return false;
    }
    setDbNutritionEnabled(true);
    return true;
  }, [authedUserId]);

  useRetryEnableDbTable(authedUserId, dbNutritionEnabled, tryEnableDbNutrition);

  // Load from DB on mount
  useEffect(() => {
    if (!authedUserId) return;
    let cancelled = false;
    (async () => {
      if (!dbNutritionEnabled) return;

      // Try new relational table first
      const { data, error } = await supabase
        .from("nutrition_entries")
        .select("id, date_key, name, recipe_title, time_label, calories, protein, carbs, fat, fiber_g, water_ml, portion_multiplier, source, nutrition_micros")
        .eq("user_id", authedUserId)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (error) {
        if (looksLikeMissingTableError(error.message ?? "")) {
          const byDay = await fetchNutritionJournalByDay(supabase, authedUserId);
          if (!cancelled && byDay) {
            setNutritionByDay(byDay as Record<string, LoggedMeal[]>);
          }
          return;
        }
        if (!dbNutritionWarned) {
          setDbNutritionWarned(true);
          toast.warning(syncDisabledBecauseSchemaMessage("Nutrition log"));
        }
        return;
      }

      if (data && data.length > 0) {
        const byDay: Record<string, LoggedMeal[]> = {};
        for (const row of data as NutritionEntryRow[]) {
          const key = row.date_key;
          if (!byDay[key]) byDay[key] = [];
          byDay[key].push(rowToLoggedMeal(row));
        }
        setNutritionByDay(byDay);
      }
    })();
    return () => { cancelled = true; };
  }, [authedUserId, dbNutritionEnabled, dbNutritionWarned]);

  const addLoggedMealForDate = useCallback((dayKey: string, meal: Omit<LoggedMeal, "id">) => {
    const id = newId("meal");
    const newMeal = { ...meal, id };
    setNutritionByDay((prev) => {
      const day = prev[dayKey] ?? [];
      return { ...prev, [dayKey]: [...day, newMeal] };
    });

    // Persist to relational table
    if (authedUserId && dbNutritionEnabled) {
      supabase
        .from("nutrition_entries")
        .insert({
          id,
          user_id: authedUserId,
          date_key: dayKey,
          name: meal.name,
          recipe_title: meal.recipeTitle,
          time_label: meal.time,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fat: meal.fat,
          fiber_g: meal.fiberG ?? null,
          water_ml: meal.waterMl ?? null,
          portion_multiplier: meal.portionMultiplier ?? 1,
          nutrition_micros: meal.micros && Object.keys(meal.micros).length > 0 ? meal.micros : {},
          source: meal.source ?? null,
        })
        .then(({ error }) => {
          if (error) {
            const msg = error.message ?? "";
            if (looksLikeMissingTableError(msg)) {
              setDbNutritionEnabled(false);
              return;
            }
            toast.error(syncFailedRetryMessage("nutrition log", msg));
            return;
          }
          void refreshAdaptiveTdeeForUser(supabase, authedUserId);
        });
    }

    track(AnalyticsEvents.food_logged, {
      calories: meal.calories,
      fromPlanner: meal.time === "Planned",
    });
  }, [authedUserId, dbNutritionEnabled]);

  const addLoggedMeal = useCallback(
    (meal: Omit<LoggedMeal, "id">) => {
      addLoggedMealForDate(selectedDateKey, meal);
    },
    [addLoggedMealForDate, selectedDateKey],
  );

  const removeLoggedMeal = useCallback(
    (mealId: string) => {
      setNutritionByDay((prev) => ({
        ...prev,
        [selectedDateKey]: (prev[selectedDateKey] ?? []).filter((m) => m.id !== mealId),
      }));

      // Delete from relational table
      if (authedUserId && dbNutritionEnabled) {
        supabase.from("nutrition_entries").delete().eq("id", mealId).then(({ error }) => {
          if (error && !looksLikeMissingTableError(error.message ?? "")) {
            toast.error(syncFailedRetryMessage("nutrition log", error.message ?? ""));
            return;
          }
          if (!error) void refreshAdaptiveTdeeForUser(supabase, authedUserId);
        });
      }
    },
    [selectedDateKey, authedUserId, dbNutritionEnabled],
  );

  const mealsForSelectedDate = useMemo(() => {
    return nutritionByDay[selectedDateKey] ?? [];
  }, [nutritionByDay, selectedDateKey]);

  /**
   * Copy a single logged meal from `sourceDayKey` to `targetDayKey`.
   * Uses the same `addLoggedMealForDate` insert path as manual logging,
   * so the row persists to `nutrition_entries` with a fresh id.
   */
  const copyMealToDate = useCallback(
    async (sourceDayKey: string, mealId: string, targetDayKey: string): Promise<void> => {
      if (!sourceDayKey || !mealId || !targetDayKey) return;
      if (sourceDayKey === targetDayKey) return;
      const sourceDay = nutritionByDay[sourceDayKey] ?? [];
      const meal = sourceDay.find((m) => m.id === mealId);
      if (!meal) return;
      const cloned = cloneMealWithoutId(meal) as Omit<LoggedMeal, "id">;
      addLoggedMealForDate(targetDayKey, cloned);
      track(AnalyticsEvents.meal_copied, {
        source: "copy_meal",
        batchSize: 1,
        targetDayCount: 1,
      });
    },
    [nutritionByDay, addLoggedMealForDate],
  );

  /**
   * Copy a single logged meal to many target days. The source day is
   * excluded and duplicates are dropped, both via `sanitizeCopyTargets`.
   * Fires exactly one `meal_copied` analytics event covering the batch.
   */
  const copyMealToDateRange = useCallback(
    async (sourceDayKey: string, mealId: string, targetDayKeys: string[]): Promise<void> => {
      if (!sourceDayKey || !mealId) return;
      const cleanTargets = sanitizeCopyTargets(sourceDayKey, targetDayKeys);
      if (cleanTargets.length === 0) return;
      const sourceDay = nutritionByDay[sourceDayKey] ?? [];
      const meal = sourceDay.find((m) => m.id === mealId);
      if (!meal) return;
      for (const target of cleanTargets) {
        const cloned = cloneMealWithoutId(meal) as Omit<LoggedMeal, "id">;
        addLoggedMealForDate(target, cloned);
      }
      track(AnalyticsEvents.meal_copied, {
        source: "copy_meal",
        batchSize: 1,
        targetDayCount: cleanTargets.length,
      });
    },
    [nutritionByDay, addLoggedMealForDate],
  );

  /**
   * Duplicate every meal from `sourceDayKey` into `targetDayKey`.
   * No-op when the source day has no meals, or when source === target.
   */
  const duplicateDay = useCallback(
    async (sourceDayKey: string, targetDayKey: string): Promise<void> => {
      if (!sourceDayKey || !targetDayKey) return;
      if (sourceDayKey === targetDayKey) return;
      const sourceDay = nutritionByDay[sourceDayKey] ?? [];
      if (sourceDay.length === 0) return;
      for (const meal of sourceDay) {
        const cloned = cloneMealWithoutId(meal) as Omit<LoggedMeal, "id">;
        addLoggedMealForDate(targetDayKey, cloned);
      }
      track(AnalyticsEvents.day_duplicated, {
        source: "duplicate_day",
        batchSize: sourceDay.length,
        targetDayCount: 1,
      });
    },
    [nutritionByDay, addLoggedMealForDate],
  );

  /**
   * Duplicate every meal from `sourceDayKey` into each target day.
   * Uses `sanitizeCopyTargets` to drop the source day and dedupe.
   */
  const duplicateDayToDateRange = useCallback(
    async (sourceDayKey: string, targetDayKeys: string[]): Promise<void> => {
      if (!sourceDayKey) return;
      const cleanTargets = sanitizeCopyTargets(sourceDayKey, targetDayKeys);
      if (cleanTargets.length === 0) return;
      const sourceDay = nutritionByDay[sourceDayKey] ?? [];
      if (sourceDay.length === 0) return;
      for (const target of cleanTargets) {
        for (const meal of sourceDay) {
          const cloned = cloneMealWithoutId(meal) as Omit<LoggedMeal, "id">;
          addLoggedMealForDate(target, cloned);
        }
      }
      track(AnalyticsEvents.day_duplicated, {
        source: "duplicate_day",
        batchSize: sourceDay.length,
        targetDayCount: cleanTargets.length,
      });
    },
    [nutritionByDay, addLoggedMealForDate],
  );

  return {
    nutritionByDay,
    addLoggedMealForDate,
    addLoggedMeal,
    removeLoggedMeal,
    mealsForSelectedDate,
    copyMealToDate,
    copyMealToDateRange,
    duplicateDay,
    duplicateDayToDateRange,
  };
}
