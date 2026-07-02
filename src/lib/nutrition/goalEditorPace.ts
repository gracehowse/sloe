/**
 * goalEditorPace — shared, pure helpers for the post-onboarding
 * "Edit goal & pace" editor (web `goal-pace-editor-dialog.tsx`, mobile
 * `GoalPaceEditorSheet.tsx`). Stage 2 of the target-recompute
 * unification (2026-05-26).
 *
 * Both editors now expose the SAME continuous kg/week pace slider that
 * onboarding uses (`PACE_RANGES` / `PACE_PRESETS` in onboarding/state).
 * The editor speaks the DB goal vocabulary (`cut | maintain | bulk`);
 * the slider config is keyed by the onboarding `Goal` vocabulary
 * (`lose | maintain | gain | recomp`). This module owns the mapping and
 * the seat/dirty logic so neither platform re-derives it inline (the
 * mobile sheet is being broken under the 400-line limit, and the web
 * dialog must match it exactly).
 *
 * Pure + dependency-light (only `onboarding/state` constants + the
 * legacy `PACE_WEEKLY_KG` snap values) so it bundles identically on web
 * and React Native via the `@suppr/shared/nutrition/goalEditorPace`
 * alias. Static relative imports only — a dynamic relative import breaks
 * Metro (see persist.ts header).
 *
 * Pinned by `tests/unit/goalEditorPace.test.ts`.
 */

import {
  GOAL_DEFAULT_PACE,
  PACE_RANGES,
  type Goal,
} from "../onboarding/state";
import {
  PACE_WEEKLY_KG,
  type ActivityLevel,
  type NutritionStrategy,
  type PlanPace,
  type Sex,
} from "./tdee";
import {
  parseDayTargetSchedule,
  DEFAULT_HIGH_DAYS,
  type DayTargetScheduleId,
  type WeekdayIndex,
} from "./dayTargetSchedule";

/** The three goal options the editor exposes (DB vocabulary). The editor
 *  never sets `recomp` — that's an onboarding-only nuance carried by
 *  `nutrition_strategy`. */
export type EditorDbGoal = "cut" | "maintain" | "bulk";

/** The normalised profile the editor works from. Shared shape so web +
 *  mobile parse the Supabase row identically. */
export interface LoadedGoalEditorProfile {
  sex: Sex;
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  activityLevel: ActivityLevel;
  goal: EditorDbGoal;
  planPace: PlanPace;
  /** Lossless continuous pace if the row has been recomputed since the
   *  migration; null for pre-migration rows (seat from `planPace`). */
  paceKgPerWeek: number | null;
  goalWeightKg: number | null;
  nutritionStrategy: NutritionStrategy | null;
  measurementSystem: "metric" | "imperial";
  /** Adaptive-maintenance inputs — fed straight into
   *  `recomputeTargetsFromProfile` so the live preview uses adaptive
   *  maintenance when it's confident + fresh. */
  adaptiveTdee: number | null;
  adaptiveTdeeConfidence: string | null;
  adaptiveTdeeUpdatedAt: string | null;
  /** Stored fibre target (g). Null when unset on the profile row. */
  targetFiberG: number | null;
  /** Fibre provenance — `user` values are sticky across recomputes (ENG-779). */
  targetFiberSource: "onboarding" | "recompute" | "user" | null;
  /** ENG-960 — opt-in weekday/weekend day-target schedule. `null` = flat week
   *  ("same every day"). `highDays` carries the higher-target weekday set. */
  calorieSchedule: DayTargetScheduleId | null;
  highDays: WeekdayIndex[];
}

/** The exact column list both editors select from `profiles`. Single
 *  source so the two SELECTs can't drift (e.g. one forgets to add the
 *  adaptive columns). */
export const GOAL_EDITOR_PROFILE_COLUMNS =
  "sex, age, weight_kg, height_cm, activity_level, goal, plan_pace, pace_kg_per_week, goal_weight_kg, nutrition_strategy, measurement_system, adaptive_tdee, adaptive_tdee_confidence, adaptive_tdee_updated_at, target_fiber_g, target_fiber_source, calorie_schedule, high_days";

/** Map the loaded DB goal string to one of the three editor options. */
export function normalizeEditorGoal(raw: string | null | undefined): EditorDbGoal {
  if (raw === "maintain" || raw === "health") return "maintain";
  if (raw === "bulk" || raw === "gain" || raw === "strength") return "bulk";
  return "cut"; // cut / lose / recomp / unknown
}

/**
 * Parse a raw Supabase `profiles` row into the normalised editor shape.
 * Pure — defensive about every field so a partial/legacy row never
 * throws (we fall back to safe defaults the recompute can still use).
 * Shared by web + mobile so the parsing can't drift.
 */
export function parseGoalEditorProfileRow(
  data: Record<string, unknown> | null | undefined,
): LoadedGoalEditorProfile {
  const row = (data ?? {}) as Record<string, unknown>;
  const sex: Sex =
    row.sex === "male" || row.sex === "female" ? row.sex : "unspecified";
  const al: ActivityLevel =
    row.activity_level === "sedentary" ||
    row.activity_level === "light" ||
    row.activity_level === "moderate" ||
    row.activity_level === "active" ||
    row.activity_level === "very_active"
      ? row.activity_level
      : "moderate";
  const planPace: PlanPace =
    row.plan_pace === "relaxed" ||
    row.plan_pace === "steady" ||
    row.plan_pace === "accelerated" ||
    row.plan_pace === "vigorous"
      ? row.plan_pace
      : "steady";
  const ns: NutritionStrategy | null =
    row.nutrition_strategy === "balanced" ||
    row.nutrition_strategy === "high_protein" ||
    row.nutrition_strategy === "high_satisfaction" ||
    row.nutrition_strategy === "low_carb"
      ? row.nutrition_strategy
      : null;
  return {
    sex,
    weightKg: typeof row.weight_kg === "number" ? row.weight_kg : null,
    heightCm: typeof row.height_cm === "number" ? row.height_cm : null,
    age: typeof row.age === "number" ? row.age : null,
    activityLevel: al,
    goal: normalizeEditorGoal(typeof row.goal === "string" ? row.goal : null),
    planPace,
    paceKgPerWeek:
      typeof row.pace_kg_per_week === "number" ? row.pace_kg_per_week : null,
    goalWeightKg: typeof row.goal_weight_kg === "number" ? row.goal_weight_kg : null,
    nutritionStrategy: ns,
    measurementSystem: row.measurement_system === "imperial" ? "imperial" : "metric",
    adaptiveTdee: typeof row.adaptive_tdee === "number" ? row.adaptive_tdee : null,
    adaptiveTdeeConfidence:
      typeof row.adaptive_tdee_confidence === "string"
        ? row.adaptive_tdee_confidence
        : null,
    adaptiveTdeeUpdatedAt:
      typeof row.adaptive_tdee_updated_at === "string"
        ? row.adaptive_tdee_updated_at
        : null,
    targetFiberG:
      typeof row.target_fiber_g === "number" && row.target_fiber_g > 0
        ? Math.round(row.target_fiber_g)
        : null,
    targetFiberSource:
      row.target_fiber_source === "onboarding" ||
      row.target_fiber_source === "recompute" ||
      row.target_fiber_source === "user"
        ? row.target_fiber_source
        : null,
    // ENG-960 — parseDayTargetSchedule tolerates every malformed shape and
    // returns null (flat week) for "same"/unknown; the weekend default fills in
    // when a preset is set with no explicit high_days.
    calorieSchedule: parseDayTargetSchedule(row.calorie_schedule, row.high_days)?.id ?? null,
    highDays:
      parseDayTargetSchedule(row.calorie_schedule, row.high_days)?.highDays ??
      [...DEFAULT_HIGH_DAYS],
  };
}

/** Map an editor DB goal to the onboarding `Goal` the slider config is
 *  keyed by. `cut → lose`, `bulk → gain`; recomp is never produced here
 *  (the editor has no recomp option, and the existing strategy column
 *  preserves a recomp user's higher-protein split through the recompute). */
export function dbGoalToSliderGoal(goal: EditorDbGoal): Goal {
  if (goal === "maintain") return "maintain";
  if (goal === "bulk") return "gain";
  return "lose";
}

/** Slider range (min / max / step) for an editor DB goal. Reuses the
 *  exact onboarding ranges so the editor and onboarding can't drift. */
export function paceRangeForDbGoal(goal: EditorDbGoal): {
  min: number;
  max: number;
  step: number;
} {
  return PACE_RANGES[dbGoalToSliderGoal(goal)];
}

/** Default starting pace (kg/week) for a goal — used when neither
 *  `pace_kg_per_week` nor a `plan_pace` preset is available to seat from
 *  (e.g. a profile that has a directional goal but no pace at all). */
export function defaultPaceForDbGoal(goal: EditorDbGoal): number {
  return GOAL_DEFAULT_PACE[dbGoalToSliderGoal(goal)];
}

/** Continuous kg/week magnitude for a legacy `plan_pace` preset — the
 *  values onboarding's `mapPaceToPreset` snaps to (relaxed .25 / steady
 *  .5 / accelerated .75 / vigorous 1.0). Used to seat the slider for
 *  existing users whose row predates `pace_kg_per_week`. */
export function paceForPreset(preset: PlanPace | null | undefined): number | null {
  if (
    preset === "relaxed" ||
    preset === "steady" ||
    preset === "accelerated" ||
    preset === "vigorous"
  ) {
    return PACE_WEEKLY_KG[preset];
  }
  return null;
}

/**
 * Seat the slider's starting kg/week value when the editor opens.
 *
 * Precedence (matches the spec):
 *   1. A stored continuous `pace_kg_per_week` (the lossless source of
 *      truth written by every recompute since the migration). Clamped
 *      into the goal's range so a stale out-of-range value can't seat
 *      the thumb off-track.
 *   2. Inferred from the stored `plan_pace` preset (existing users
 *      pre-migration). Also clamped into range.
 *   3. The goal default (a directional goal with no pace at all).
 *
 * `maintain` always seats at 0 (no pace applies).
 *
 * Returns the seated value AND the clamp bounds so the caller can reuse
 * them for the slider props without re-deriving.
 */
export function seatPaceForEditor(input: {
  goal: EditorDbGoal;
  paceKgPerWeek: number | null | undefined;
  planPace: PlanPace | null | undefined;
}): number {
  if (input.goal === "maintain") return 0;
  const { min, max } = paceRangeForDbGoal(input.goal);
  const clamp = (v: number) => Math.max(min, Math.min(max, v));

  const stored = input.paceKgPerWeek;
  if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) {
    return clamp(stored);
  }
  const fromPreset = paceForPreset(input.planPace);
  if (fromPreset != null) return clamp(fromPreset);
  return clamp(defaultPaceForDbGoal(input.goal));
}

/** Two pace values are equal for dirty-tracking when within half a
 *  thousandth of a kg/week — tighter than the slider's smallest step
 *  (0.025) so an actual drag always registers, but immune to the float
 *  pollution the slider's snap rounding can leave behind. Opening +
 *  saving without moving the slider must NOT read as dirty (the silent
 *  901→846 preset-snap drift this fixes). */
export function paceChanged(a: number, b: number): boolean {
  return Math.abs(a - b) > 0.0005;
}

/**
 * Parse a measurement-system-aware weight input back to kg. Returns
 * `null` for blank / non-finite / non-positive input so the caller can
 * skip recompute + persist for an invalid field (never recompute off a
 * garbage weight). Rounds to one decimal kg, mirroring the goal-weight
 * field + onboarding.
 */
export function parseWeightInputToKg(
  raw: string,
  measurementSystem: "metric" | "imperial",
  lbToKg: (lb: number) => number,
): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  const kg = measurementSystem === "imperial" ? lbToKg(n) : n;
  return Math.round(kg * 10) / 10;
}

/**
 * Parse a height input back to cm. Metric takes a single cm field;
 * imperial takes feet + inches. Returns `null` when the result is
 * non-finite / non-positive so the caller can skip recompute for an
 * invalid field. Rounds to whole cm (storage granularity).
 */
export function parseHeightInputToCm(
  input:
    | { measurementSystem: "metric"; cm: string }
    | { measurementSystem: "imperial"; feet: string; inches: string },
  feetInchesToCm: (feet: number, inches: number) => number,
): number | null {
  if (input.measurementSystem === "metric") {
    const t = input.cm.trim();
    if (t === "") return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n);
  }
  const ft = input.feet.trim();
  const inch = input.inches.trim();
  // Feet is required; inches defaults to 0 when blank (e.g. "6 ft" flat).
  if (ft === "") return null;
  const f = Number(ft);
  const i = inch === "" ? 0 : Number(inch);
  if (!Number.isFinite(f) || f <= 0) return null;
  if (!Number.isFinite(i) || i < 0) return null;
  const cm = feetInchesToCm(f, i);
  if (!Number.isFinite(cm) || cm <= 0) return null;
  return Math.round(cm);
}

/**
 * ENG-1027 — copy for the below-safety-floor acknowledge step.
 *
 * Locked here so web (`goal-pace-editor-dialog.tsx`) and mobile
 * (`GoalPaceEditorSheet.tsx`) render the EXACT same words — a drift would
 * fail `tests/unit/goalEditorPace.test.ts`. We keep the soft-warn (it has
 * precedent at the higher-trust end of the market) but require an explicit
 * acknowledgment before saving below the floor — Cronometer's pattern,
 * which closes the gap with MFP / Lose It (who hard-refuse) without
 * paternalistic hard-blocking.
 *
 * Voice (per `_project-context.md` voice rules + trust posture): honest,
 * body-neutral, no shaming, no health claims, names the sources, gives the
 * user agency. The floor value is interpolated by sex so a man sees 1,500
 * and a woman 1,200.
 */
export const SAFETY_ACK_TITLE = "Confirm a target below the safety floor";

export function safetyAckBody(floorKcal: number): string {
  return (
    `This pace puts your daily target below ${floorKcal.toLocaleString()} kcal. ` +
    `NHS and NIH guidance generally advises against eating below ` +
    `${floorKcal.toLocaleString()} kcal/day without medical supervision. ` +
    `You can still set it — if a clinician has prescribed a lower intake, ` +
    `continue under their care. Not suitable if you're pregnant, under 18, ` +
    `or managing a medical condition.`
  );
}

/** The explicit checkbox / toggle label the user taps to acknowledge. */
export const SAFETY_ACK_CONFIRM_LABEL =
  "I understand this is below the recommended minimum";

/**
 * Pure gate: may the editor save right now, given the floor + ack state?
 *
 * Returns `false` ONLY when the target is below the safety floor AND the
 * user has not acknowledged. Everything else (above floor, or below +
 * acknowledged) returns `true`. The composition roots call this so the
 * web dialog and the mobile sheet can't implement the gate differently.
 */
export function canSaveBelowFloor(input: {
  belowSafetyFloor: boolean;
  acknowledged: boolean;
}): boolean {
  if (!input.belowSafetyFloor) return true;
  return input.acknowledged;
}

/**
 * Parse a fibre goal input (whole grams) back to g. Returns `null` for
 * blank / non-finite / non-positive input so the caller can treat an
 * empty field as "no explicit edit this session".
 */
export function parseFiberInputToG(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

/**
 * True when the edited fibre differs from the seated profile value.
 * Blank / invalid input is NOT treated as a change — the user must
 * enter a positive whole-gram value to commit a fibre edit (ENG-846).
 */
export function fiberGoalChanged(
  seatedFiberG: number | null | undefined,
  editedFiberG: number | null,
): boolean {
  if (editedFiberG == null) return false;
  if (seatedFiberG == null || seatedFiberG <= 0) return true;
  return Math.round(seatedFiberG) !== Math.round(editedFiberG);
}

/** Re-export so a single import covers the editor's pace types. */
export type { Goal, PlanPace };
