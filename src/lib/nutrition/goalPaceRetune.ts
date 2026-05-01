/**
 * Goal-pace re-tune (MacroFactor parity) — shared, pure helper.
 *
 * The Weekly Check-in surface lets the user slow or speed their cut /
 * bulk *without* re-running onboarding. This module owns the math:
 * given a current TDEE + body stats + a new pace (kg/week), produce
 * the new target macros that should be written to the profile row.
 *
 * Pure — re-uses the canonical helpers from `tdee.ts` so the math
 * stays identical to onboarding's Reveal step. Mobile re-exports.
 *
 * Spec: extended-competitor-audit task (2026-04-30, Step 2).
 */

import {
  ACTIVITY_MULTIPLIERS,
  budgetSafety,
  calculateBMR,
  calculateMacros,
  type ActivityLevel,
  type NutritionStrategy,
  type Sex,
} from "./tdee";
import {
  paceToKcalAdjustment,
  safetyFloorFor,
  mapGoalToStrategy,
} from "../onboarding/targets";
import type { Goal } from "../onboarding/state";

/** The full set of pace presets the re-tune sheet exposes. We mirror
 *  the canonical onboarding presets (relaxed / steady / accelerated /
 *  vigorous) plus a `maintain` shortcut so the user can level off the
 *  cut without changing goal type. The kg/week values are in absolute
 *  magnitude — direction is derived from `goal`. */
export const RETUNE_PACE_PRESETS_KG_PER_WEEK = [0.25, 0.5, 0.75, 1.0] as const;

export type RetunePace = (typeof RETUNE_PACE_PRESETS_KG_PER_WEEK)[number] | 0;

export interface GoalPaceRetuneInput {
  /** Effective TDEE — pass the adaptive value when present, the formula
   *  fallback otherwise. Required + > 0. */
  tdeeKcal: number;
  /** Goal context. `maintain` ignores `paceKgPerWeek` and lands on the
   *  raw TDEE. Re-tune does not change goal type — the user's existing
   *  goal carries through. */
  goal: Goal;
  /** Strategy carries from the user's profile — re-tune doesn't change
   *  it (the user picked it on onboarding). When `null` we infer from
   *  the goal via `mapGoalToStrategy` so the output is still valid. */
  strategy: NutritionStrategy | null;
  /** Body stats for macro derivation. Weight is required; sex is used
   *  for the safety floor. */
  weightKg: number;
  sex: Sex;
  /** Desired weekly rate of change, in kg/week (always positive). */
  paceKgPerWeek: RetunePace;
}

export interface GoalPaceRetuneResult {
  /** New daily calorie target (kcal). Always rounded. */
  targetCalories: number;
  /** New macro targets. */
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  /** kcal adjustment vs TDEE. Negative for deficit, positive for surplus. */
  kcalAdjustment: number;
  /** True when the new target dips below the safety floor — the sheet
   *  shows a soft-warn banner but does NOT block the user from
   *  confirming (Suppr policy: soft-warn-not-block, see
   *  `apps/mobile/lib/onboarding-v2.ts`). */
  belowSafetyFloor: boolean;
  /** Convenience surface — same trio the onboarding Reveal step uses. */
  safety: ReturnType<typeof budgetSafety>;
  /** Strategy actually used for the macro split — useful for logging. */
  strategyUsed: NutritionStrategy;
}

/**
 * Compute the new targets for a desired pace. Returns `null` only
 * when `tdeeKcal` is non-finite or non-positive — every other branch
 * yields a result the caller can preview live.
 */
export function computeRetunedTargets(
  input: GoalPaceRetuneInput,
): GoalPaceRetuneResult | null {
  const { tdeeKcal, goal, strategy, weightKg, sex, paceKgPerWeek } = input;
  if (!Number.isFinite(tdeeKcal) || tdeeKcal <= 0) return null;
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;

  const kcalAdjustment = paceToKcalAdjustment(goal, paceKgPerWeek);
  const targetCalories = Math.round(tdeeKcal + kcalAdjustment);

  const strategyUsed = strategy ?? mapGoalToStrategy(goal);
  const macros = calculateMacros(targetCalories, strategyUsed, weightKg);

  const floor = safetyFloorFor(sex);
  const belowSafetyFloor =
    (goal === "lose" || goal === "recomp") && targetCalories < floor;

  return {
    targetCalories,
    proteinG: macros.protein,
    carbsG: macros.carbs,
    fatG: macros.fat,
    fiberG: macros.fiber,
    kcalAdjustment,
    belowSafetyFloor,
    safety: budgetSafety(targetCalories, sex),
    strategyUsed,
  };
}

/**
 * Plain-English label for a pace value. Locked here so web + mobile
 * stay in sync.
 */
export function paceLabel(paceKgPerWeek: RetunePace, goal: Goal): string {
  if (goal === "maintain" || paceKgPerWeek === 0) return "Maintain";
  const direction =
    goal === "lose" || goal === "recomp" ? "loss" : "gain";
  return `${paceKgPerWeek.toFixed(2).replace(/\.?0+$/, "")} kg/week ${direction}`;
}

/**
 * Re-derive an existing pace value from the current goal + target.
 * Used to pre-select the slider position when opening the re-tune
 * sheet — without this, the sheet would default to the first preset
 * even though the user is currently on a different one.
 *
 * Returns the closest preset; `null` when we can't compute one
 * (missing TDEE / target / mismatched goal).
 */
export function inferCurrentPace(input: {
  tdeeKcal: number;
  targetCalories: number;
  goal: Goal;
}): RetunePace | null {
  const { tdeeKcal, targetCalories, goal } = input;
  if (!Number.isFinite(tdeeKcal) || tdeeKcal <= 0) return null;
  if (!Number.isFinite(targetCalories) || targetCalories <= 0) return null;
  if (goal === "maintain") return 0;

  // Daily kcal adjustment magnitude → kg/week magnitude.
  const dailyAdj = targetCalories - tdeeKcal;
  // 7700 kcal ≈ 1 kg, mirrored across modules.
  const weeklyKg = Math.abs(dailyAdj * 7) / 7700;

  const presets: RetunePace[] = [
    0,
    ...RETUNE_PACE_PRESETS_KG_PER_WEEK,
  ];
  // Snap to nearest preset.
  let best: RetunePace = presets[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const p of presets) {
    const d = Math.abs(weeklyKg - p);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

/**
 * Map between the onboarding `Goal` type and the DB's stored goal
 * column so the caller can persist a re-tune without re-deriving the
 * mapping. The DB schema uses "cut" / "maintain" / "bulk"; the
 * onboarding type uses "lose" / "recomp" / "maintain" / "gain". This
 * map is identity for the shared cases.
 */
export function dbGoalForOnboardingGoal(goal: Goal): "cut" | "maintain" | "bulk" {
  if (goal === "maintain") return "maintain";
  if (goal === "gain") return "bulk";
  // lose + recomp both map to "cut" in the DB; the strategy column
  // carries the recomp distinction.
  return "cut";
}

/**
 * Inverse — used when the caller knows the DB goal and needs to feed
 * `computeRetunedTargets`. We can't recover `recomp` from `cut` alone
 * so the caller passes the strategy to disambiguate. When unknown,
 * we default to `lose` (the larger user base).
 */
export function onboardingGoalForDbGoal(
  dbGoal: "cut" | "maintain" | "bulk" | string,
  strategy?: NutritionStrategy | null,
): Goal {
  if (dbGoal === "maintain") return "maintain";
  if (dbGoal === "bulk") return "gain";
  // "cut" or unknown — disambiguate via strategy.
  if (strategy === "high_protein") return "recomp";
  return "lose";
}

/** Re-export so callers can type the input without importing two modules. */
export type { ActivityLevel, NutritionStrategy, Sex };
export { ACTIVITY_MULTIPLIERS, calculateBMR };
