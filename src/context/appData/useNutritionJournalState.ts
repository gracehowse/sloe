import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase/browserClient.ts";
import type { LoggedMeal } from "../../types/recipe.ts";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { track } from "../../lib/analytics/track.ts";
import { looksLikeMissingTableError, syncDisabledBecauseSchemaMessage, syncFailedRetryMessage } from "./supabaseErrors.ts";
import { newId } from "./persistence.ts";
import { useRetryEnableDbTable } from "./useRetryEnableDbTable.ts";

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
};

function rowToLoggedMeal(row: NutritionEntryRow): LoggedMeal {
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
      // Fall back to legacy table
      const { error: legacyError } = await supabase.from("nutrition_journals").select("user_id").limit(1);
      if (!legacyError) {
        setDbNutritionEnabled(true);
        return true;
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
        .select("id, date_key, name, recipe_title, time_label, calories, protein, carbs, fat, fiber_g, water_ml, portion_multiplier")
        .eq("user_id", authedUserId)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (error) {
        if (looksLikeMissingTableError(error.message ?? "")) {
          // Fall back to legacy JSONB table
          const { data: legacyData, error: legacyError } = await supabase
            .from("nutrition_journals")
            .select("by_day")
            .eq("user_id", authedUserId)
            .maybeSingle();
          if (!cancelled && !legacyError && legacyData?.by_day && typeof legacyData.by_day === "object") {
            setNutritionByDay(legacyData.by_day as Record<string, LoggedMeal[]>);
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
        })
        .then(({ error }) => {
          if (error) {
            const msg = error.message ?? "";
            if (looksLikeMissingTableError(msg)) {
              setDbNutritionEnabled(false);
              return;
            }
            toast.error(syncFailedRetryMessage("nutrition log", msg));
          }
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
          }
        });
      }
    },
    [selectedDateKey, authedUserId, dbNutritionEnabled],
  );

  const mealsForSelectedDate = useMemo(() => {
    return nutritionByDay[selectedDateKey] ?? [];
  }, [nutritionByDay, selectedDateKey]);

  return {
    nutritionByDay,
    addLoggedMealForDate,
    addLoggedMeal,
    removeLoggedMeal,
    mealsForSelectedDate,
  };
}
