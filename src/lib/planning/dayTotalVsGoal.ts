/**
 * Build-12 H-5 — shared helper for the "day total vs goal" summary line
 * rendered under each day in the Plan view.
 *
 * Lives here (not in `nutrition/`) because it's planner-UI math, not a
 * nutrition model. Both platforms call the same exports:
 *   - web:    `src/app/components/MealPlanner.tsx`
 *   - mobile: `apps/mobile/app/(tabs)/planner.tsx`
 *
 * Non-negotiables from the spec (TestFlight `AH8csBqtZsBJJr0uHgXyEcE`):
 * - Day totals are the sum of each slot's **display** macros (same numbers
 *   as the meal rows). `dayPlanTotalsFromMeals` centralises placeholder skip +
 *   rounding; portion scale must already be baked into each meal (F-70).
 * - Tolerance is *directional* — only OVER-goal escalates (ENG design
 *   review 2026-06-13: an under/empty day must NOT read as a warning):
 *     actual <= goal              → neutral  (under/at goal is the calm,
 *                                             expected state; an empty day
 *                                             at 0 reads neutral, not amber)
 *     0 < over/goal <= 10%        → neutral  (within band)
 *     10% < over/goal <= 20%      → amber    (edge of band)
 *     over/goal > 20%             → red      (severity only; the day-total
 *       renderers collapse this to amber per the 2026-04-25 "over-budget
 *       reads amber, not red" carryover rule — red stays reserved for the
 *       calorie ring's over-state).
 * - When any of the four goals (cal/P/C/F) is `<= 0` or non-finite, the
 *   whole line is omitted (`hasTargets: false`). Goal=0 never triggers
 *   a divide-by-zero; the cell gets `tone: "neutral"` with `goal: 0`
 *   but the caller should check `hasTargets` first and skip rendering.
 * - 0-meal days collapse to `{0,0,0,0}` totals; if goals exist the
 *   cells simply read `0 / goal` with the classifier applied.
 */

import { dayPlanTotalsFromMeals } from "../nutrition/portionMultiplier";
import type { DayPlanMeal } from "../../types/recipe.ts";

export type DayTotalTone = "neutral" | "amber" | "red";

/** Raw numeric day totals after portion scaling. */
export interface DayTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DayTotalVsGoalInputs {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DayTotalVsGoalCell {
  /** Stable key — "calories" | "protein" | "carbs" | "fat". */
  key: "calories" | "protein" | "carbs" | "fat";
  /** Short label rendered in the summary line: "kcal" | "P" | "C" | "F". */
  label: string;
  actual: number;
  goal: number;
  /** "kcal" for calories, "g" for macros. */
  unit: "kcal" | "g";
  tone: DayTotalTone;
}

export interface DayTotalVsGoalLine {
  /**
   * `true` when every cal/P/C/F goal is a positive finite number.
   * When `false`, callers MUST skip rendering the summary line (new
   * accounts without a set goal).
   */
  hasTargets: boolean;
  totals: DayTotals;
  cells: DayTotalVsGoalCell[];
}

/** Directional tolerance bands (over-goal only). See module header. */
export const DAY_TOTAL_NEUTRAL_BAND = 0.1;
export const DAY_TOTAL_AMBER_BAND = 0.2;

/**
 * Classify actual-vs-goal by how far OVER goal the day runs. Under or at
 * goal is always `"neutral"` — a forward-looking plan never warns you for
 * being under, and an untouched day (actual 0) must read calm, not amber
 * (design review 2026-06-13).
 *
 * Returns `"neutral"` when `goal <= 0` or non-finite so the helper is
 * safe to call with missing goals without blowing up. Callers should
 * still gate rendering on `hasTargets` — a `"neutral"` tone with a
 * meaningless goal is not something the user should see.
 */
export function classifyDayDelta(actual: number, goal: number): DayTotalTone {
  if (!Number.isFinite(goal) || goal <= 0) return "neutral";
  if (!Number.isFinite(actual)) return "neutral";
  if (actual <= goal) return "neutral"; // under/at goal — calm, never a warning
  const overPct = (actual - goal) / goal; // > 0: over goal
  if (overPct <= DAY_TOTAL_NEUTRAL_BAND) return "neutral";
  if (overPct <= DAY_TOTAL_AMBER_BAND) return "amber";
  return "red";
}

function goalsAreSet(g: DayTotalVsGoalInputs): boolean {
  return (
    Number.isFinite(g.calories) && g.calories > 0 &&
    Number.isFinite(g.protein) && g.protein > 0 &&
    Number.isFinite(g.carbs) && g.carbs > 0 &&
    Number.isFinite(g.fat) && g.fat > 0
  );
}

/**
 * Build the full "Day total vs goal" summary line for one day. Totals
 * come from `dayPlanTotalsFromMeals` (sum of row display macros +
 * placeholder skip) and each macro is classified against its goal.
 */
export function buildDayTotalVsGoalLine(
  meals: DayPlanMeal[],
  goals: DayTotalVsGoalInputs,
): DayTotalVsGoalLine {
  const totals = dayPlanTotalsFromMeals(meals);
  const hasTargets = goalsAreSet(goals);
  const cells: DayTotalVsGoalCell[] = [
    {
      key: "calories",
      label: "kcal",
      actual: totals.calories,
      goal: hasTargets ? goals.calories : 0,
      unit: "kcal",
      tone: classifyDayDelta(totals.calories, goals.calories),
    },
    {
      key: "protein",
      label: "P",
      actual: totals.protein,
      goal: hasTargets ? goals.protein : 0,
      unit: "g",
      tone: classifyDayDelta(totals.protein, goals.protein),
    },
    {
      key: "carbs",
      label: "C",
      actual: totals.carbs,
      goal: hasTargets ? goals.carbs : 0,
      unit: "g",
      tone: classifyDayDelta(totals.carbs, goals.carbs),
    },
    {
      key: "fat",
      label: "F",
      actual: totals.fat,
      goal: hasTargets ? goals.fat : 0,
      unit: "g",
      tone: classifyDayDelta(totals.fat, goals.fat),
    },
  ];
  return { hasTargets, totals, cells };
}

/**
 * Render one cell as "P 103 / 120g" (macro) or "1,373 / 1,411 kcal"
 * (calories). Rounded to whole numbers on both sides; thousands
 * separator for readability. Pure string builder — no colour here;
 * callers style via `tone`.
 */
export function formatDayTotalCell(cell: DayTotalVsGoalCell): string {
  const actual = Math.round(cell.actual).toLocaleString();
  const goal = Math.round(cell.goal).toLocaleString();
  if (cell.key === "calories") {
    return `${actual} / ${goal} kcal`;
  }
  return `${cell.label} ${actual} / ${goal}${cell.unit}`;
}

/**
 * Render the full line as a single string. Used for the accessible
 * label on mobile and as the visual content on web — both platforms
 * still map `tone` → colour token separately.
 *
 * Example: "Day total · 1,373 / 1,411 kcal · P 103 / 120g · C 142 / 180g · F 45 / 55g"
 */
export function formatDayTotalVsGoalLine(line: DayTotalVsGoalLine): string {
  const parts = line.cells.map(formatDayTotalCell);
  return `Day total · ${parts.join(" · ")}`;
}
