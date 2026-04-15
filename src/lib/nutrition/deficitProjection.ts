import type { LoggedMeal } from "@/types/recipe";
import { dateKeyFromDate } from "@/lib/nutrition/trackerStats";

/** Nutrition labels often use ~7700 kcal per kg of adipose tissue as a rough equivalence. */
export const KCAL_PER_KG_FAT_EQUIV = 7700;

export function sumDayCalories(meals: LoggedMeal[] | undefined): number {
  if (!meals?.length) return 0;
  return meals.reduce((a, m) => a + Math.max(0, m.calories), 0);
}

/**
 * For each of the last `rollingDays` calendar days ending at `now`, compute (dailyTarget - intake)
 * for days with at least one logged meal. Used for "if this pace continued…" copy.
 */
export function rollingDeficitStats(
  nutritionByDay: Record<string, LoggedMeal[]>,
  dailyCalorieTarget: number,
  rollingDays: number,
  now: Date = new Date(),
): {
  loggedDayCount: number;
  avgDailyDeficitKcal: number | null;
  projectedWeekDeficitKcal: number | null;
  fatKgEquivalentIfWeekHeld: number | null;
} {
  if (dailyCalorieTarget <= 0 || rollingDays < 1) {
    return {
      loggedDayCount: 0,
      avgDailyDeficitKcal: null,
      projectedWeekDeficitKcal: null,
      fatKgEquivalentIfWeekHeld: null,
    };
  }

  const balances: number[] = [];
  for (let i = 0; i < rollingDays; i++) {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = dateKeyFromDate(d);
    const meals = nutritionByDay[key] ?? [];
    if (meals.length === 0) continue;
    const eaten = sumDayCalories(meals);
    balances.push(dailyCalorieTarget - eaten);
  }

  if (balances.length === 0) {
    return {
      loggedDayCount: 0,
      avgDailyDeficitKcal: null,
      projectedWeekDeficitKcal: null,
      fatKgEquivalentIfWeekHeld: null,
    };
  }

  const sum = balances.reduce((a, b) => a + b, 0);
  const avg = sum / balances.length;
  const projectedWeek = avg * 7;
  const fatKg = projectedWeek > 0 ? projectedWeek / KCAL_PER_KG_FAT_EQUIV : null;

  return {
    loggedDayCount: balances.length,
    avgDailyDeficitKcal: Math.round(avg),
    projectedWeekDeficitKcal: Math.round(projectedWeek),
    fatKgEquivalentIfWeekHeld: fatKg != null ? Math.round(fatKg * 10) / 10 : null,
  };
}

/** Today-only balance: positive = under budget (deficit vs food goal), negative = over. */
export function todayFoodBalanceKcal(eaten: number, netCalorieGoal: number): number {
  return netCalorieGoal - eaten;
}
