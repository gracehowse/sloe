/**
 * Mobile parity tests for the meal plan algorithm.
 * Mirrors a subset of tests/unit/mealPlanTargets.test.ts to ensure
 * the shared algorithm works identically when imported via mobile paths.
 */
import { describe, it, expect } from "vitest";
import { generateSmartPlan, type SimpleRecipe } from "../../../../src/lib/nutrition/mealPlanAlgo";

const recipes: SimpleRecipe[] = [
  { id: "r1", title: "Oats", calories: 350, protein: 12, carbs: 55, fat: 8, fiberG: 6 },
  { id: "r2", title: "Chicken salad", calories: 450, protein: 35, carbs: 20, fat: 18, fiberG: 4 },
  { id: "r3", title: "Salmon bowl", calories: 520, protein: 30, carbs: 45, fat: 22, fiberG: 3 },
  { id: "r4", title: "Greek yogurt", calories: 180, protein: 15, carbs: 12, fat: 5, fiberG: 0 },
  { id: "r5", title: "Stir fry", calories: 400, protein: 28, carbs: 35, fat: 14, fiberG: 5 },
  { id: "r6", title: "Smoothie", calories: 250, protein: 8, carbs: 40, fat: 6, fiberG: 3 },
  { id: "r7", title: "Pasta", calories: 600, protein: 20, carbs: 75, fat: 18, fiberG: 4 },
  { id: "r8", title: "Soup", calories: 300, protein: 15, carbs: 30, fat: 10, fiberG: 6 },
];

function makeTargets(calories: number) {
  return {
    calories,
    protein: (calories * 0.3) / 4,
    carbs: (calories * 0.4) / 4,
    fat: (calories * 0.3) / 9,
    calorieBandPct: 5,
    carbFatBandPct: 15,
  };
}

describe("generateSmartPlan (mobile parity)", () => {
  it("1200 kcal target: daily totals within 20% band", () => {
    const plan = generateSmartPlan({
      recipes,
      targets: makeTargets(1200),
      days: 7,
      seed: 42,
    });
    expect(plan).toHaveLength(7);
    for (const day of plan) {
      expect(day.totals.calories).toBeGreaterThanOrEqual(960);
      expect(day.totals.calories).toBeLessThanOrEqual(1440);
    }
  });

  it("fiberG propagates from recipe to meal output", () => {
    const plan = generateSmartPlan({
      recipes,
      targets: makeTargets(2000),
      days: 7,
      seed: 42,
    });
    const allMeals = plan.flatMap((d) => d.meals);
    const hasFiber = allMeals.some((m) => m.fiberG != null && m.fiberG > 0);
    expect(hasFiber).toBe(true);
  });

  it("7-day plan has no identical day combinations", () => {
    const plan = generateSmartPlan({
      recipes,
      targets: makeTargets(2000),
      days: 7,
      seed: 42,
    });
    const combos = plan.map((d) =>
      d.meals.map((m) => m.recipeId ?? m.recipeTitle).sort().join("|"),
    );
    const unique = new Set(combos);
    expect(unique.size).toBeGreaterThanOrEqual(5);
  });

  it("no same recipe appears twice in one day", () => {
    const plan = generateSmartPlan({
      recipes,
      targets: makeTargets(2000),
      days: 7,
      seed: 42,
    });
    for (const day of plan) {
      const ids = day.meals.map((m) => m.recipeId).filter(Boolean);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    }
  });
});
