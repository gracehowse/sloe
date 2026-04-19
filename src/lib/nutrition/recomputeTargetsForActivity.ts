/**
 * Recompute macro + calorie targets when the user changes a single
 * profile input from Settings (e.g. `activity_level`). One shared
 * helper so web and mobile apply the exact same math the onboarding
 * save path uses — no duplicated pipeline, no silent drift.
 *
 * Shipped 2026-04-19 for build 10 fix E-2 (activity-level self-edit in
 * Settings). Closes TestFlight `AIIm60n` + `AHCSYMATS` — tester couldn't
 * change her stored `activity_level = "moderate"` so her Maintenance
 * number stayed stuck at 1,900 (`moderate` multiplier 1.55) when her
 * actual basics imply ~1,600 (`sedentary` multiplier 1.2).
 *
 * Pipeline exactly mirrors `apps/mobile/app/onboarding.tsx` saveAndFinish:
 *   tdee    = calculateTDEE(sex, w, h, age, activity)
 *   budget  = calculateBudget(tdee, pace, goal)
 *   macros  = calculateMacros(budget, strategy, w)
 *
 * Caller is responsible for the Supabase write — this module is a pure
 * function so it stays test-friendly and runs identically on web + RN.
 */

import {
  calculateTDEE,
  calculateBudget,
  calculateMacros,
  type ActivityLevel,
  type PlanPace,
  type NutritionStrategy,
  type Sex,
} from "./tdee";

export type RecomputeTargetsInput = {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: ActivityLevel;
  /**
   * Accepts DB values (`cut` / `maintain` / `bulk`) and onboarding UI
   * labels (`lose` / `health` / `strength`) — `calculateBudget`
   * normalises both. Falls back to "maintain" when null/undefined so
   * the helper never silently applies a deficit to a no-goal profile.
   */
  goal?: string | null;
  planPace?: PlanPace | null;
  nutritionStrategy?: NutritionStrategy | null;
};

export type RecomputedTargets = {
  target_calories: number;
  target_protein: number;
  target_carbs: number;
  target_fat: number;
  target_fiber_g: number;
  /** Expose the intermediate maintenance number so the caller can
   *  surface it in a confirmation toast/banner without recomputing. */
  maintenanceTdee: number;
};

/**
 * Returns null when any required input is missing / invalid — the
 * caller should NOT write null targets to the profile in that case.
 * We deliberately do not invent fallbacks here (no "close enough"
 * nutrition).
 */
export function recomputeTargetsForActivity(
  input: RecomputeTargetsInput,
): RecomputedTargets | null {
  const { sex, weightKg, heightCm, age, activityLevel } = input;
  if (
    !Number.isFinite(weightKg) || weightKg <= 0 ||
    !Number.isFinite(heightCm) || heightCm <= 0 ||
    !Number.isFinite(age) || age <= 0
  ) {
    return null;
  }

  const pace: PlanPace = input.planPace ?? "steady";
  const strategy: NutritionStrategy = input.nutritionStrategy ?? "balanced";
  const goal = input.goal ?? "maintain";

  const tdee = calculateTDEE(sex, weightKg, heightCm, age, activityLevel);
  const budget = calculateBudget(tdee, pace, goal);
  const macros = calculateMacros(budget, strategy, weightKg);

  return {
    target_calories: budget,
    target_protein: macros.protein,
    target_carbs: macros.carbs,
    target_fat: macros.fat,
    target_fiber_g: macros.fiber,
    maintenanceTdee: tdee,
  };
}
