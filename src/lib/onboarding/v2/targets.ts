/**
 * Onboarding v2 — targets calculation pipeline.
 *
 * Wraps the existing single-source-of-truth nutrition logic in
 * `src/lib/nutrition/tdee.ts` so the v2 flow's continuous-pace slider
 * and goal model translate cleanly onto the production calc without
 * forking the BMR / activity / macro algorithms.
 *
 * Decision history: docs/decisions/2026-04-19-onboarding-redesign-scope.md
 *  - Continuous pace slider (kg/week) → daily kcal adjustment via the
 *    canonical 7,700 kcal ≈ 1 kg conversion (`KCAL_PER_KG` in
 *    adaptiveTdee.ts). Existing `calculateBudget` keeps its preset-pace
 *    contract untouched so the production flow doesn't break.
 *  - Pace safety floor is SOFT-WARN, never hard-block. `paceWarning`
 *    returns a `{level, title, body}` triple; the UI renders it but
 *    `canAdvance` (in state.ts) ignores it.
 *  - Macros map prototype goals → existing `NutritionStrategy`:
 *      lose | recomp → high_satisfaction (1.8 g/kg, 30 % fat)
 *      maintain | gain → balanced (1.6 g/kg, 25 % fat)
 *    nutrition-engine should sign off these mappings before Phase 2
 *    leaves the flag.
 */

import {
  ACTIVITY_MULTIPLIERS,
  budgetSafety,
  calculateBMR,
  calculateMacros,
  type ActivityLevel,
  type NutritionStrategy,
  type Sex,
} from "@/lib/nutrition/tdee";
import {
  GOAL_DEFAULT_PACE,
  type Goal,
  type OnboardingState,
} from "./state";

/** Energy balance — 1 kg of body mass ≈ 7,700 kcal. Mirrors
 *  `KCAL_PER_KG` in `src/lib/nutrition/adaptiveTdee.ts` (we don't
 *  re-export that value because adaptiveTdee depends on Supabase types
 *  and pulling it in here would bloat onboarding-only bundles). If you
 *  change one, change both. */
const KCAL_PER_KG = 7_700;

/** Map the prototype's goal to the existing `NutritionStrategy` used
 *  by `calculateMacros`. Documented mapping — the only place this
 *  shape change happens, so the rest of the pipeline doesn't have to
 *  know about the goal model split. */
export function mapGoalToStrategy(goal: Goal): NutritionStrategy {
  switch (goal) {
    case "lose":
    case "recomp":
      return "high_satisfaction"; // 1.8 g/kg protein, 30 % fat
    case "maintain":
    case "gain":
      return "balanced"; // 1.6 g/kg protein, 25 % fat
  }
}

/** Convert a continuous pace (kg/week) to a daily kcal adjustment.
 *  Sign convention: negative for `lose` / `recomp` (deficit), positive
 *  for `gain`, zero for `maintain`. */
export function paceToKcalAdjustment(
  goal: Goal,
  paceKgPerWeek: number,
): number {
  if (goal === "maintain" || paceKgPerWeek === 0) return 0;
  const dailyMagnitude = Math.round((paceKgPerWeek * KCAL_PER_KG) / 7);
  if (goal === "lose" || goal === "recomp") return -dailyMagnitude;
  return dailyMagnitude; // gain
}

/** Safety floor in kcal — generally-accepted lower bound for
 *  unsupervised dieting. Mirrors `budgetSafety` in `tdee.ts` so a
 *  silent drift fails the `tdeeExplainer` parity test if either side
 *  shifts. */
export function safetyFloorFor(sex: Sex | null): number {
  if (sex === "male") return 1500;
  if (sex === "female") return 1200;
  return 1350; // unspecified — midpoint
}

/** Severity of a pace warning. UI renders one banner per level. */
export type WarningLevel = "info" | "warn" | "danger";

/** Pace warning, if any. Returns `null` when the user is comfortably
 *  inside safe territory. The UI renders the banner regardless of
 *  whether Continue is enabled — see decision doc for why. */
export interface PaceWarning {
  level: WarningLevel;
  title: string;
  body: string;
  /** Stable analytics tag — fired with `onboarding_pace_below_safety_floor`
   *  on banner display + on advance-despite-banner. */
  reason: "below_floor" | "fast_loss" | "near_floor";
}

export function paceWarning(
  state: Pick<OnboardingState, "goal" | "paceKgPerWeek" | "sex" | "weightKg">,
  projectedTarget: number | null,
): PaceWarning | null {
  if (projectedTarget == null) return null;
  if (state.goal !== "lose" && state.goal !== "recomp") return null;
  const pace = state.paceKgPerWeek ?? GOAL_DEFAULT_PACE[state.goal];
  const floor = safetyFloorFor(state.sex);
  const weeklyLossPct = state.weightKg ? (pace / state.weightKg) * 100 : 0;

  if (projectedTarget < floor) {
    return {
      level: "danger",
      reason: "below_floor",
      title: `Below the ${floor.toLocaleString()} kcal safety floor`,
      body: `This pace would put your daily target at ~${projectedTarget.toLocaleString()} kcal. Most health authorities recommend no less than ${floor.toLocaleString()} kcal/day without medical supervision. Please slow the pace, or check with your doctor first.`,
    };
  }
  if (weeklyLossPct > 1) {
    return {
      level: "warn",
      reason: "fast_loss",
      title: "Faster than 1% of your bodyweight per week",
      body: `At ~${pace.toFixed(2)} kg/week that's ~${weeklyLossPct.toFixed(1)}% of your bodyweight. Rapid loss can cost muscle and is harder to sustain — consider a gentler pace, or check in with a clinician.`,
    };
  }
  if (projectedTarget < floor + 200) {
    return {
      level: "info",
      reason: "near_floor",
      title: "Close to the minimum recommended intake",
      body: `Your target is approaching the general ${floor.toLocaleString()} kcal/day floor for unsupervised dieting. This is fine for most healthy adults, but if you have any medical conditions please consult your doctor.`,
    };
  }
  return null;
}

/** Final computed targets shown on the Reveal step. Numbers round to
 *  whole kcal / whole grams for display; never round before
 *  arithmetic. */
export interface V2Targets {
  bmr: number;
  tdee: number;
  /** Daily calorie target after applying pace adjustment. */
  target: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  /** Pace value used for the calc (resolved default if user hadn't
   *  touched the slider). */
  pace: number;
  /** Daily kcal adjustment vs. TDEE (negative for cut/recomp). */
  kcalAdj: number;
  /** Strategy passed to `calculateMacros` — useful for analytics. */
  strategy: NutritionStrategy;
  /** Convenience flag — true when the projected target is below
   *  `safetyFloorFor(sex)`. The Pace step uses this to decide which
   *  banner to show; the analytics layer uses it to fire the
   *  `onboarding_pace_below_safety_floor` event. */
  belowSafetyFloor: boolean;
  /** Convenience flag — `budgetSafety` translation. */
  safety: ReturnType<typeof budgetSafety>;
}

/** Compute the user's targets from the current onboarding state.
 *  Returns `null` when the required inputs (sex / age / height /
 *  weight / activity / goal) aren't all set yet — the caller should
 *  render a quieter "answer the body-stats steps to see your numbers"
 *  fallback in that case. */
export function computeV2Targets(state: OnboardingState): V2Targets | null {
  const { sex, age, heightCm, weightKg, activity, goal, paceKgPerWeek } = state;
  if (
    sex === null ||
    !Number.isFinite(age) ||
    !Number.isFinite(heightCm) ||
    !Number.isFinite(weightKg) ||
    activity === null ||
    goal === null
  ) {
    return null;
  }

  const bmr = calculateBMR(sex, weightKg, heightCm, age);
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[activity as ActivityLevel]);
  const pace = paceKgPerWeek ?? GOAL_DEFAULT_PACE[goal];
  const kcalAdj = paceToKcalAdjustment(goal, pace);
  const target = Math.round(tdee + kcalAdj);

  const strategy = mapGoalToStrategy(goal);
  const macros = calculateMacros(target, strategy, weightKg);

  const floor = safetyFloorFor(sex);
  return {
    bmr: Math.round(bmr),
    tdee,
    target,
    proteinG: macros.protein,
    carbsG: macros.carbs,
    fatG: macros.fat,
    fiberG: macros.fiber,
    pace,
    kcalAdj,
    strategy,
    belowSafetyFloor:
      (goal === "lose" || goal === "recomp") && target < floor,
    safety: budgetSafety(target, sex),
  };
}
