import { describe, expect, it } from "vitest";
import {
  planMealDisplayMultiplier,
  plannerPortionMultiplierSteps,
} from "../../src/app/components/suppr/plan-portion-dialog.tsx";
import { PORTION_MULTIPLIER_CLAMP } from "../../src/lib/nutrition/mealPlanAlgo.ts";

describe("plannerPortionMultiplierSteps", () => {
  it("emits clamp-aligned steps", () => {
    const steps = plannerPortionMultiplierSteps();
    expect(steps[0]).toBe(PORTION_MULTIPLIER_CLAMP.min);
    expect(steps[steps.length - 1]).toBe(PORTION_MULTIPLIER_CLAMP.max);
    expect(steps).toContain(1);
  });
});

describe("planMealDisplayMultiplier", () => {
  it("reads explicit portionMultiplier when set", () => {
    const mult = planMealDisplayMultiplier(
      {
        name: "Lunch",
        recipeTitle: "Salad",
        calories: 600,
        protein: 30,
        carbs: 40,
        fat: 20,
        portionMultiplier: 1.5,
      },
      [],
    );
    expect(mult).toBe(1.5);
  });

  it("infers multiplier from recipe calories when unset", () => {
    const mult = planMealDisplayMultiplier(
      {
        name: "Dinner",
        recipeTitle: "Curry",
        recipeId: "r1",
        calories: 800,
        protein: 40,
        carbs: 60,
        fat: 30,
      },
      [{ id: "r1", title: "Curry", calories: 400 }],
    );
    expect(mult).toBe(2);
  });
});
