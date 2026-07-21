import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import { resolveTargets } from "@/lib/calcTargets";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";

export type PlanImportNutritionTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

/**
 * ENG-1601 — real per-user targets for plan-import's auto-rebalance,
 * resolved the same way planner.tsx does (explicit DB target → computed
 * from body stats → app defaults). Never a fabricated flat number:
 * starts at NUTRITION_DEFAULTS (the sanctioned, documented fallback
 * every other mobile screen uses while data is loading) and is replaced
 * by the real resolved values once the profile fetch below completes.
 *
 * Extracted out of plan-import.tsx (ENG-1601 hotfix) to keep the screen
 * under its pinned line budget — this is a pure data-fetch concern with
 * a single consumer, matching the useTodayFasting/usePlannerTemplates
 * extraction convention.
 */
export function usePlanImportNutritionTargets(userId: string | null): PlanImportNutritionTargets {
  const [nutritionTargets, setNutritionTargets] = useState<PlanImportNutritionTargets>({
    calories: NUTRITION_DEFAULTS.calories,
    protein: NUTRITION_DEFAULTS.protein,
    carbs: NUTRITION_DEFAULTS.carbs,
    fat: NUTRITION_DEFAULTS.fat,
    fiber: NUTRITION_DEFAULTS.fiber,
  });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select(
        "target_calories, target_protein, target_carbs, target_fat, target_fiber_g, weight_kg, height_cm, sex, activity_level, goal, dob, age, plan_pace",
      )
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const d = data as Record<string, unknown>;
        const t = resolveTargets(
          {
            target_calories: d.target_calories as number | null,
            target_protein: d.target_protein as number | null,
            target_carbs: d.target_carbs as number | null,
            target_fat: d.target_fat as number | null,
            target_fiber_g: d.target_fiber_g as number | null,
          },
          {
            weight_kg: d.weight_kg as number | null,
            height_cm: d.height_cm as number | null,
            sex: d.sex as string | null,
            activity_level: d.activity_level as string | null,
            goal: d.goal as string | null,
            dob: d.dob as string | null,
            age: d.age as number | null,
            plan_pace: d.plan_pace as string | null,
          },
        );
        setNutritionTargets({
          calories: t.calories,
          protein: t.protein,
          carbs: t.carbs,
          fat: t.fat,
          fiber: t.fiber,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return nutritionTargets;
}
