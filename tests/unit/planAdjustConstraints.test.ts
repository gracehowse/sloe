import { describe, expect, it } from "vitest";

import {
  CALORIE_FLOOR_MAX,
  CALORIE_FLOOR_MIN,
  clampCalorieFloor,
  enabledSlotsForMealsPerDay,
  mealsPerDayFromEnabledSlots,
} from "../../src/lib/planning/planAdjustConstraints";

describe("planAdjustConstraints (ENG-1247 / B1)", () => {
  it("maps meals-per-day to enabled slot sets", () => {
    expect([...enabledSlotsForMealsPerDay(3)]).toEqual(["Breakfast", "Lunch", "Dinner"]);
    expect([...enabledSlotsForMealsPerDay(4)]).toEqual([
      "Breakfast",
      "Lunch",
      "Dinner",
      "Snacks",
    ]);
  });

  it("derives meals-per-day from enabled slots", () => {
    expect(mealsPerDayFromEnabledSlots(new Set(["Breakfast", "Lunch", "Dinner"]))).toBe(3);
    expect(
      mealsPerDayFromEnabledSlots(
        new Set(["Breakfast", "Lunch", "Dinner", "Snacks"]),
      ),
    ).toBe(4);
  });

  it("clamps calorie floor to prototype bounds on 50 kcal steps", () => {
    expect(clampCalorieFloor(1199)).toBe(CALORIE_FLOOR_MIN);
    expect(clampCalorieFloor(2201)).toBe(CALORIE_FLOOR_MAX);
    expect(clampCalorieFloor(1473)).toBe(1450);
  });
});
