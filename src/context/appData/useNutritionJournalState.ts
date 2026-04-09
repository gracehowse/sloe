import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase/browserClient.ts";
import type { LoggedMeal } from "../../types/recipe.ts";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { track } from "../../lib/analytics/track.ts";
import { looksLikeMissingTableError, syncDisabledBecauseSchemaMessage, syncFailedRetryMessage } from "./supabaseErrors.ts";
import { newId } from "./persistence.ts";
import { useRetryEnableDbTable } from "./useRetryEnableDbTable.ts";

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
    const { error } = await supabase.from("nutrition_journals").select("user_id").limit(1);
    if (error) {
      return false;
    }
    setDbNutritionEnabled(true);
    return true;
  }, [authedUserId]);

  useRetryEnableDbTable(authedUserId, dbNutritionEnabled, tryEnableDbNutrition);

  useEffect(() => {
    if (!authedUserId) return;
    let cancelled = false;
    (async () => {
      if (!dbNutritionEnabled) return;
      const { data, error } = await supabase
        .from("nutrition_journals")
        .select("by_day")
        .eq("user_id", authedUserId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        if (looksLikeMissingTableError(error.message ?? "")) {
          setDbNutritionEnabled(false);
          if (!dbNutritionWarned) {
            setDbNutritionWarned(true);
            toast.warning(syncDisabledBecauseSchemaMessage("Nutrition log"));
          }
        }
        return;
      }
      if (data?.by_day && typeof data.by_day === "object") {
        setNutritionByDay(data.by_day as Record<string, LoggedMeal[]>);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedUserId, dbNutritionEnabled, dbNutritionWarned]);

  useEffect(() => {
    if (!authedUserId || !dbNutritionEnabled) return;
    const t = setTimeout(() => {
      supabase
        .from("nutrition_journals")
        .upsert(
          { user_id: authedUserId, updated_at: new Date().toISOString(), by_day: nutritionByDay },
          { onConflict: "user_id" },
        )
        .then(({ error }) => {
          if (error) {
            const msg = error.message ?? "";
            if (looksLikeMissingTableError(msg)) {
              setDbNutritionEnabled(false);
              if (!dbNutritionWarned) {
                setDbNutritionWarned(true);
                toast.warning(syncDisabledBecauseSchemaMessage("Nutrition log"));
              }
              return;
            }
            if (msg.toLowerCase().includes("violates foreign key constraint")) {
              toast.error(
                "Nutrition log couldn’t sync—your account session may be out of date. Sign out and sign back in. Today’s entries are still on this device.",
              );
              return;
            }
            toast.error(syncFailedRetryMessage("nutrition log", msg));
          }
        });
    }, 600);
    return () => clearTimeout(t);
  }, [authedUserId, dbNutritionEnabled, dbNutritionWarned, nutritionByDay]);

  const addLoggedMealForDate = useCallback((dayKey: string, meal: Omit<LoggedMeal, "id">) => {
    const id = newId("meal");
    setNutritionByDay((prev) => {
      const day = prev[dayKey] ?? [];
      return { ...prev, [dayKey]: [...day, { ...meal, id }] };
    });
    track(AnalyticsEvents.food_logged, {
      calories: meal.calories,
      fromPlanner: meal.time === "Planned",
    });
  }, []);

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
    },
    [selectedDateKey],
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
