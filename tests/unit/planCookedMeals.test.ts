import { describe, expect, it } from "vitest";

import {
  countPlanDayCookedMeals,
  isPlanMealCooked,
  journalEntriesForPlanDate,
  planDayCookedFlags,
} from "../../src/lib/planning/planCookedMeals";

describe("planCookedMeals", () => {
  it("matches by recipeId first", () => {
    expect(
      isPlanMealCooked(
        { recipeId: "r1", recipeTitle: "Stew" },
        [{ recipeId: "r1", name: "Other" }],
      ),
    ).toBe(true);
  });

  it("falls back to normalized title when ids differ", () => {
    expect(
      isPlanMealCooked(
        { recipeTitle: "Harissa Chickpea Stew" },
        [{ name: "harissa chickpea stew" }],
      ),
    ).toBe(true);
  });

  it("ignores placeholders and empty plans", () => {
    expect(isPlanMealCooked({ isPlaceholder: true, recipeTitle: "X" }, [{ name: "X" }])).toBe(
      false,
    );
    expect(isPlanMealCooked({ recipeTitle: "" }, [{ name: "Soup" }])).toBe(false);
  });

  it("counts and flags per slot", () => {
    const meals = [
      { recipeId: "a", recipeTitle: "A" },
      { recipeTitle: "B" },
      { isPlaceholder: true, recipeTitle: "C" },
    ];
    const logged = [{ recipeId: "a" }, { recipeTitle: "B" }];
    expect(countPlanDayCookedMeals(meals, logged)).toBe(2);
    expect(planDayCookedFlags(meals, logged)).toEqual([true, true, false]);
  });

  it("reads journal rows by local date key", () => {
    const d = new Date(2026, 5, 28);
    const journal = {
      "2026-06-28": [{ recipeTitle: "Lunch bowl" }],
    };
    expect(journalEntriesForPlanDate(journal, d)).toHaveLength(1);
    expect(journalEntriesForPlanDate(undefined, d)).toEqual([]);
  });
});
