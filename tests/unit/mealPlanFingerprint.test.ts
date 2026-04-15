import { describe, it, expect } from "vitest";
import { fingerprintMealPlanForShopping } from "@/lib/planning/mealPlanFingerprint";
import type { DayPlan } from "@/types/recipe";

describe("fingerprintMealPlanForShopping", () => {
  it("returns empty string for null plan", () => {
    expect(fingerprintMealPlanForShopping(null)).toBe("");
  });

  it("returns empty string for empty array", () => {
    expect(fingerprintMealPlanForShopping([])).toBe("");
  });

  it("produces deterministic fingerprint for same plan", () => {
    const plan: DayPlan[] = [
      {
        day: 1,
        meals: [
          { name: "Breakfast", recipeTitle: "Oats", calories: 300, protein: 10, carbs: 50, fat: 8, portionMultiplier: 1 },
          { name: "Lunch", recipeTitle: "Salad", calories: 400, protein: 20, carbs: 30, fat: 15, portionMultiplier: 1.5 },
        ],
        totals: { calories: 700, protein: 30, carbs: 80, fat: 23 },
      },
    ];
    const a = fingerprintMealPlanForShopping(plan);
    const b = fingerprintMealPlanForShopping(plan);
    expect(a).toBe(b);
    expect(a).toContain("Oats");
    expect(a).toContain("Salad");
  });

  it("uses fixed-precision portion multiplier", () => {
    const plan: DayPlan[] = [
      {
        day: 1,
        meals: [
          { name: "Dinner", recipeTitle: "Pasta", calories: 500, protein: 15, carbs: 60, fat: 12, portionMultiplier: 1 },
        ],
        totals: { calories: 500, protein: 15, carbs: 60, fat: 12 },
      },
    ];
    const fp = fingerprintMealPlanForShopping(plan);
    expect(fp).toContain("1.0");
  });

  it("marks placeholder meals distinctly", () => {
    const plan: DayPlan[] = [
      {
        day: 1,
        meals: [
          { name: "Snacks", recipeTitle: "Placeholder", calories: 0, protein: 0, carbs: 0, fat: 0, isPlaceholder: true },
        ],
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      },
    ];
    const fp = fingerprintMealPlanForShopping(plan);
    expect(fp).toContain(":1:");  // isPlaceholder = "1"
  });

  it("changes fingerprint when recipe changes", () => {
    const planA: DayPlan[] = [{
      day: 1,
      meals: [{ name: "Lunch", recipeTitle: "A", calories: 300, protein: 10, carbs: 30, fat: 8 }],
      totals: { calories: 300, protein: 10, carbs: 30, fat: 8 },
    }];
    const planB: DayPlan[] = [{
      day: 1,
      meals: [{ name: "Lunch", recipeTitle: "B", calories: 300, protein: 10, carbs: 30, fat: 8 }],
      totals: { calories: 300, protein: 10, carbs: 30, fat: 8 },
    }];
    expect(fingerprintMealPlanForShopping(planA)).not.toBe(fingerprintMealPlanForShopping(planB));
  });
});
