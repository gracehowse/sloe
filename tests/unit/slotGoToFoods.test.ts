import { describe, expect, it } from "vitest";
import { computeSlotGoToFoods } from "../../src/lib/nutrition/slotGoToFoods";

describe("computeSlotGoToFoods (ENG-928)", () => {
  it("returns frequent foods for the requested slot only", () => {
    const byDay = {
      "2026-06-14": [
        { name: "Breakfast", recipeTitle: "Oats", calories: 300 },
        { name: "Breakfast", recipeTitle: "Oats", calories: 300 },
        { name: "Lunch", recipeTitle: "Chicken", calories: 400 },
      ],
      "2026-06-13": [{ name: "Breakfast", recipeTitle: "Oats", calories: 300 }],
    };
    const goTos = computeSlotGoToFoods(byDay, "Breakfast");
    expect(goTos).toHaveLength(1);
    expect(goTos[0]?.recipeTitle).toBe("Oats");
    expect(goTos[0]?.count).toBeGreaterThanOrEqual(2);
  });

  it("excludes one-off foods", () => {
    const byDay = {
      "2026-06-14": [{ name: "Dinner", recipeTitle: "Salmon", calories: 500 }],
    };
    expect(computeSlotGoToFoods(byDay, "Dinner")).toHaveLength(0);
  });
});
