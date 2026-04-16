/**
 * Tests for pepper disambiguation across parsing, weight estimation, and macro lookup.
 *
 * "1 red pepper" = bell pepper vegetable (~31 kcal/100g, ~110g)
 * "pepper" or "black pepper" = spice (~251 kcal/100g, ~3g per use)
 *
 * Before this fix, "1 red pepper" got 276 kcal (black pepper profile at 110g)
 * instead of 34 kcal (bell pepper profile at 110g).
 */
import { describe, it, expect } from "vitest";
import { parseIngredientLine } from "@/lib/recipe-ingredients/parseIngredientLine";
import { measureToGrams } from "@/lib/nutrition/measureToGrams";
import { estimateLineMacros } from "@/lib/nutrition/estimateIngredientMacros";

describe("pepper disambiguation — parsing", () => {
  it('"1 red pepper, diced" is countable produce → unit: medium', () => {
    const result = parseIngredientLine("1 red pepper, diced");
    expect(result.unit).toBe("medium");
    expect(result.amount).toBe("1");
  });

  it('"2 green peppers" is countable produce → unit: medium', () => {
    const result = parseIngredientLine("2 green peppers");
    expect(result.unit).toBe("medium");
  });

  it('"1 bell pepper" is countable produce → unit: medium', () => {
    const result = parseIngredientLine("1 bell pepper");
    expect(result.unit).toBe("medium");
  });

  it('"1 yellow pepper, sliced" is countable produce → unit: medium', () => {
    const result = parseIngredientLine("1 yellow pepper, sliced");
    expect(result.unit).toBe("medium");
  });

  it('"pepper" alone is NOT countable produce (it is a spice)', () => {
    const result = parseIngredientLine("pepper");
    expect(result.unit).not.toBe("medium");
  });

  it('"1/2 tsp black pepper" remains a spice', () => {
    const result = parseIngredientLine("1/2 tsp black pepper");
    expect(result.unit).toBe("tsp");
  });
});

describe("pepper disambiguation — weight (measureToGrams)", () => {
  it('"red pepper" with no unit uses medium (110g)', () => {
    expect(measureToGrams({ name: "red pepper", amount: 1, unit: "medium" })).toBe(110);
  });

  it('"pepper" with no unit and count >= 1 treated as vegetable (110g)', () => {
    // "1 pepper" in a recipe context = bell pepper, not ground spice
    const grams = measureToGrams({ name: "pepper", amount: 1, unit: "" });
    expect(grams).toBe(110);
  });

  it('"ground pepper" still treated as spice', () => {
    const grams = measureToGrams({ name: "ground pepper", amount: 1, unit: "" });
    expect(grams).toBe(3);
  });

  it('"bell pepper" with no unit falls to produce regex', () => {
    const grams = measureToGrams({ name: "bell pepper", amount: 2, unit: "" });
    // 2 × 110g = 220g
    expect(grams).toBe(220);
  });

  it('"black pepper" with no unit falls to spice weight', () => {
    const grams = measureToGrams({ name: "black pepper", amount: 1, unit: "" });
    expect(grams).toBe(3);
  });
});

describe("pepper disambiguation — macro estimation", () => {
  it('"1 red pepper" gets bell pepper calories (~34 kcal), not black pepper (~276 kcal)', () => {
    const macros = estimateLineMacros({ name: "red pepper", amount: "1", unit: "medium" });
    // Bell pepper: 31 kcal/100g × 110g / 100 = ~34 kcal
    expect(macros.calories).toBeCloseTo(34, 0);
    expect(macros.calories).toBeLessThan(50);
  });

  it('"1 green pepper" gets green bell pepper calories (~22 kcal)', () => {
    const macros = estimateLineMacros({ name: "green pepper", amount: "1", unit: "medium" });
    // Green pepper: 20 kcal/100g × 110g / 100 = ~22 kcal
    expect(macros.calories).toBeCloseTo(22, 0);
    expect(macros.calories).toBeLessThan(40);
  });

  it('"1/2 tsp black pepper" gets spice calories (~4 kcal), not vegetable', () => {
    const macros = estimateLineMacros({ name: "black pepper", amount: "0.5", unit: "tsp" });
    // Black pepper: 251 kcal/100g. 0.5 tsp ≈ 2.46ml × 1 g/ml = 2.46g → ~6 kcal
    expect(macros.calories).toBeLessThan(10);
  });

  it('bare "pepper" uses black pepper profile (spice)', () => {
    const macros = estimateLineMacros({ name: "pepper", amount: "1", unit: "tsp" });
    // 1 tsp ≈ 4.93ml × 1 g/ml = 4.93g. Black pepper: 251 kcal/100g → ~12 kcal
    expect(macros.calories).toBeLessThan(20);
    expect(macros.calories).toBeGreaterThan(5);
  });

  it('"sweet pepper" gets bell pepper profile', () => {
    const macros = estimateLineMacros({ name: "sweet pepper", amount: "1", unit: "medium" });
    expect(macros.calories).toBeCloseTo(34, 0);
    expect(macros.calories).toBeLessThan(50);
  });
});
