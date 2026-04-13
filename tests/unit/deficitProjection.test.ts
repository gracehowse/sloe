import { describe, expect, it } from "vitest";
import {
  KCAL_PER_KG_FAT_EQUIV,
  rollingDeficitStats,
  sumDayCalories,
  todayFoodBalanceKcal,
} from "@/lib/nutrition/deficitProjection";
import type { LoggedMeal } from "@/types/recipe";

const meal = (cals: number): LoggedMeal => ({
  id: "x",
  name: "Lunch",
  recipeTitle: "t",
  time: "12:00",
  calories: cals,
  protein: 0,
  carbs: 0,
  fat: 0,
});

describe("rollingDeficitStats", () => {
  it("returns nulls when no logged days", () => {
    const fixed = new Date(2026, 3, 10, 12, 0, 0);
    const r = rollingDeficitStats({}, 2000, 7, fixed);
    expect(r.loggedDayCount).toBe(0);
    expect(r.avgDailyDeficitKcal).toBeNull();
  });

  it("averages deficits on logged days only", () => {
    const fixed = new Date(2026, 3, 10, 12, 0, 0);
    const nutrition: Record<string, LoggedMeal[]> = {
      "2026-04-10": [meal(1500)], // -500 vs 2000
      "2026-04-09": [meal(1800)], // -200
      "2026-04-08": [meal(2200)], // +200 (surplus)
    };
    const r = rollingDeficitStats(nutrition, 2000, 7, fixed);
    expect(r.loggedDayCount).toBe(3);
    // target − eaten: +500 (under), +200 (under), −200 (over)
    expect(r.avgDailyDeficitKcal).toBe(Math.round((500 + 200 - 200) / 3));
    expect(r.projectedWeekDeficitKcal).toBe(
      Math.round(((500 + 200 - 200) / 3) * 7),
    );
    if (r.projectedWeekDeficitKcal! > 0 && r.fatKgEquivalentIfWeekHeld != null) {
      expect(r.fatKgEquivalentIfWeekHeld).toBeCloseTo(r.projectedWeekDeficitKcal / KCAL_PER_KG_FAT_EQUIV, 1);
    }
  });
});

describe("sumDayCalories & todayFoodBalanceKcal", () => {
  it("sums calories", () => {
    expect(sumDayCalories([meal(100), meal(50)])).toBe(150);
  });
  it("today balance", () => {
    expect(todayFoodBalanceKcal(1500, 2000)).toBe(500);
    expect(todayFoodBalanceKcal(2200, 2000)).toBe(-200);
  });
});
