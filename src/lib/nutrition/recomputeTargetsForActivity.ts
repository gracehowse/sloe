/**
 * Recompute macro + calorie targets when the user changes a profile
 * input AFTER onboarding — the post-onboarding "Edit goal & pace" editor
 * (web `goal-pace-editor-dialog.tsx`, mobile `GoalPaceEditorSheet.tsx`)
 * AND the Settings activity-level self-edit. One shared helper so web and
 * mobile apply the exact same math — no duplicated pipeline, no drift.
 *
 * Shipped 2026-04-19 for build 10 fix E-2 (activity-level self-edit in
 * Settings). Closed TestFlight `AIIm60n` + `AHCSYMATS`.
 *
 * ── 2026-05-26 (target-recompute unification) ────────────────────────
 * This path used to compute targets the WRONG way relative to onboarding
 * and the weekly check-in:
 *   - STATIC TDEE only (`calculateTDEE`), ignoring adaptive maintenance.
 *   - PRESET deficit buckets (`PACE_DAILY_DEFICIT` via `calculateBudget`),
 *     so the editor's calories disagreed with onboarding's continuous-pace
 *     numbers, and `gain` used a half-magnitude surplus.
 *   - A hardcoded `"balanced"` strategy default, so a cut user's macros
 *     silently dropped to 1.6 g/kg protein.
 * It now routes through the canonical `deriveTargets` core:
 *   maintenance = resolveMaintenance(profile).kcal   (adaptive when the
 *                   confidence is medium/high AND the value is fresh per
 *                   adaptive_tdee_updated_at; else static Mifflin)
 *   paceKgPerWeek = PACE_WEEKLY_KG[plan_pace preset]  (continuous deficit)
 *   strategy      = nutritionStrategy ?? mapGoalToStrategy(goal)
 * The function signature + return shape are UNCHANGED so the two editor
 * UIs compile without edits — the new adaptive inputs are OPTIONAL. When
 * a caller doesn't pass the adaptive fields (the editor UIs today),
 * `resolveMaintenance` falls back to static Mifflin, so behaviour is the
 * same shape as before EXCEPT the deficit model + strategy default are now
 * correct. Wiring the editors to pass the adaptive columns (so the editor
 * benefits from adaptive maintenance) is the SEPARATE editor-UI task.
 *
 * Caller is responsible for the Supabase write — this module is a pure
 * function so it stays test-friendly and runs identically on web + RN.
 *
 * Static relative imports only (mobile resolves this file via the
 * `@suppr/shared` alias; a dynamic relative import broke Metro — see
 * src/lib/onboarding/persist.ts header).
 */

import {
  PACE_WEEKLY_KG,
  type ActivityLevel,
  type PlanPace,
  type NutritionStrategy,
  type Sex,
} from "./tdee";
import { deriveTargets } from "./goalPaceRetune";
import { resolveMaintenance } from "./resolveMaintenance";
import { buildMaintenanceInputs } from "./energyNumbers";

export type RecomputeTargetsInput = {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: ActivityLevel;
  /**
   * Accepts DB values (`cut` / `maintain` / `bulk`) and onboarding UI
   * labels (`lose` / `recomp` / `gain`) — `deriveTargets` normalises both.
   * Falls back to "maintain" when null/undefined so the helper never
   * silently applies a deficit to a no-goal profile.
   */
  goal?: string | null;
  planPace?: PlanPace | null;
  nutritionStrategy?: NutritionStrategy | null;
  /**
   * Adaptive-maintenance inputs (OPTIONAL — additive, behaviour-preserving
   * when omitted). When the caller passes these AND the adaptive value is
   * confident + fresh, `resolveMaintenance` uses it as the deficit
   * baseline; otherwise it falls back to the static Mifflin formula from
   * the body basics above. The editor UIs don't pass these yet (the
   * editor-UI task wires them); the weekly check-in path uses
   * `computeRetunedTargets` directly with its own adaptive value.
   */
  adaptiveTdee?: number | null;
  adaptiveTdeeConfidence?: string | null;
  adaptiveTdeeUpdatedAt?: string | null;
  /**
   * ENG-1506 — optional `weight_kg_by_day` map so the maintenance baseline
   * uses the canonical input policy (latest weigh-in beats the lagging
   * profile snapshot; `buildMaintenanceInputs`). Omitted → `weightKg` is
   * the weight for both the baseline and the macro derivation, exactly as
   * before. NB: `weightKg` (the explicit/edited weight) still drives the
   * g/kg macro derivation either way — the editor's weight field must win
   * for macros the user is actively editing.
   */
  weightKgByDay?: Record<string, number> | null;
  /** Injectable clock so the staleness gate in `resolveMaintenance` is
   *  deterministic in tests. */
  now?: Date;
};

export type RecomputedTargets = {
  target_calories: number;
  target_protein: number;
  target_carbs: number;
  target_fat: number;
  target_fiber_g: number;
  /** Expose the intermediate maintenance number so the caller can
   *  surface it in a confirmation toast/banner without recomputing.
   *  This is the SAME number `deriveTargets` applied the deficit to —
   *  adaptive when confident + fresh, else static Mifflin. */
  maintenanceTdee: number;
};

/** Map a legacy `plan_pace` preset to its continuous kg/week value so the
 *  deficit math is continuous (retires `PACE_DAILY_DEFICIT` from this
 *  path). Defaults to `steady` (0.5 kg/week) when the preset is missing —
 *  the same default the previous `calculateBudget` path used. */
function paceKgPerWeekForPreset(preset: PlanPace | null | undefined): number {
  return PACE_WEEKLY_KG[preset ?? "steady"];
}

/**
 * Returns null when any required input is missing / invalid — the
 * caller should NOT write null targets to the profile in that case.
 * We deliberately do not invent fallbacks here (no "close enough"
 * nutrition).
 */
export function recomputeTargetsFromProfile(
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

  const goal = input.goal ?? "maintain";
  const paceKgPerWeek = paceKgPerWeekForPreset(input.planPace);

  // Maintenance baseline — adaptive when confident + fresh, else static
  // Mifflin from the body basics. `resolveMaintenance` returns null only
  // when the formula inputs are incomplete; we've already guaranteed
  // weight/height/age are valid above, so the formula branch always
  // resolves a number here (adaptive inputs are optional + additive).
  // ENG-1506 — inputs route through the canonical `buildMaintenanceInputs`
  // policy. When the caller supplies `weightKgByDay`, the latest weigh-in
  // seeds the baseline (matching what every display surface shows); when it
  // doesn't — or the user just edited their weight — `weightKg` stands.
  const resolved = resolveMaintenance(
    buildMaintenanceInputs({
      adaptive_tdee: input.adaptiveTdee ?? null,
      adaptive_tdee_confidence: input.adaptiveTdeeConfidence ?? null,
      adaptive_tdee_updated_at: input.adaptiveTdeeUpdatedAt ?? null,
      sex,
      weight_kg: weightKg,
      height_cm: heightCm,
      age,
      activity_level: activityLevel,
      weight_kg_by_day: input.weightKgByDay ?? null,
    }),
    { now: input.now },
  );
  if (resolved == null) return null;

  const derived = deriveTargets({
    // `resolved.kcal` is already rounded by resolveMaintenance.
    maintenanceKcal: resolved.kcal,
    goal,
    paceKgPerWeek,
    // null → mapGoalToStrategy(goal) inside deriveTargets (NOT "balanced").
    strategy: input.nutritionStrategy ?? null,
    weightKg,
    sex,
  });
  if (derived == null) return null;

  return {
    target_calories: derived.targetCalories,
    target_protein: derived.proteinG,
    target_carbs: derived.carbsG,
    target_fat: derived.fatG,
    target_fiber_g: derived.fiberG,
    maintenanceTdee: resolved.kcal,
  };
}

/**
 * Back-compat alias. The helper was named for the activity-level edit
 * path (build 10 fix E-2), but it recomputes the full target set from
 * ALL body stats + goal + pace + strategy — so the goal/pace editor
 * (ENG goal-editor, 2026-05-25) reuses it verbatim. This alias keeps the
 * existing Settings + provenance-test call-sites working unchanged.
 */
export const recomputeTargetsForActivity = recomputeTargetsFromProfile;
