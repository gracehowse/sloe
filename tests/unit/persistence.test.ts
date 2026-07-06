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

  it("defaultSnapshot has nutrition targets but starts with zero fabricated activity", () => {
    // ENG-1446 — a fresh account must never look pre-populated. Neutral
    // defaults (targets) still seed; saved recipes, logged meals, and
    // shopping items must not.
    const s = defaultSnapshot();
    expect(s.nutritionTargets.calories).toBeGreaterThan(0);
    expect(s.savedRecipeIds).toEqual([]);
    expect(s.nutritionByDay).toEqual({});
    expect(Object.keys(s.nutritionByDay)).toHaveLength(0);
    expect(s.shoppingItems).toEqual([]);
  });

  it("loadSnapshot returns default (empty) when storage empty", () => {
    const a = defaultSnapshot();
    const b = loadSnapshot();
    expect(b.savedRecipeIds).toEqual(a.savedRecipeIds);
    expect(b.nutritionByDay).toEqual({});
    expect(b.shoppingItems).toEqual([]);
  });

  it("ENG-1446: migrates away the retired seed-breakfast/seed-lunch rows from an existing user's stored snapshot", () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        nutritionByDay: {
          [today]: [
            {
              id: "seed-breakfast",
              name: "Breakfast",
              recipeTitle: "Overnight Protein Oats",
              time: "8:30 AM",
              calories: 387,
              protein: 32,
              carbs: 48,
              fat: 8,
            },
            {
              id: "seed-lunch",
              name: "Lunch",
              recipeTitle: "High-Protein Chicken & Rice Bowl",
              time: "12:45 PM",
              calories: 542,
              protein: 48,
              carbs: 52,
              fat: 12,
            },
            {
              id: "real-meal-1",
              name: "Dinner",
              recipeTitle: "Real user meal",
              time: "7:00 PM",
              calories: 600,
              protein: 40,
              carbs: 60,
              fat: 20,
            },
          ],
        },
      }),
    );
    const s = loadSnapshot();
    const ids = (s.nutritionByDay[today] ?? []).map((m) => m.id);
    expect(ids).not.toContain("seed-breakfast");
    expect(ids).not.toContain("seed-lunch");
    expect(ids).toContain("real-meal-1");
  });

  it("ENG-1446: migrates away the retired fixture shopping items from an existing user's stored snapshot", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        shoppingItems: [
          {
            id: "1",
            name: "Chicken Breast",
            amount: "1.5",
            unit: "lb",
            category: "Protein",
            checked: false,
            from: "High-Protein Chicken Bowl",
          },
          {
            id: "5",
            name: "Protein Powder",
            amount: "2",
            unit: "scoops",
            category: "Protein",
            checked: true,
            from: "Overnight Protein Oats",
          },
          {
            id: "chicken breast|lb",
            name: "Chicken Breast",
            amount: "2",
            unit: "lb",
            category: "Protein",
            checked: false,
            from: "My real recipe",
          },
        ],
      }),
    );
    const s = loadSnapshot();
    const ids = s.shoppingItems.map((i) => i.id);
    expect(ids).not.toContain("1");
    expect(ids).not.toContain("5");
    expect(ids).toContain("chicken breast|lb");
  });

  it("ENG-1446: migrates away the retired fixture saved-recipe ids from an existing user's stored snapshot", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        savedRecipeIds: [
          "cccccccc-cccc-cccc-cccc-cccccccccccc",
          "dddddddd-dddd-dddd-dddd-dddddddddddd",
          "real-user-saved-recipe-id",
        ],
        savedAtById: {
          "cccccccc-cccc-cccc-cccc-cccccccccccc": new Date("2026-04-05").toISOString(),
          "real-user-saved-recipe-id": new Date("2026-06-01").toISOString(),
        },
      }),
    );
    const s = loadSnapshot();
    expect(s.savedRecipeIds).not.toContain("cccccccc-cccc-cccc-cccc-cccccccccccc");
    expect(s.savedRecipeIds).not.toContain("dddddddd-dddd-dddd-dddd-dddddddddddd");
    expect(s.savedRecipeIds).toContain("real-user-saved-recipe-id");
    expect(s.savedAtById).not.toHaveProperty("cccccccc-cccc-cccc-cccc-cccccccccccc");
    expect(s.savedAtById).toHaveProperty("real-user-saved-recipe-id");
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
