import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "./supabase";
import { hasUserMealPlanJsonRow } from "../../../src/lib/supabase/phase1LegacyJsonb";

/**
 * Plan + journal signals for the Discover first-run checklist. Save count comes from `useSavedRecipes().savedIds.size`.
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

    const [{ data: planDays }, legacyJsonPlan, { data: entries }] = await Promise.all([
      supabase.from("meal_plan_days").select("id").eq("user_id", userId).limit(1),
      hasUserMealPlanJsonRow(supabase, userId),
      supabase.from("nutrition_entries").select("id").eq("user_id", userId).limit(1),
    ]);

    const planExists = (planDays?.length ?? 0) > 0 || legacyJsonPlan;
    setHasPlan(planExists);
    setHasLoggedMeal((entries?.length ?? 0) > 0);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { hasPlan, hasLoggedMeal, refresh };
}
