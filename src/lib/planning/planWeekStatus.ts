/**
 * planWeekStatus — the v3 Plan tab's "planning completeness" verdict + per-day
 * status. Distinct from `planWeekSummary` (which scores calorie ACCURACY).
 *
 * v3 source of truth: `docs/ux/redesign/v3/Sloe-App.html` Plan screen
 * (~L4704–4734). The Plan headline answers "is your week planned?" — a day
 * "lands" when ≥3 of its main slots (Breakfast / Lunch / Dinner) hold a real,
 * calorie-bearing meal. Snacks do NOT count toward the threshold. The per-day
 * week-strip ring shows `full` (≥3) / `part` (1–2) / `empty` (0). The headline
 * reads "On track — N of M days land" with a "{M−N} days need a meal or swap"
 * nudge, or "Every day lands on target" when all land.
 *
 * This is planning GAPS, not calorie accuracy — the day-detail calorie band
 * carries the per-day kcal-vs-target read separately (see the Plan day card).
 *
 * Pure + shared so web (`@/lib/planning/planWeekStatus`) and mobile
 * (`@suppr/shared/planning/planWeekStatus`) can never drift on the threshold or
 * the copy.
 */

export type PlanDayStatus = "full" | "part" | "empty";

/** Minimal per-meal shape the status derivation needs. Callers map their own
 *  plan meal (web `DayPlanMeal` / mobile plan slot) down to this. */
export interface PlanStatusMeal {
  /** Canonical slot name — "Breakfast" | "Lunch" | "Dinner" | "Snacks" | … */
  slot: string;
  /** Calories for the meal; a filled slot has a finite, positive value. */
  kcal?: number | null;
  /** Explicit "no recipe here yet" marker (a placeholder slot row). */
  empty?: boolean;
}

/** The main slots whose presence defines a day "landing" (v3: B/L/D only —
 *  Snacks are bonus and never gate the verdict). */
export const PLAN_MAIN_SLOTS = ["Breakfast", "Lunch", "Dinner"] as const;

/** Does this meal count as a real, calorie-bearing entry (not an empty slot)? */
function isFilled(meal: PlanStatusMeal): boolean {
  return (
    !meal.empty &&
    Number.isFinite(meal.kcal) &&
    (meal.kcal ?? 0) > 0
  );
}

/** Count of main slots (B/L/D) holding a real meal on this day. */
export function countPlanDayMainSlotsFilled(
  meals: readonly PlanStatusMeal[] | null | undefined,
): number {
  if (!meals || meals.length === 0) return 0;
  return PLAN_MAIN_SLOTS.filter((slot) =>
    meals.some((m) => m.slot === slot && isFilled(m)),
  ).length;
}

/** Per-day status ring state for the week strip. */
export function computePlanDayStatus(
  meals: readonly PlanStatusMeal[] | null | undefined,
): PlanDayStatus {
  const filled = countPlanDayMainSlotsFilled(meals);
  return filled >= 3 ? "full" : filled > 0 ? "part" : "empty";
}

export interface PlanWeekVerdict {
  /** Days that fully land (all 3 main slots filled). */
  daysHit: number;
  /** Total days in the plan (1 / 3 / 7 supported). */
  total: number;
  /** Headline copy — "Every day lands on target" | "On track — N of M days land". */
  headline: string;
  /** Nudge subline, or `null` when every day lands. */
  subline: string | null;
  /** Verdict dot/headline tone — `success` only when every day lands. */
  tone: "success" | "warning";
}

/**
 * Compute the v3 Plan week verdict from the week's meals.
 *
 * `week` is an array of per-day meal lists (already mapped to {@link
 * PlanStatusMeal}). Returns `null` for an empty/absent plan so the caller can
 * skip the verdict row (and render the empty/generating state instead).
 */
export function computePlanWeekVerdict(
  week: readonly (readonly PlanStatusMeal[])[] | null | undefined,
): PlanWeekVerdict | null {
  if (!week || week.length === 0) return null;
  const total = week.length;
  const daysHit = week.filter(
    (day) => computePlanDayStatus(day) === "full",
  ).length;
  const allLand = daysHit >= total;
  const remaining = total - daysHit;
  return {
    daysHit,
    total,
    headline: allLand
      ? "Every day lands on target"
      : `On track — ${daysHit} of ${total} days land`,
    subline: allLand
      ? null
      : `${remaining} ${remaining === 1 ? "day needs" : "days need"} a meal or swap`,
    tone: allLand ? "success" : "warning",
  };
}
