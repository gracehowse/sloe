import { describe, expect, it } from "vitest";
import { planMealFiberG } from "@/lib/planMealFiber";

const POOL = [
  {
    id: "r1",
    title: "Oats bowl",
    calories: 400,
    fiber_per_serving: 8,
  },
];

describe("planMealFiberG", () => {
  it("returns stored fiberG when present", () => {
    expect(
      planMealFiberG(
        { recipeTitle: "X", calories: 200, fiberG: 5, recipeId: "r1" },
        POOL,
      ),
    ).toBe(5);
  });

  it("derives fibre from recipe when meal row omits fiberG", () => {
    expect(
      planMealFiberG({ recipeTitle: "Oats bowl", calories: 400, recipeId: "r1" }, POOL),
    ).toBe(8);
  });

  it("reads legacy fiber field names on recipe refs", () => {
    expect(
      planMealFiberG(
        { recipeTitle: "Salad", calories: 300, recipeId: "r2" },
        [{ id: "r2", title: "Salad", calories: 300, fiber: 9 }],
      ),
    ).toBe(9);
  });
});
