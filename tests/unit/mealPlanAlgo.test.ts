/**
 * Tests for the meal planning algorithm.
 * Covers slot filtering, portion scaling, variety, and macro targeting.
 */
import { describe, it, expect } from "vitest";
import { generateSmartPlan, type SimpleRecipe } from "../../src/lib/nutrition/mealPlanAlgo";

const breakfast: SimpleRecipe = { id: "b1", title: "Oats", calories: 350, protein: 20, carbs: 50, fat: 8, mealType: ["breakfast"] };
const lunch: SimpleRecipe = { id: "l1", title: "Salad", calories: 400, protein: 30, carbs: 35, fat: 15, mealType: ["lunch"] };
const dinner1: SimpleRecipe = { id: "d1", title: "Stir Fry", calories: 500, protein: 40, carbs: 45, fat: 15, mealType: ["dinner"] };
const dinner2: SimpleRecipe = { id: "d2", title: "Curry", calories: 550, protein: 35, carbs: 50, fat: 20, mealType: ["dinner", "lunch"] };
const snack: SimpleRecipe = { id: "s1", title: "Banana", calories: 100, protein: 1, carbs: 25, fat: 0, mealType: ["snack"] };
const untagged: SimpleRecipe = { id: "u1", title: "Mystery", calories: 300, protein: 15, carbs: 30, fat: 10 };

const targets = { calories: 1400, protein: 100, carbs: 160, fat: 45, calorieBandPct: 15, carbFatBandPct: 20 };

describe("generateSmartPlan", () => {
  it("generates the requested number of days", () => {
    const plan = generateSmartPlan({ recipes: [breakfast, lunch, dinner1, snack], targets, days: 3 });
    expect(plan).toHaveLength(3);
  });

  it("each day fills every slot when the pool has a match per slot", () => {
    const plan = generateSmartPlan({
      recipes: [breakfast, lunch, dinner1, snack],
      targets,
      days: 1,
    });
    expect(plan[0].meals).toHaveLength(4);
    expect(plan[0].meals.map((m) => m.name)).toEqual(["Breakfast", "Lunch", "Snacks", "Dinner"]);
  });

  it("respects meal type tags — breakfast only in Breakfast slot", () => {
    const plan = generateSmartPlan({
      recipes: [breakfast, lunch, dinner1, snack],
      targets,
      days: 1,
    });
    const breakfastMeal = plan[0].meals.find((m) => m.name === "Breakfast");
    // Should be "Oats" (the only breakfast-tagged recipe), not any other
    expect(breakfastMeal?.recipeTitle).toBe("Oats");
  });

  it("configurable slots — can exclude Snacks", () => {
    const plan = generateSmartPlan({
      recipes: [breakfast, lunch, dinner1, snack],
      targets,
      days: 1,
      slotConfig: { slots: ["Breakfast", "Lunch", "Dinner"] },
    });
    expect(plan[0].meals).toHaveLength(3);
    expect(plan[0].meals.map((m) => m.name)).toEqual(["Breakfast", "Lunch", "Dinner"]);
  });

  it("generates different plans for different days", () => {
    const plan = generateSmartPlan({
      recipes: [breakfast, lunch, dinner1, dinner2, snack],
      targets,
      days: 3,
      // Fixed seed — Date.now() can rarely pick the same optimal set for consecutive days (flaky CI).
      seed: 0,
    });
    expect(plan.length).toBe(3);
    // With recency penalty of 40, at least one meal should differ between day 1 and day 2
    const day1Titles = plan[0].meals.map((m) => m.recipeTitle).sort();
    const day2Titles = plan[1].meals.map((m) => m.recipeTitle).sort();
    const allSame = day1Titles.every((t, i) => t === day2Titles[i]);
    expect(allSame).toBe(false);
  });

  it("includes portion multiplier when target is very low", () => {
    const plan = generateSmartPlan({
      recipes: [breakfast, lunch, dinner1, snack],
      targets: { ...targets, calories: 800 },
      days: 1,
    });
    // With 800 cal target vs recipes totalling ~1350, scaling must happen
    const hasMultiplier = plan[0].meals.some((m) => m.portionMultiplier != null && m.portionMultiplier < 1);
    expect(hasMultiplier).toBe(true);
    // All multipliers must be within bounds
    for (const meal of plan[0].meals) {
      if (meal.portionMultiplier != null) {
        expect(meal.portionMultiplier).toBeGreaterThanOrEqual(0.2);
        expect(meal.portionMultiplier).toBeLessThanOrEqual(2.5);
      }
    }
  });

  it("computes day totals correctly", () => {
    const plan = generateSmartPlan({
      recipes: [breakfast, lunch, dinner1, snack],
      targets,
      days: 1,
    });
    const expectedCals = plan[0].meals.reduce((a, m) => a + m.calories, 0);
    expect(plan[0].totals.calories).toBe(expectedCals);
  });

  it("handles empty recipe pool gracefully", () => {
    const plan = generateSmartPlan({ recipes: [], targets, days: 1 });
    expect(plan).toHaveLength(1);
    expect(plan[0].meals).toHaveLength(0);
    expect(plan[0].totals.calories).toBe(0);
  });

  it("untagged recipes can fill any slot", () => {
    const plan = generateSmartPlan({
      recipes: [untagged],
      targets,
      days: 1,
    });
    // With only one untagged recipe, it should fill all slots
    for (const meal of plan[0].meals) {
      expect(meal.recipeTitle).toBe("Mystery");
    }
  });

  it("fills only slots that have matching recipes when the pool is sparse", () => {
    const plan = generateSmartPlan({ recipes: [breakfast], targets, days: 1 });
    expect(plan[0].meals).toHaveLength(1);
    expect(plan[0].meals[0]?.name).toBe("Breakfast");
    expect(plan[0].meals[0]?.recipeTitle).toBe("Oats");
  });

  it("same seed produces same plan (deterministic)", () => {
    const opts = { recipes: [breakfast, lunch, dinner1, dinner2, snack, untagged], targets, days: 1, seed: 42 };
    const plan1 = generateSmartPlan(opts);
    const plan2 = generateSmartPlan(opts);
    const titles1 = plan1[0].meals.map((m) => m.recipeTitle);
    const titles2 = plan2[0].meals.map((m) => m.recipeTitle);
    expect(titles1).toEqual(titles2);
  });

  it("clamps days to max 7", () => {
    const plan = generateSmartPlan({ recipes: [breakfast, lunch, dinner1, snack], targets, days: 99 });
    expect(plan).toHaveLength(7);
  });

  it("clamps days to min 1", () => {
    const plan = generateSmartPlan({ recipes: [breakfast, lunch, dinner1, snack], targets, days: 0 });
    expect(plan).toHaveLength(1);
  });
});
