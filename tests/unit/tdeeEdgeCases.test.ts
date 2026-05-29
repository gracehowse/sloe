/**
 * TDEE edge cases — Atwater reconciliation, clamp floors, budget safety.
 *
 * Note: file was historically named `rateLimitFallback.test.ts` but never
 * contained rate-limit assertions (ENG-689 test-debt cleanup).
 */
import { describe, it, expect } from "vitest";
import { budgetSafety, calculateBMR, calculateMacros, calculateTDEE } from "@/lib/nutrition/tdee";

describe("TDEE edge cases", () => {
  it("clamps extremely low weight to 30kg floor", () => {
    const bmr = calculateBMR("female", 5, 160, 25);    // 5kg → clamped to 30
    const normal = calculateBMR("female", 30, 160, 25); // 30kg
    expect(bmr).toBe(normal);
  });

  it("clamps extremely high weight to 350kg ceiling", () => {
    const bmr = calculateBMR("male", 500, 180, 30);   // 500kg → clamped to 350
    const normal = calculateBMR("male", 350, 180, 30); // 350kg
    expect(bmr).toBe(normal);
  });

  it("clamps age to 13-100 range", () => {
    const child = calculateBMR("male", 70, 170, 3);   // 3 → clamped to 13
    const teen = calculateBMR("male", 70, 170, 13);   // 13
    expect(child).toBe(teen);
  });

  it("calculateMacros returns zeros for non-positive calories", () => {
    const result = calculateMacros(0, "balanced", 70);
    expect(result.protein).toBe(0);
    expect(result.carbs).toBe(0);
    expect(result.fat).toBe(0);
    expect(result.fiber).toBe(15);
  });

  it("calculateMacros returns zeros for NaN calories", () => {
    const result = calculateMacros(NaN, "balanced", 70);
    expect(result.protein).toBe(0);
    expect(result.carbs).toBe(0);
  });

  it("macros reconcile to calorie budget", () => {
    const calories = 2000;
    const result = calculateMacros(calories, "balanced", 75);
    const implied = result.protein * 4 + result.carbs * 4 + result.fat * 9;
    // Within 10 calories of target (rounding tolerance)
    expect(Math.abs(implied - calories)).toBeLessThanOrEqual(10);
  });

  it("macros reconcile for high_protein strategy", () => {
    const calories = 1800;
    const result = calculateMacros(calories, "high_protein", 80);
    const implied = result.protein * 4 + result.carbs * 4 + result.fat * 9;
    expect(Math.abs(implied - calories)).toBeLessThanOrEqual(10);
  });

  it("budgetSafety flags unsafe low calories", () => {
    expect(budgetSafety(900, "female")).toBe("warning");
    expect(budgetSafety(1100, "female")).toBe("warning");
    expect(budgetSafety(1300, "female")).toBe("caution");
    expect(budgetSafety(1500, "female")).toBe("safe");
  });

  it("TDEE calculation produces reasonable values", () => {
    const tdee = calculateTDEE("male", 80, 180, 30, "moderate");
    expect(tdee).toBeGreaterThan(1500);
    expect(tdee).toBeLessThan(4000);
  });
});
