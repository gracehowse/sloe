/**
 * Tests for TDEE calculation — drives onboarding calorie/macro targets.
 * Wrong values here = wrong daily targets for every user.
 */
import { describe, it, expect } from "vitest";
import {
  calculateBMR,
  calculateTDEE,
  calculateBudget,
  calculateMacros,
  weeksToGoal,
  budgetSafety,
  goalDate,
} from "@/lib/nutrition/tdee";

describe("calculateBMR (Mifflin-St Jeor)", () => {
  it("calculates male BMR correctly", () => {
    // Male, 80kg, 180cm, 30yo: 10×80 + 6.25×180 - 5×30 + 5 = 800 + 1125 - 150 + 5 = 1780
    const bmr = calculateBMR("male", 80, 180, 30);
    expect(bmr).toBeCloseTo(1780, 0);
  });

  it("calculates female BMR correctly", () => {
    // Female, 60kg, 165cm, 25yo: 10×60 + 6.25×165 - 5×25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25
    const bmr = calculateBMR("female", 60, 165, 25);
    expect(bmr).toBeCloseTo(1345, 0);
  });

  it("returns positive value for edge case young person", () => {
    const bmr = calculateBMR("female", 45, 150, 18);
    expect(bmr).toBeGreaterThan(1000);
  });

  it("returns positive value for edge case older person", () => {
    const bmr = calculateBMR("male", 100, 190, 65);
    expect(bmr).toBeGreaterThan(1500);
  });
});

describe("calculateTDEE", () => {
  it("sedentary multiplier is 1.2", () => {
    const bmr = calculateBMR("male", 80, 180, 30);
    const tdee = calculateTDEE("male", 80, 180, 30, "sedentary");
    expect(tdee).toBeCloseTo(bmr * 1.2, 0);
  });

  it("very active multiplier is higher than sedentary", () => {
    const sedentary = calculateTDEE("male", 80, 180, 30, "sedentary");
    const active = calculateTDEE("male", 80, 180, 30, "very_active");
    expect(active).toBeGreaterThan(sedentary);
    expect(active).toBeGreaterThan(sedentary * 1.5);
  });
});

describe("calculateBudget", () => {
  it("cut creates a deficit", () => {
    const budget = calculateBudget(2000, "steady", "cut");
    expect(budget).toBeLessThan(2000);
    expect(budget).toBeGreaterThan(1200); // Safety floor
  });

  it("bulk creates a surplus", () => {
    const budget = calculateBudget(2000, "steady", "bulk");
    expect(budget).toBeGreaterThan(2000);
  });

  it("maintain stays close to TDEE", () => {
    const budget = calculateBudget(2000, "steady", "maintain");
    expect(budget).toBeCloseTo(2000, -1);
  });
});

describe("calculateMacros", () => {
  it("returns protein, carbs, fat that sum to roughly the calorie budget", () => {
    const macros = calculateMacros(2000, "balanced", 80);
    const computedCals = macros.protein * 4 + macros.carbs * 4 + macros.fat * 9;
    // Should be within 5% of 2000
    expect(computedCals).toBeGreaterThan(1900);
    expect(computedCals).toBeLessThan(2100);
  });

  it("high protein strategy gives more protein", () => {
    const balanced = calculateMacros(2000, "balanced", 80);
    const highPro = calculateMacros(2000, "high_protein", 80);
    expect(highPro.protein).toBeGreaterThan(balanced.protein);
  });

  it("all values are positive integers", () => {
    const macros = calculateMacros(1500, "balanced", 60);
    expect(macros.protein).toBeGreaterThan(0);
    expect(macros.carbs).toBeGreaterThan(0);
    expect(macros.fat).toBeGreaterThan(0);
    expect(Number.isInteger(macros.protein)).toBe(true);
    expect(Number.isInteger(macros.carbs)).toBe(true);
    expect(Number.isInteger(macros.fat)).toBe(true);
  });
});

describe("weeksToGoal", () => {
  it("returns positive weeks for weight loss", () => {
    const weeks = weeksToGoal(80, 70, "steady");
    expect(weeks).toBeGreaterThan(0);
    expect(weeks).toBeLessThan(100);
  });

  it("returns 0 when already at goal", () => {
    const weeks = weeksToGoal(70, 70, "steady");
    expect(weeks).toBe(0);
  });
});

describe("budgetSafety", () => {
  it("returns warning for very low male budget", () => {
    expect(budgetSafety(1400, "male")).toBe("warning");
  });

  it("returns warning for very low female budget", () => {
    expect(budgetSafety(1100, "female")).toBe("warning");
  });

  it("returns caution for borderline budget", () => {
    expect(budgetSafety(1600, "male")).toBe("caution");
    expect(budgetSafety(1300, "female")).toBe("caution");
  });

  it("returns safe for normal budget", () => {
    expect(budgetSafety(2000, "male")).toBe("safe");
    expect(budgetSafety(1600, "female")).toBe("safe");
  });
});

describe("goalDate", () => {
  it("returns a date in the future for positive weeks", () => {
    const d = goalDate(10);
    expect(d.getTime()).toBeGreaterThan(Date.now());
  });

  it("returns today for 0 weeks", () => {
    const d = goalDate(0);
    const diff = Math.abs(d.getTime() - Date.now());
    expect(diff).toBeLessThan(1000); // within 1 second
  });
});

describe("calculateBudget edge cases", () => {
  it("cut with all pace values creates deficit", () => {
    for (const pace of ["relaxed", "steady", "accelerated", "vigorous"] as const) {
      const budget = calculateBudget(2000, pace, "cut");
      expect(budget).toBeLessThan(2000);
      expect(budget).toBeGreaterThan(0);
    }
  });

  it("bulk with old 'gain' alias still works", () => {
    const budget = calculateBudget(2000, "steady", "gain");
    expect(budget).toBeGreaterThan(2000);
  });

  it("bulk with old 'strength' alias still works", () => {
    const budget = calculateBudget(2000, "steady", "strength");
    expect(budget).toBeGreaterThan(2000);
  });
});

describe("calculateMacros strategies", () => {
  it("low_carb gives fewer carbs than balanced", () => {
    const balanced = calculateMacros(2000, "balanced", 80);
    const lowCarb = calculateMacros(2000, "low_carb", 80);
    expect(lowCarb.carbs).toBeLessThan(balanced.carbs);
    expect(lowCarb.fat).toBeGreaterThan(balanced.fat);
  });
});
