/**
 * F-154 — meal share text builder. Pins the "no personal targets / no
 * user identity" privacy posture and verifies portion + macro rounding.
 */
import { describe, it, expect } from "vitest";
import { buildMealShareText } from "@/lib/share/buildMealShareText";

describe("buildMealShareText", () => {
  it("formats a single-serving meal with default portion label", () => {
    const out = buildMealShareText({
      recipeTitle: "Chicken Caesar",
      calories: 612,
      protein: 48.3,
      carbs: 32.1,
      fat: 28.7,
    });
    expect(out).toBe(
      "Chicken Caesar · 1 serving\n612 kcal · 48p 32c 29f\n\nvia Suppr",
    );
  });

  it("uses the passed portion multiplier when not 1", () => {
    const out = buildMealShareText({
      recipeTitle: "Beef Stir Fry",
      calories: 800,
      protein: 60,
      carbs: 50,
      fat: 30,
      portionMultiplier: 1.5,
    });
    expect(out).toContain("1.5 servings");
  });

  it("renders integer portion multipliers without decimals", () => {
    const out = buildMealShareText({
      recipeTitle: "Oatmeal",
      calories: 300,
      protein: 12,
      carbs: 50,
      fat: 6,
      portionMultiplier: 2,
    });
    expect(out).toContain("2 servings");
    expect(out).not.toContain("2.0");
  });

  it("trims whitespace in the recipe title", () => {
    const out = buildMealShareText({
      recipeTitle: "  Pad Thai  ",
      calories: 700,
      protein: 30,
      carbs: 90,
      fat: 22,
    });
    expect(out.startsWith("Pad Thai ·")).toBe(true);
  });

  it("rounds macros to integers", () => {
    const out = buildMealShareText({
      recipeTitle: "X",
      calories: 100.6,
      protein: 9.9,
      carbs: 12.4,
      fat: 4.5,
    });
    expect(out).toContain("101 kcal");
    expect(out).toContain("10p 12c 5f");
  });

  it("never includes user targets, budgets, names, or daily totals", () => {
    const out = buildMealShareText({
      recipeTitle: "Salad",
      calories: 200,
      protein: 20,
      carbs: 10,
      fat: 8,
    });
    expect(out).not.toMatch(/target|goal|budget|of\s+\d|\/\s*\d|hello|name|user/i);
  });

  it("ends with a single Suppr attribution line", () => {
    const out = buildMealShareText({
      recipeTitle: "Eggs",
      calories: 150,
      protein: 13,
      carbs: 1,
      fat: 10,
    });
    expect(out.trim().endsWith("via Suppr")).toBe(true);
  });
});
