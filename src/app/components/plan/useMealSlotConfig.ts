import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase/browserClient";
import {
  DEFAULT_USER_MEAL_SLOT_CONFIG,
  enabledMealSlotLabels,
  parseUserMealSlotConfig,
  type UserMealSlotConfig,
} from "@/lib/nutrition/userMealSlotConfig";

/**
 * ENG-1177 — load the user's meal-slot preset (`profiles.meal_slot_config`) for
 * the web Plan tab, mirroring the column Today reads in NutritionTracker.
 *
 * Returns the parsed config plus `numberedPresetSlots`: the full configured slot
 * list ("Meal 1" … "Meal N") when the user runs a numbered preset
 * (four_meals / six_meals), else `null`. The MealPlanner threads
 * `numberedPresetSlots` into `generateMealPlan({ slots })` so the extra slots of
 * a 5-/6-meal day get a real calorie share instead of being starved to 0 kcal.
 * For the classic preset it returns `null`, leaving the per-slot `enabledSlots`
 * toggle (web's lowercase-slot contract) in charge.
 */
export function useMealSlotConfig(authedUserId: string | null): {
  userMealSlotConfig: UserMealSlotConfig;
  numberedPresetSlots: string[] | null;
} {
  const [userMealSlotConfig, setUserMealSlotConfig] = useState<UserMealSlotConfig>(
    DEFAULT_USER_MEAL_SLOT_CONFIG,
  );

  useEffect(() => {
    if (!authedUserId) {
      setUserMealSlotConfig(DEFAULT_USER_MEAL_SLOT_CONFIG);
      return;
    }
    let cancelled = false;
    void supabase
      .from("profiles")
      .select("meal_slot_config")
      .eq("id", authedUserId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setUserMealSlotConfig(
          parseUserMealSlotConfig(
            (data as { meal_slot_config?: unknown } | null)?.meal_slot_config,
          ),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [authedUserId]);

  const numberedPresetSlots = useMemo<string[] | null>(
    () =>
      userMealSlotConfig.preset === "classic"
        ? null
        : [...enabledMealSlotLabels(userMealSlotConfig)],
    [userMealSlotConfig],
  );

  return { userMealSlotConfig, numberedPresetSlots };
}
