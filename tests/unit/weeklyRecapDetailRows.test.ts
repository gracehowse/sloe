import { describe, expect, it } from "vitest";

import {
  deriveMostCookedMeal,
  deriveWeeklyRecapDetailRows,
  formatWeightDeltaSubtitle,
} from "../../src/lib/nutrition-core/weeklyRecapDetailRows";

describe("weeklyRecapDetailRows (ENG-1259)", () => {
  it("formats weight delta with sign", () => {
    expect(formatWeightDeltaSubtitle(74.3, 73.7)).toBe("−0.6 kg this week");
    expect(formatWeightDeltaSubtitle(70, 70.4)).toBe("+0.4 kg this week");
  });

  it("derives all four rows when data exists", () => {
    const rows = deriveWeeklyRecapDetailRows({
      weightStartKg: 74.3,
      weightEndKg: 73.7,
      weighInsInWindow: 3,
      streakDays: 12,
      meals: [
        { recipeTitle: "Harissa chickpea stew" },
        { recipeTitle: "Harissa chickpea stew" },
        { recipeTitle: "Harissa chickpea stew" },
        { name: "Oats" },
      ],
      avgProteinG: 118,
      daysLogged: 5,
    });
    expect(rows.map((r) => r.id)).toEqual(["weight", "streak", "most-cooked", "protein"]);
    expect(rows[2]?.subtitle).toContain("Harissa chickpea stew");
  });

  it("omits weight without two weigh-ins", () => {
    const rows = deriveWeeklyRecapDetailRows({
      weightStartKg: 74,
      weightEndKg: 74,
      weighInsInWindow: 1,
      streakDays: 2,
      meals: [],
      avgProteinG: 90,
      daysLogged: 2,
    });
    expect(rows.map((r) => r.id)).toEqual(["streak", "protein"]);
  });

  it("deriveMostCookedMeal picks the top title", () => {
    expect(
      deriveMostCookedMeal([
        { recipeTitle: "A" },
        { recipeTitle: "B" },
        { recipeTitle: "B" },
      ]),
    ).toEqual({ title: "B", count: 2 });
  });
});
