/**
 * whyThisNumber — pure helper that explains how today's calorie target
 * was derived. Used by the "Why this number?" sheet on Today (mobile)
 * and the equivalent dialog (web).
 *
 * Closes audit gap #10 (transparency moat). Every competitor —
 * MacroFactor, Lose It, MyFitnessPal — is opaque about WHY today's
 * target is X kcal. Suppr already computes the maintenance TDEE
 * (`adaptive_tdee` or formula fallback) and the goal/pace stored on
 * the profile; this helper turns those into plain-English copy.
 *
 * Pure function — no I/O, no Date access, no React. Safe to call from
 * both platforms and from tests.
 *
 * Voice rules (production design spec §1.7):
 *   - UK English where natural, but "calories" stays "calories" (the
 *     user-facing unit is kcal).
 *   - Second person.
 *   - No exclamation marks. Restrained, factual.
 *   - Always-on per D-2026-04-27-12: we never refuse to render. When
 *     confidence is low we say so in plain English instead of hiding.
 */

export type WhyThisNumberGoal = "lose" | "maintain" | "gain";

export interface WhyThisNumberInput {
  /** Today's calorie target as it appears on the ring. Required. */
  targetCalories: number;
  /** Maintenance TDEE — adaptive when we have it, formula fallback
   *  otherwise. `null` means we have no estimate yet (calibrating). */
  maintenanceTdee: number | null;
  /** TDEE confidence from the adaptive engine. `null` when no estimate. */
  confidence: "low" | "medium" | "high" | null;
  /** Days of logging behind the maintenance estimate. Used to qualify
   *  the "adaptive" wording — < 14 days reads "early estimate". */
  loggingDays?: number | null;
  /** User's stated goal direction. */
  goal: WhyThisNumberGoal;
  /**
   * Weekly weight-change pace target in kg/week. Negative for losing,
   * positive for gaining, 0 for maintaining. We don't infer sign from
   * `goal` — `plan_pace` is stored separately and may be 0 even when
   * goal=lose (paused / maintenance mode). The helper trusts whatever
   * the caller passed.
   */
  paceKgPerWeek: number;
}

export interface WhyThisNumberLine {
  /** Stable id for keyed list rendering. */
  key: "tdee" | "goal" | "result";
  /** Short label on the left of the row (e.g. "TDEE"). */
  label: string;
  /** The value or qualifier on the right (e.g. "2,150 kcal"). */
  value: string;
}

export interface WhyThisNumberResult {
  /** Headline copy: "Today's target: 1,800 kcal". */
  targetHeadline: string;
  /** Three short rows that explain the math. Render in order. */
  lines: WhyThisNumberLine[];
  /**
   * Plain-English summary sentence — used by mobile bottom sheet
   * subhead and screen-reader announcements. Always present.
   */
  summary: string;
  /** True when the maintenance number is explicitly an early estimate
   *  (loggingDays < 14 OR confidence = "low"). Renderer can use this to
   *  add a calibrating chip / italic qualifier. */
  isEarlyEstimate: boolean;
}

/** ~7700 kcal per kg of body fat. Conservative round. */
const KCAL_PER_KG_FAT = 7700;
const KCAL_PER_DAY_PER_WEEKLY_KG = KCAL_PER_KG_FAT / 7;

/**
 * Map the legacy `plan_pace` preset enum stored on `profiles.plan_pace`
 * to a kg/week magnitude. Sign comes from the goal (lose → negative,
 * gain → positive, maintain → 0). Mirrors the constants in
 * `src/lib/nutrition/tdee.ts:PACE_WEEKLY_KG` — when those move, update
 * here in lockstep.
 */
export function paceKgPerWeekFromPreset(
  preset: string | null | undefined,
  goal: WhyThisNumberGoal,
): number {
  if (goal === "maintain") return 0;
  let mag: number;
  switch (preset) {
    case "relaxed":
      mag = 0.25;
      break;
    case "steady":
      mag = 0.5;
      break;
    case "accelerated":
      mag = 0.75;
      break;
    case "vigorous":
      mag = 1.0;
      break;
    default:
      return 0;
  }
  return goal === "lose" ? -mag : mag;
}

function fmtKcal(n: number): string {
  return `${Math.round(n).toLocaleString()} kcal`;
}

function fmtPaceKg(paceKg: number): string {
  // Round to 0.05 to avoid surfacing noisy float arithmetic.
  const rounded = Math.round(paceKg * 20) / 20;
  // Strip a trailing `.0` for tidy display ("0.5 kg/wk" not "0.50 kg/wk").
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")} kg/wk`;
}

function goalLabel(goal: WhyThisNumberGoal, paceKg: number): string {
  if (goal === "maintain" || paceKg === 0) return "Maintain";
  if (goal === "lose") return `Lose ${fmtPaceKg(Math.abs(paceKg))}`.replace("+", "");
  return `Gain ${fmtPaceKg(Math.abs(paceKg))}`.replace("+", "");
}

/**
 * Build the breakdown rows + summary sentence. Pure.
 */
export function buildWhyThisNumber(
  input: WhyThisNumberInput,
): WhyThisNumberResult {
  const { targetCalories, maintenanceTdee, confidence, goal, paceKgPerWeek } = input;
  const loggingDays = input.loggingDays ?? null;

  const isEarlyEstimate =
    maintenanceTdee != null &&
    (confidence === "low" || (loggingDays != null && loggingDays < 14));

  // -- Row 1: TDEE / maintenance estimate --------------------------
  let tdeeLabel = "Maintenance (TDEE)";
  let tdeeValue: string;
  if (maintenanceTdee != null && maintenanceTdee > 0) {
    if (isEarlyEstimate) {
      tdeeValue = `~${fmtKcal(maintenanceTdee)} (early estimate)`;
    } else {
      tdeeValue = `${fmtKcal(maintenanceTdee)} (adaptive, last 7 days)`;
    }
  } else {
    tdeeValue = "calibrating — keep logging";
    tdeeLabel = "Maintenance (TDEE)";
  }

  // -- Row 2: Goal & pace ------------------------------------------
  const goalValue = goalLabel(goal, paceKgPerWeek);

  // -- Row 3: Result (the deficit / surplus we landed at) ----------
  // Prefer the actual delta (target - tdee) when we have a tdee.
  // Otherwise express the implied deficit from the user's pace
  // (kg/week → kcal/day) so the user still sees the math.
  let resultValue: string;
  if (maintenanceTdee != null && maintenanceTdee > 0) {
    const delta = targetCalories - maintenanceTdee;
    const absDelta = Math.abs(Math.round(delta));
    if (delta < 0) {
      resultValue = `−${absDelta.toLocaleString()} kcal/day deficit`;
    } else if (delta > 0) {
      resultValue = `+${absDelta.toLocaleString()} kcal/day surplus`;
    } else {
      resultValue = "no deficit (maintaining)";
    }
  } else {
    // No TDEE yet → derive from pace.
    const impliedDelta = paceKgPerWeek * KCAL_PER_DAY_PER_WEEKLY_KG;
    const abs = Math.abs(Math.round(impliedDelta));
    if (paceKgPerWeek < 0) resultValue = `−${abs.toLocaleString()} kcal/day deficit (target)`;
    else if (paceKgPerWeek > 0) resultValue = `+${abs.toLocaleString()} kcal/day surplus (target)`;
    else resultValue = "no deficit (maintaining)";
  }

  const lines: WhyThisNumberLine[] = [
    { key: "tdee", label: tdeeLabel, value: tdeeValue },
    { key: "goal", label: "Goal", value: goalValue },
    { key: "result", label: "Result", value: resultValue },
  ];

  // Summary — one sentence that strings the same numbers together for
  // screen readers and the sheet subhead.
  let summary: string;
  if (maintenanceTdee != null && maintenanceTdee > 0) {
    const direction =
      targetCalories < maintenanceTdee
        ? "below"
        : targetCalories > maintenanceTdee
          ? "above"
          : "at";
    summary = `Your target sits ${direction} your estimated maintenance of ${fmtKcal(
      maintenanceTdee,
    )} so you trend toward your ${goalValue.toLowerCase()} goal.`;
  } else {
    summary =
      "We're still calibrating your maintenance — your target is based on your stated goal and weekly pace.";
  }

  return {
    targetHeadline: `Today's target: ${fmtKcal(targetCalories)}`,
    lines,
    summary,
    isEarlyEstimate: Boolean(isEarlyEstimate),
  };
}
