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

/**
 * ENG-1372 (empty-state grammar, Plan empty-week) — true iff the ENTIRE week
 * has zero real meals in ANY slot (Snacks included, unlike {@link
 * computePlanDayStatus}'s B/L/D-only "lands" threshold — this is a stricter,
 * simpler check: has the user planned literally nothing yet?). `null`/empty
 * `week`, or a week where every day's every slot is a placeholder, both
 * count as empty. Drives the warm invitation card that replaces the dashed-
 * box wall + zero-triad ("0 of 7 days land" / "0 / 1,900" / "P 0g C 0g F
 * 0g") — those numbers are derived noise on a week with nothing planned,
 * not a real status (law 3).
 */
export function isPlanWeekEmpty(
  week: readonly (readonly PlanStatusMeal[])[] | null | undefined,
): boolean {
  if (!week || week.length === 0) return true;
  return week.every((day) => !day || day.every((m) => !isFilled(m)));
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
  /** Verdict dot tone. `success` (green) when every day lands; `neutral`
   *  (calm dot) while a plan is still filling in — "On track" is progress,
   *  not a problem, so it must NOT wear the amber warning dot (ENG-1557...
   *  ENG-1547: the "On track" + amber contradiction). `warning` is reserved
   *  for a genuine problem state (none is currently emitted at week level). */
  tone: "success" | "neutral" | "warning";
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
    // ENG-1547 — a partially-filled week is progress, not a warning: "On
    // track — N of M days land" pairs with a calm neutral dot, not amber.
    tone: allLand ? "success" : "neutral",
  };
}

export interface PlanDayDetail {
  /** Foot subline copy under the calorie band. */
  subline: string;
  /** Progress-bar fill fraction 0..1 (capped at full). */
  barPct: number;
  /** Bar/headline tone — `warning` only when meaningfully over target. */
  tone: "success" | "warning";
}

/**
 * Per-day calorie-band detail for the v3 Plan day card (prototype Plan
 * `plan-day` ~L4776-4778): the fill %, the tone, and the gap subline. Shared so
 * web + mobile read the same thresholds.
 *
 * - `plannedCount === 0` → "Nothing planned yet"
 * - gap > 250 under → "≈{gap} kcal short — room for more"
 * - gap < −200 (i.e. > 200 over) → "≈{over} over target"
 * - otherwise → "Lands on target"
 * - appends " · {n} cooked" when any slot is cooked.
 * Bar tone goes `warning` once the day runs > 200 kcal over target.
 */
export function computePlanDayDetail(
  dayTotalKcal: number,
  targetKcal: number,
  plannedCount: number,
  cookedCount: number,
): PlanDayDetail {
  const gap = targetKcal - dayTotalKcal;
  let subline: string;
  if (plannedCount <= 0) {
    subline = "Nothing planned yet";
  } else if (gap > 250) {
    subline = `≈${Math.round(gap)} kcal short — room for more`;
  } else if (gap < -200) {
    subline = `≈${Math.round(Math.abs(gap))} over target`;
  } else {
    subline = "Lands on target";
  }
  if (cookedCount > 0) {
    subline += ` · ${cookedCount} cooked`;
  }
  const barPct =
    targetKcal > 0 ? Math.min(1, Math.max(0, dayTotalKcal / targetKcal)) : 0;
  const tone: "success" | "warning" =
    dayTotalKcal > targetKcal + 200 ? "warning" : "success";
  return { subline, barPct, tone };
}
