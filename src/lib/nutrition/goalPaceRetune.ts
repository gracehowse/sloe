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
 *
 * ── CANONICAL CORE (2026-05-26, target-recompute unification) ─────────
 * `deriveTargets(input)` is now THE single place every target recompute
 * flows through:
 *   - onboarding (`computeV2Targets`) — static maintenance (new user has
 *     no adaptive data) + continuous pace.
 *   - post-onboarding editor (`recomputeTargetsFromProfile`) — adaptive
 *     maintenance when confident + fresh, else static Mifflin; continuous
 *     pace mapped from the legacy `plan_pace` preset.
 *   - weekly check-in (`computeRetunedTargets`, the thin alias below) —
 *     adaptive maintenance (already sourced by the caller) + continuous
 *     pace.
 * One deficit model (continuous, `paceToKcalAdjustment`), one strategy
 * default (`mapGoalToStrategy` when null), one safety-floor rule. The
 * preset `PACE_DAILY_DEFICIT` buckets are retired from the recompute
 * path — they only ever lived in `calculateBudget`, which is no longer
 * on this path.
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

/**
 * The goal vocabulary `deriveTargets` accepts. The onboarding `Goal`
 * type uses `lose | recomp | maintain | gain`; the DB `profiles.goal`
 * column uses `cut | maintain | bulk`. `deriveTargets` normalises DB
 * values so the editor (which reads the DB enum) and onboarding (which
 * holds the UI enum) can both call the same core without re-deriving
 * the mapping at every call-site.
 */
export type DeriveTargetsGoal = Goal | "cut" | "bulk";

/**
 * Normalise an incoming goal to the onboarding `Goal` vocabulary the
 * downstream math (`paceToKcalAdjustment`, `mapGoalToStrategy`) speaks.
 *
 *   cut / lose / recomp → deficit (cut + lose → "lose"; recomp stays
 *                  "recomp" — both are deficits, but recomp maps to a
 *                  higher-protein strategy. We cannot recover "recomp"
 *                  from "cut" alone, so a DB "cut" reads as "lose"; the
 *                  nutrition_strategy column carries the recomp signal.)
 *   bulk / gain / strength → surplus
 *   maintain / health      → maintain
 *
 * Accepts the wider `string` (not just `DeriveTargetsGoal`) so the legacy
 * UI labels `health` / `strength` that some call-sites still carry don't
 * silently fall through to a deficit. Unknown → "maintain" (the safe
 * default the previous `calculateBudget` path used: never apply a deficit
 * to a goal we don't recognise).
 */
export function normaliseGoal(goal: DeriveTargetsGoal | string): Goal {
  switch (goal) {
    case "cut":
    case "lose":
      return "lose";
    case "recomp":
      return "recomp";
    case "bulk":
    case "gain":
    case "strength":
      return "gain";
    case "maintain":
    case "health":
      return "maintain";
    default:
      return "maintain";
  }
}

export interface DeriveTargetsInput {
  /** Maintenance kcal — the explicit baseline the deficit is applied to.
   *  Caller decides the source: static Mifflin × activity for a new user
   *  (onboarding), adaptive-when-confident for an existing user (editor /
   *  weekly check-in). Required + > 0. */
  maintenanceKcal: number;
  /** Goal context. Accepts onboarding (`lose|recomp|maintain|gain`) and
   *  DB (`cut|bulk`) vocabulary, plus the legacy UI labels
   *  (`health|strength`) — all normalised internally. Unknown strings
   *  resolve to `maintain` (never silently apply a deficit). */
  goal: DeriveTargetsGoal | string;
  /** Desired weekly rate of change, in kg/week (always positive). The
   *  deficit/surplus direction is derived from `goal`. */
  paceKgPerWeek: number;
  /** Strategy carries from the user's profile. When `null` we infer it
   *  from the goal via `mapGoalToStrategy` so the macro split is valid. */
  strategy: NutritionStrategy | null;
  /** Body stats for macro derivation. Weight is required. */
  weightKg: number;
  /** Used for the safety floor. */
  sex: Sex;
}

export interface DeriveTargetsResult {
  /** New daily calorie target (kcal). Rounded at this display/persist
   *  boundary — maintenance is rounded by the caller BEFORE the deficit,
   *  per the spec, so the deficit is applied to a whole-kcal baseline. */
  targetCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  /** kcal adjustment vs maintenance. Negative deficit / positive surplus. */
  kcalAdjustment: number;
  /** True when the (adaptive-based) target dips below the sex floor for a
   *  loss goal. Soft-warn-not-block on ALL paths. */
  belowSafetyFloor: boolean;
  /** `budgetSafety` translation of the final target. */
  safety: ReturnType<typeof budgetSafety>;
  /** Strategy actually used for the macro split. */
  strategyUsed: NutritionStrategy;
}

/**
 * THE canonical target-recompute core. Pure. Returns `null` only when
 * `maintenanceKcal` or `weightKg` is non-finite / non-positive — every
 * other branch yields a result the caller can preview + persist.
 *
 * Rounding contract: the caller rounds `maintenanceKcal` BEFORE passing
 * it in (so the deficit lands on a whole-kcal baseline); we round only
 * at this display/persist boundary (`targetCalories`). The safety-floor
 * flag is computed from the final (adaptive-or-static-based) target.
 */
export function deriveTargets(
  input: DeriveTargetsInput,
): DeriveTargetsResult | null {
  const { maintenanceKcal, paceKgPerWeek, strategy, weightKg, sex } = input;
  if (!Number.isFinite(maintenanceKcal) || maintenanceKcal <= 0) return null;
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;

  const goal = normaliseGoal(input.goal);

  const kcalAdjustment = paceToKcalAdjustment(goal, paceKgPerWeek);
  // maintenanceKcal is already rounded by the caller; round again only to
  // absorb any non-integer maintenance a caller forgot to round.
  const targetCalories = Math.round(maintenanceKcal + kcalAdjustment);

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
 * Compute the new targets for a desired pace — the Weekly Check-in
 * call-site. Thin alias over the canonical `deriveTargets` core (the
 * input here pre-sources its `tdeeKcal` from the adaptive value when
 * present, so it maps directly onto `maintenanceKcal`). Returns `null`
 * only when `tdeeKcal` is non-finite / non-positive — every other
 * branch yields a result the caller can preview live.
 *
 * Kept as a distinct export so the weekly-checkin sheet and its tests
 * don't have to change shape; `GoalPaceRetuneResult` is structurally a
 * `DeriveTargetsResult`.
 */
export function computeRetunedTargets(
  input: GoalPaceRetuneInput,
): GoalPaceRetuneResult | null {
  return deriveTargets({
    maintenanceKcal: input.tdeeKcal,
    goal: input.goal,
    paceKgPerWeek: input.paceKgPerWeek,
    strategy: input.strategy,
    weightKg: input.weightKg,
    sex: input.sex,
  });
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
