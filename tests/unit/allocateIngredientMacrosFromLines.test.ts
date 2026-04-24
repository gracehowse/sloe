import { describe, expect, it } from "vitest";
import { allocateIngredientMacrosFromLines } from "../../src/lib/nutrition/allocateIngredientMacrosFromLines";

describe("allocateIngredientMacrosFromLines", () => {
  it("scales line estimates to full-recipe calorie total", () => {
    const lines = [
      "1/4 cup extra virgin olive oil",
      "1 medium yellow onion, chopped",
      "1 cup brown lentils, rinsed",
    ];
    const perServing = 400;
    const servings = 4;
    const out = allocateIngredientMacrosFromLines(lines, perServing, servings);
    expect(out).toHaveLength(3);
    const sum = out.reduce((s, r) => s + r.calories, 0);
    expect(Math.abs(sum - perServing * servings)).toBeLessThanOrEqual(3);
    expect(out[0]!.source).toBe("estimated_scaled");
  });

  it("returns line estimates without scaling when recipe calorie total is unknown (0)", () => {
    const lines = ["1 cup water", "1 tbsp olive oil"];
    const out = allocateIngredientMacrosFromLines(lines, 0, 2);
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.source === "estimated")).toBe(true);
    expect(out.reduce((s, r) => s + r.calories, 0)).toBeGreaterThan(0);
  });
});
