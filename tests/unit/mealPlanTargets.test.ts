/**
 * Tests for the meal plan algorithm at different calorie targets.
 * Validates calorie band compliance, fiber propagation, day variety,
 * no intra-day recipe duplication, and portion multiplier bounds.
 */
import { describe, it, expect, vi } from "vitest";
import { generateSmartPlan, type SimpleRecipe } from "@/lib/nutrition/mealPlanAlgo";

// Every test here runs a full 7-day `generateSmartPlan` (~2s in isolation —
// fine alone, but the large unit suite runs many workers in parallel and the
// CPU contention can push these slow-but-correct tests past the 5s default,
// reading as flaky timeouts. A file-wide generous timeout absorbs the load
// variance without changing any assertion (mirror of the mobile
// `mealPlanAlgo.test.ts` fix).
vi.setConfig({ testTimeout: 30_000 });

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
    fiber: 28,
    calorieBandPct: 5,
    carbFatBandPct: 15,
  };
}

describe("meal plan calorie targets", () => {
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

  it("2000 kcal target: daily totals within 15% band", () => {
    const plan = generateSmartPlan({
      recipes,
      targets: makeTargets(2000),
      days: 7,
      seed: 42,
    });
    expect(plan).toHaveLength(7);
    for (const day of plan) {
      expect(day.totals.calories).toBeGreaterThanOrEqual(1700);
      expect(day.totals.calories).toBeLessThanOrEqual(2300);
    }
  });

  it("2500 kcal target: daily totals within 15% band", () => {
    const plan = generateSmartPlan({
      recipes,
      targets: makeTargets(2500),
      days: 7,
      seed: 42,
    });
    expect(plan).toHaveLength(7);
    for (const day of plan) {
      expect(day.totals.calories).toBeGreaterThanOrEqual(2125);
      expect(day.totals.calories).toBeLessThanOrEqual(2875);
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

  it("7-day plan rotates through multiple distinct day combinations", () => {
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
    // With 8 untagged recipes and 4 slots, F-73's 1×-first joint
    // optimizer (with `mealPlanPortionSpreadPenalty` + recency penalty)
    // converges on the small set of macro-best-fit combinations and
    // rotates through them. Pre-F-73 the looser scaler accidentally
    // produced more raw variety because it didn't optimize as well —
    // those days were "unique" but worse macro fits. Three distinct
    // combos cycled across a 7-day window is the new floor: it shows
    // the recency penalty is firing without forcing the planner to
    // pick worse-fit sets just to satisfy a variety pin.
    expect(unique.size).toBeGreaterThanOrEqual(3);
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

  it("portion multiplier >= 0.2", () => {
    const plan = generateSmartPlan({
      recipes,
      targets: makeTargets(2000),
      days: 7,
      seed: 42,
    });
    for (const day of plan) {
      for (const meal of day.meals) {
        if (meal.portionMultiplier != null) {
          expect(meal.portionMultiplier).toBeGreaterThanOrEqual(0.2);
        }
      }
    }
  });

  it("portion multiplier <= 2.5", () => {
    const plan = generateSmartPlan({
      recipes,
      targets: makeTargets(2000),
      days: 7,
      seed: 42,
    });
    for (const day of plan) {
      for (const meal of day.meals) {
        if (meal.portionMultiplier != null) {
          expect(meal.portionMultiplier).toBeLessThanOrEqual(2.5);
        }
      }
    }
  });
});
