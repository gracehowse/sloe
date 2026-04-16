/**
 * Tests for the nutrition confidence pipeline:
 * - estimateLineMacros isDefaultFallback flag
 * - confidence tier classification
 * - MacroBreakdown type contract
 */
import { describe, it, expect } from "vitest";
import { estimateLineMacros, sumMacros } from "@/lib/nutrition/estimateIngredientMacros";

describe("isDefaultFallback flag", () => {
  it("known ingredient does not set isDefaultFallback", () => {
    const result = estimateLineMacros({ name: "chicken breast", amount: "200", unit: "g" });
    expect(result.isDefaultFallback).toBeUndefined();
    expect(result.calories).toBeGreaterThan(200);
  });

  it("unknown ingredient sets isDefaultFallback", () => {
    const result = estimateLineMacros({ name: "xylospongium extract", amount: "100", unit: "g" });
    expect(result.isDefaultFallback).toBe(true);
    // Default is 150 kcal per 100g
    expect(result.calories).toBe(150);
  });

  it("empty name sets isDefaultFallback", () => {
    const result = estimateLineMacros({ name: "", amount: "50", unit: "g" });
    expect(result.isDefaultFallback).toBe(true);
  });

  it("partial match does not set isDefaultFallback", () => {
    // "olive oil" should match "olive oil" in staples
    const result = estimateLineMacros({ name: "extra virgin olive oil", amount: "1", unit: "tbsp" });
    expect(result.isDefaultFallback).toBeUndefined();
    expect(result.fat).toBeGreaterThan(10);
  });
});

describe("sumMacros preserves isDefaultFallback in individual items", () => {
  it("sums correctly with mixed fallback states", () => {
    const known = estimateLineMacros({ name: "chicken breast", amount: "200", unit: "g" });
    const unknown = estimateLineMacros({ name: "mystery spice", amount: "5", unit: "g" });
    const total = sumMacros([known, unknown]);

    expect(total.calories).toBeGreaterThan(known.calories);
    expect(known.isDefaultFallback).toBeUndefined();
    expect(unknown.isDefaultFallback).toBe(true);
  });
});

describe("confidence tier classification", () => {
  // Mirrors the logic in verify-recipe route
  function confidenceTier(avg: number): "high" | "medium" | "low" {
    return avg >= 0.75 ? "high" : avg >= 0.5 ? "medium" : "low";
  }

  it("0.85 is high", () => expect(confidenceTier(0.85)).toBe("high"));
  it("0.75 is high", () => expect(confidenceTier(0.75)).toBe("high"));
  it("0.60 is medium", () => expect(confidenceTier(0.60)).toBe("medium"));
  it("0.50 is medium", () => expect(confidenceTier(0.50)).toBe("medium"));
  it("0.49 is low", () => expect(confidenceTier(0.49)).toBe("low"));
  it("0.0 is low", () => expect(confidenceTier(0.0)).toBe("low"));
});

describe("gPerMl density overrides for cup measurements", () => {
  it("1 cup yogurt uses yogurt density (1.04)", () => {
    const result = estimateLineMacros({ name: "yogurt", amount: "1", unit: "cup" });
    // 236.588ml * 1.04 g/ml = ~246g → 59 kcal/100g * 2.46 ≈ 145 kcal
    expect(result.calories).toBeGreaterThan(130);
    expect(result.calories).toBeLessThan(160);
  });

  it("1 cup milk uses milk density (1.03)", () => {
    const result = estimateLineMacros({ name: "milk", amount: "1", unit: "cup" });
    // 236.588 * 1.03 = ~243g → 42 kcal/100g * 2.43 ≈ 102 kcal
    expect(result.calories).toBeGreaterThan(90);
    expect(result.calories).toBeLessThan(115);
  });

  it("1 cup lentils uses lentil density (0.80)", () => {
    const result = estimateLineMacros({ name: "lentil", amount: "1", unit: "cup" });
    // 236.588 * 0.80 = ~189g → 116 kcal/100g * 1.89 ≈ 219 kcal
    expect(result.calories).toBeGreaterThan(200);
    expect(result.calories).toBeLessThan(240);
  });
});
