import type { LoggedMeal } from "../../types/recipe";
import { dateKeyFromDate } from "../dates/dateKey";
export { dateKeyFromDate } from "../dates/dateKey";
import { sumDayFiberFromMeals } from "./microNutrientDisplay";


function sumCalories(meals: LoggedMeal[]): number {
  return meals.reduce((a, m) => a + Math.max(0, m.calories), 0);
}

function sumFiber(meals: LoggedMeal[]): number {
  return sumDayFiberFromMeals(meals);
}

function sumWaterFromMeals(meals: LoggedMeal[]): number {
  return meals.reduce((a, m) => a + (m.waterMl ?? 0), 0);
}

/** Consecutive days ending today or yesterday with at least one logged meal. */
export function computeLoggingStreak(
  nutritionByDay: Record<string, LoggedMeal[]>,
  now: Date = new Date(),
): number {
  let streak = 0;
  const d = new Date(now);
  const todayKey = dateKeyFromDate(d);
  const todayMeals = nutritionByDay[todayKey] ?? [];
  if (todayMeals.length === 0) {
    d.setDate(d.getDate() - 1);
  }
  for (;;) {
    const key = dateKeyFromDate(d);
    const meals = nutritionByDay[key] ?? [];
    if (meals.length === 0) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/** Days in the current ISO week (Mon–Sun) with at least one logged meal. */
export function computeWeekLoggedDays(
  nutritionByDay: Record<string, LoggedMeal[]>,
  now: Date = new Date(),
): { logged: number; total: 7 } {
  const d = new Date(now);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  let logged = 0;
  for (let i = 0; i < 7; i++) {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    const key = dateKeyFromDate(x);
    if ((nutritionByDay[key] ?? []).length > 0) logged++;
  }
  return { logged, total: 7 };
}

/**
 * Average closeness to calorie target (0–100) over the last `days` calendar days with ≥1 meal.
 * Uses absolute target; no per-day activity adjustment.
 */
export function computeCalorieGoalFitPercent(
  nutritionByDay: Record<string, LoggedMeal[]>,
  calorieTarget: number,
  rollingDays: number,
  now: Date = new Date(),
): number | null {
  if (calorieTarget <= 0) return null;
  const scores: number[] = [];
  for (let i = 0; i < rollingDays; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = dateKeyFromDate(d);
    const meals = nutritionByDay[key] ?? [];
    if (meals.length === 0) continue;
    const cals = sumCalories(meals);
    const err = Math.abs(cals - calorieTarget) / calorieTarget;
    const fit = Math.max(0, 100 - Math.min(100, err * 100));
    scores.push(fit);
  }
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/** Mon–Sun: count days meeting fiber / water goals (≥ target). Empty days count as not met. */
export function computeWeekFiberWaterHits(
  nutritionByDay: Record<string, LoggedMeal[]>,
  extraWaterByDay: Record<string, number> | undefined,
  fiberGoal: number,
  waterGoalMl: number,
  now: Date = new Date(),
): { fiberDaysMet: number; waterDaysMet: number; total: 7 } {
  const d = new Date(now);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  let fiberDaysMet = 0;
  let waterDaysMet = 0;
  for (let i = 0; i < 7; i++) {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    const key = dateKeyFromDate(x);
    const meals = nutritionByDay[key] ?? [];
    const fiber = sumFiber(meals);
    const waterMl = sumWaterFromMeals(meals) + (extraWaterByDay?.[key] ?? 0);
    if (fiberGoal > 0 && fiber >= fiberGoal) fiberDaysMet++;
    if (waterGoalMl > 0 && waterMl >= waterGoalMl) waterDaysMet++;
  }
  return { fiberDaysMet, waterDaysMet, total: 7 };
}
