/**
 * Plan "Adjust constraints" sheet state (ENG-1247 / B1).
 *
 * Prototype: `docs/ux/redesign/v3/Sloe-App.html` `AdjustConstraints` (~L7256).
 * Shared web↔mobile so the sheet can't drift on meals-per-day mapping or defaults.
 */
import {
  DEFAULT_PLAN_SOURCE_MODE,
  type PlanSourceMode,
} from "./planSource";

/** Prototype offers 3 / 4 / 5 — live plan has four canonical slots (B/L/D/Snacks). */
export type MealsPerDay = 3 | 4;

export interface PlanAdjustConstraints {
  source: PlanSourceMode;
  /** Daily calorie floor (prototype slider 1200–2200). Wired into mealPlanAlgo via `calorieFloorMin` (ENG-1254). */
  calorieFloor: number;
  mealsPerDay: MealsPerDay;
  allowBatchLeftovers: boolean;
}

export const CALORIE_FLOOR_MIN = 1200;
export const CALORIE_FLOOR_MAX = 2200;
export const CALORIE_FLOOR_STEP = 50;

export const DEFAULT_PLAN_ADJUST_CONSTRAINTS: PlanAdjustConstraints = {
  source: DEFAULT_PLAN_SOURCE_MODE,
  calorieFloor: 1450,
  mealsPerDay: 4,
  allowBatchLeftovers: true,
};

const SLOT_ORDER = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

/** Map prototype meals-per-day to the enabled slot set used by the planner. */
export function enabledSlotsForMealsPerDay(mealsPerDay: MealsPerDay): Set<string> {
  return new Set(SLOT_ORDER.slice(0, mealsPerDay));
}

/** Inverse of {@link enabledSlotsForMealsPerDay} for hydrating the sheet from planner state. */
export function mealsPerDayFromEnabledSlots(enabled: ReadonlySet<string>): MealsPerDay {
  return enabled.has("Snacks") ? 4 : 3;
}

export function clampCalorieFloor(value: number): number {
  const stepped =
    Math.round(value / CALORIE_FLOOR_STEP) * CALORIE_FLOOR_STEP;
  return Math.min(CALORIE_FLOOR_MAX, Math.max(CALORIE_FLOOR_MIN, stepped));
}
