import { useCallback, useEffect, useState } from "react";

import { dateKeyFromDate } from "@/lib/nutritionJournal";
import { supabase } from "@/lib/supabase";
import type { LoggedMealCookRef, PlanJournalByDay } from "@suppr/shared/planning/planCookedMeals";

/**
 * Loads diary entries for the visible plan week so Plan v3 can mark cooked slots.
 * Minimal fields only — matches web `nutritionByDay` shape for cooked detection.
 */
export function usePlanWeekJournal(
  userId: string | null,
  weekDates: readonly Date[],
): PlanJournalByDay {
  const [byDay, setByDay] = useState<PlanJournalByDay>({});

  const load = useCallback(async () => {
    if (!userId || weekDates.length === 0) {
      setByDay({});
      return;
    }
    const keys = weekDates.map((d) => dateKeyFromDate(d));
    const { data, error } = await supabase
      .from("nutrition_entries")
      .select("date_key, recipe_id, recipe_title, name")
      .eq("user_id", userId)
      .in("date_key", keys);
    if (error || !data) return;
    const next: PlanJournalByDay = {};
    for (const row of data) {
      const key = String(row.date_key ?? "");
      if (!key) continue;
      const entry: LoggedMealCookRef = {
        recipeId: (row.recipe_id as string | null) ?? undefined,
        recipeTitle: (row.recipe_title as string | null) ?? undefined,
        name: (row.name as string | null) ?? undefined,
      };
      next[key] = [...(next[key] ?? []), entry];
    }
    setByDay(next);
  }, [userId, weekDates]);

  useEffect(() => {
    void load();
  }, [load]);

  return byDay;
}
