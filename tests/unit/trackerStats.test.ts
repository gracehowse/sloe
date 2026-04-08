import { describe, expect, it } from "vitest";
import {
  computeCalorieGoalFitPercent,
  computeLoggingStreak,
  computeWeekLoggedDays,
  dateKeyFromDate,
} from "@/lib/nutrition/trackerStats";
import type { LoggedMeal } from "@/types/recipe";

const meal = (cals: number): LoggedMeal => ({
  id: "m",
  name: "Lunch",
  recipeTitle: "Test",
  time: "12:00",
  calories: cals,
  protein: 0,
  carbs: 0,
  fat: 0,
});

describe("trackerStats", () => {
  it("computes streak when today and yesterday logged", () => {
    const now = new Date(2026, 3, 8);
    const today = dateKeyFromDate(now);
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const yesterday = dateKeyFromDate(y);
    const byDay: Record<string, LoggedMeal[]> = {
      [today]: [meal(400)],
      [yesterday]: [meal(500)],
    };
    expect(computeLoggingStreak(byDay, now)).toBe(2);
  });

  it("returns null goal fit when no logged days", () => {
    expect(computeCalorieGoalFitPercent({}, 2000, 7)).toBeNull();
  });

  it("computes week logged days", () => {
    const now = new Date(2026, 3, 8);
    const wed = dateKeyFromDate(now);
    const byDay: Record<string, LoggedMeal[]> = { [wed]: [meal(100)] };
    const w = computeWeekLoggedDays(byDay, now);
    expect(w.total).toBe(7);
    expect(w.logged).toBeGreaterThanOrEqual(1);
  });
});
