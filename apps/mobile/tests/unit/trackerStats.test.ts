/**
 * Mobile unit tests for tracker statistics (logging streaks, weekly logged days).
 * These test the shared logic via the mobile re-export path.
 */
import { describe, it, expect } from "vitest";
import {
  computeLoggingStreak,
  computeWeekLoggedDays,
} from "../../../../src/lib/nutrition/trackerStats";
import type { LoggedMeal } from "../../../../src/types/recipe";

function meal(cals = 500): LoggedMeal {
  return { id: "test-1", name: "Test meal", recipeTitle: "", time: "12:00", calories: cals, protein: 30, carbs: 50, fat: 15 };
}

describe("computeLoggingStreak", () => {
  it("returns 0 when no meals logged", () => {
    expect(computeLoggingStreak({}, new Date("2026-04-15"))).toBe(0);
  });

  it("returns 1 when only today is logged", () => {
    const data = { "2026-04-15": [meal()] };
    expect(computeLoggingStreak(data, new Date("2026-04-15T14:00:00"))).toBe(1);
  });

  it("counts consecutive days ending today", () => {
    const data = {
      "2026-04-13": [meal()],
      "2026-04-14": [meal()],
      "2026-04-15": [meal()],
    };
    expect(computeLoggingStreak(data, new Date("2026-04-15T10:00:00"))).toBe(3);
  });

  it("allows yesterday as last day if today is empty", () => {
    const data = {
      "2026-04-13": [meal()],
      "2026-04-14": [meal()],
    };
    expect(computeLoggingStreak(data, new Date("2026-04-15T08:00:00"))).toBe(2);
  });

  it("breaks streak on gap day", () => {
    const data = {
      "2026-04-12": [meal()],
      // 2026-04-13 missing
      "2026-04-14": [meal()],
      "2026-04-15": [meal()],
    };
    expect(computeLoggingStreak(data, new Date("2026-04-15T10:00:00"))).toBe(2);
  });
});

describe("computeWeekLoggedDays", () => {
  it("returns 0 logged when no meals", () => {
    const result = computeWeekLoggedDays({}, new Date("2026-04-15"));
    expect(result).toEqual({ logged: 0, total: 7 });
  });

  it("counts days with meals in current ISO week", () => {
    // 2026-04-13 is Monday, 2026-04-15 is Wednesday
    const data = {
      "2026-04-13": [meal()],
      "2026-04-15": [meal()],
    };
    const result = computeWeekLoggedDays(data, new Date("2026-04-15T12:00:00"));
    expect(result.logged).toBe(2);
    expect(result.total).toBe(7);
  });
});
