/**
 * Tests for the local nutrition estimation fallback.
 * This is the last-resort estimator when USDA/OFF/FatSecret all fail.
 * Accuracy here directly affects user trust.
 */
import { describe, it, expect } from "vitest";
import { estimateLineMacros, sumMacros } from "@/lib/nutrition/estimateIngredientMacros";

describe("estimateLineMacros", () => {
  // ── Happy path: common ingredients ────────────────────────────

  it("estimates chicken breast correctly (high protein, low carb)", () => {
    const result = estimateLineMacros({ name: "chicken breast", amount: "200", unit: "g" });
    expect(result.calories).toBeGreaterThan(300);
    expect(result.calories).toBeLessThan(400);
    expect(result.protein).toBeGreaterThan(50);
    expect(result.carbs).toBeLessThan(5);
    expect(result.fiberG).toBe(0);
  });

  it("estimates banana with realistic fiber", () => {
    const result = estimateLineMacros({ name: "banana", amount: "1", unit: "medium" });
    expect(result.calories).toBeGreaterThan(80);
    expect(result.calories).toBeLessThan(110);
    expect(result.fiberG).toBeGreaterThan(2);
    expect(result.carbs).toBeGreaterThan(20);
  });

  it("estimates broccoli with high fiber", () => {
    const result = estimateLineMacros({ name: "broccoli", amount: "200", unit: "g" });
    expect(result.fiberG).toBeGreaterThan(4);
    expect(result.calories).toBeLessThan(80);
  });

  it("estimates olive oil as pure fat", () => {
    const result = estimateLineMacros({ name: "olive oil", amount: "1", unit: "tbsp" });
    expect(result.fat).toBeGreaterThan(10);
    expect(result.protein).toBe(0);
    expect(result.carbs).toBe(0);
    expect(result.fiberG).toBe(0);
  });

  it("estimates lentils with high fiber and protein", () => {
    const result = estimateLineMacros({ name: "lentils", amount: "1", unit: "cup" });
    expect(result.fiberG).toBeGreaterThan(8);
    expect(result.protein).toBeGreaterThan(10);
  });

  // ── Meat cut units ─────────────────────────────────────────────

  it("handles 2 chicken breasts as ~400g", () => {
    const result = estimateLineMacros({ name: "chicken", amount: "2", unit: "breast" });
    // 2 breasts × 200g = 400g at ~165 kcal/100g
    expect(result.calories).toBeGreaterThan(600);
    expect(result.calories).toBeLessThan(900);
  });

  it("handles chicken thighs", () => {
    const result = estimateLineMacros({ name: "chicken", amount: "3", unit: "thigh" });
    // 3 thighs × 120g = 360g
    expect(result.calories).toBeGreaterThan(600);
  });

  it("handles fillets", () => {
    const result = estimateLineMacros({ name: "salmon", amount: "2", unit: "fillet" });
    // 2 fillets × 170g = 340g
    expect(result.calories).toBeGreaterThan(600);
  });

  // ── Weight units ───────────────────────────────────────────────

  it("handles grams", () => {
    const result = estimateLineMacros({ name: "rice", amount: "100", unit: "g" });
    expect(result.calories).toBe(130);
  });

  it("handles kg", () => {
    const result = estimateLineMacros({ name: "potato", amount: "1", unit: "kg" });
    expect(result.calories).toBe(770);
  });

  it("handles oz", () => {
    const result = estimateLineMacros({ name: "cheese", amount: "2", unit: "oz" });
    // 2oz ≈ 56.7g
    expect(result.calories).toBeGreaterThan(180);
    expect(result.calories).toBeLessThan(220);
  });

  it("handles lb", () => {
    const result = estimateLineMacros({ name: "beef", amount: "1", unit: "lb" });
    // 1lb ≈ 453.6g at 250 kcal/100g
    expect(result.calories).toBeGreaterThan(1000);
    expect(result.calories).toBeLessThan(1200);
  });

  // ── Volume units ───────────────────────────────────────────────

  it("handles cups with milk density", () => {
    const result = estimateLineMacros({ name: "milk", amount: "1", unit: "cup" });
    // 1 cup ≈ 237ml × 1.03 g/ml ≈ 244g at 42 kcal/100g ≈ 102 kcal
    expect(result.calories).toBeGreaterThan(90);
    expect(result.calories).toBeLessThan(120);
  });

  it("handles tbsp", () => {
    const result = estimateLineMacros({ name: "honey", amount: "1", unit: "tbsp" });
    expect(result.calories).toBeGreaterThan(40);
    expect(result.calories).toBeLessThan(70);
  });

  // ── Countable units ────────────────────────────────────────────

  it("handles eggs (50g each, not 110g medium)", () => {
    const result = estimateLineMacros({ name: "eggs", amount: "3", unit: "" });
    // 3 × 50g = 150g at 143 kcal/100g ≈ 215
    expect(result.calories).toBeGreaterThan(190);
    expect(result.calories).toBeLessThan(240);
  });

  it("handles cloves of garlic", () => {
    const result = estimateLineMacros({ name: "garlic", amount: "3", unit: "clove" });
    // 3 × 4g = 12g
    expect(result.calories).toBeLessThan(20);
  });

  it("handles tins of tomatoes", () => {
    const result = estimateLineMacros({ name: "chopped tomatoes", amount: "1", unit: "tin" });
    // 1 tin = 400g at 18 kcal/100g = 72
    expect(result.calories).toBeGreaterThan(60);
    expect(result.calories).toBeLessThan(90);
  });

  // ── Edge cases ─────────────────────────────────────────────────

  it("handles empty amount (defaults to 1)", () => {
    const result = estimateLineMacros({ name: "onion", amount: "", unit: "medium" });
    expect(result.calories).toBeGreaterThan(30);
  });

  it("handles unknown foods (uses default staple)", () => {
    const result = estimateLineMacros({ name: "dragon fruit", amount: "100", unit: "g" });
    expect(result.calories).toBe(150); // default staple
  });

  it("handles range amounts", () => {
    const result = estimateLineMacros({ name: "garlic", amount: "2-3", unit: "clove" });
    // Average of 2 and 3 = 2.5
    expect(result.calories).toBeGreaterThan(0);
  });

  // ── Fiber specifically ─────────────────────────────────────────

  it("returns fiber for plant-based foods", () => {
    const oats = estimateLineMacros({ name: "oats", amount: "50", unit: "g" });
    expect(oats.fiberG).toBeGreaterThan(4);

    const chickpea = estimateLineMacros({ name: "chickpeas", amount: "100", unit: "g" });
    expect(chickpea.fiberG).toBeGreaterThan(6);

    const avocado = estimateLineMacros({ name: "avocado", amount: "1", unit: "medium" });
    expect(avocado.fiberG).toBeGreaterThan(6);
  });

  it("returns zero fiber for meat/dairy", () => {
    const chicken = estimateLineMacros({ name: "chicken breast", amount: "200", unit: "g" });
    expect(chicken.fiberG).toBe(0);

    const cheese = estimateLineMacros({ name: "cheese", amount: "50", unit: "g" });
    expect(cheese.fiberG).toBe(0);
  });
});

describe("sumMacros", () => {
  it("sums all macros including fiber", () => {
    const rows = [
      { calories: 100, protein: 10, carbs: 20, fat: 5, fiberG: 3 },
      { calories: 200, protein: 15, carbs: 25, fat: 8, fiberG: 5 },
    ];
    const sum = sumMacros(rows);
    expect(sum.calories).toBe(300);
    expect(sum.protein).toBe(25);
    expect(sum.carbs).toBe(45);
    expect(sum.fat).toBe(13);
    expect(sum.fiberG).toBe(8);
  });

  it("handles empty array", () => {
    const sum = sumMacros([]);
    expect(sum.calories).toBe(0);
    expect(sum.fiberG).toBe(0);
  });
});
