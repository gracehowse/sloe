import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "./supabase";

/**
 * Plan + journal signals for the Discover first-run checklist. Save count comes from `useSavedRecipes().savedIds.size`.
 *
 * Schema refactor Phase 3 (2026-05-11) — legacy `meal_plans` JSONB
 * probe removed (table dropped 2026-04-21). meal_plan_days is the
 * only source of truth for "has a plan".
 */
export function useChecklistSignals(userId: string | null) {
  const [hasPlan, setHasPlan] = useState(false);
  const [hasLoggedMeal, setHasLoggedMeal] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setHasPlan(false);
      setHasLoggedMeal(false);
      return;
    }

    const [{ data: planDays }, { data: entries }] = await Promise.all([
      supabase.from("meal_plan_days").select("id").eq("user_id", userId).limit(1),
      supabase.from("nutrition_entries").select("id").eq("user_id", userId).limit(1),
    ]);

    setHasPlan((planDays?.length ?? 0) > 0);
    setHasLoggedMeal((entries?.length ?? 0) > 0);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { hasPlan, hasLoggedMeal, refresh };
}
