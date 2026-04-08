import { afterEach, describe, expect, it } from "vitest";
import {
  STORAGE_KEY,
  defaultSnapshot,
  loadSnapshot,
  normalizeLoggedMealRow,
} from "../../src/context/appData/persistence.ts";

describe("persistence", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("defaultSnapshot has nutrition targets and seeded saves", () => {
    const s = defaultSnapshot();
    expect(s.savedRecipeIds.length).toBeGreaterThan(0);
    expect(s.nutritionTargets.calories).toBeGreaterThan(0);
    expect(Object.keys(s.nutritionByDay).length).toBeGreaterThan(0);
  });

  it("loadSnapshot returns default when storage empty", () => {
    const a = defaultSnapshot();
    const b = loadSnapshot();
    expect(b.savedRecipeIds).toEqual(a.savedRecipeIds);
  });

  it("loadSnapshot merges partial localStorage JSON", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        savedRecipeIds: ["only-one"],
        nutritionTargets: { calories: 2000, protein: 150, carbs: 200, fat: 60, fiber: 30, waterMl: 2500 },
      }),
    );
    const s = loadSnapshot();
    expect(s.savedRecipeIds).toEqual(["only-one"]);
    expect(s.nutritionTargets.calories).toBe(2000);
  });

  it("normalizeLoggedMealRow rejects invalid rows", () => {
    expect(normalizeLoggedMealRow(null)).toBeNull();
    expect(normalizeLoggedMealRow({})).toBeNull();
    expect(
      normalizeLoggedMealRow({
        id: "x",
        name: "Lunch",
        recipeTitle: "Soup",
        time: "12:00",
        calories: 100,
        protein: 10,
        carbs: 10,
        fat: 5,
      }),
    ).toMatchObject({ id: "x", calories: 100 });
  });
});
