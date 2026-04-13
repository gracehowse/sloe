/**
 * Tests for FatSecret serving mass parsing (T2-5 fix).
 * servingMassGrams should extract grams from metric fields first,
 * then fall back to parsing serving_description via measureToGrams.
 */
import { describe, it, expect } from "vitest";
import { servingMassGrams, pickBestServing, normalizeServingToMacros } from "@/lib/nutrition/fatsecretNormalize";

describe("servingMassGrams", () => {
  it("extracts grams from metric fields", () => {
    expect(servingMassGrams({
      metric_serving_amount: "100",
      metric_serving_unit: "g",
    } as any)).toBe(100);
  });

  it("extracts ml as grams (water density)", () => {
    expect(servingMassGrams({
      metric_serving_amount: "240",
      metric_serving_unit: "ml",
    } as any)).toBe(240);
  });

  it("returns null for missing metric fields", () => {
    expect(servingMassGrams({} as any)).toBeNull();
  });

  it("parses '1 cup' from serving_description (~130g at default density)", () => {
    const result = servingMassGrams({
      serving_description: "1 cup",
    } as any);
    expect(result).not.toBeNull();
    expect(result).toBeCloseTo(130, 0); // 236.6 * 0.55
  });

  it("parses '2 oz' from serving_description (~57g)", () => {
    const result = servingMassGrams({
      serving_description: "2 oz",
    } as any);
    expect(result).not.toBeNull();
    expect(result).toBeCloseTo(57, 0);
  });

  it("parses '1 tbsp' from serving_description (~15g)", () => {
    const result = servingMassGrams({
      serving_description: "1 tbsp",
    } as any);
    expect(result).not.toBeNull();
    expect(result).toBeCloseTo(15, 0);
  });

  it("returns null for unparseable description like '1 serving'", () => {
    // "serving" is not a recognised unit → measureToGrams returns 80g catch-all
    // which we detect and reject
    const result = servingMassGrams({
      serving_description: "1 serving",
    } as any);
    expect(result).toBeNull();
  });

  it("prefers metric fields over description", () => {
    const result = servingMassGrams({
      metric_serving_amount: "28",
      metric_serving_unit: "g",
      serving_description: "1 cup",
    } as any);
    expect(result).toBe(28); // metric takes priority
  });
});

describe("pickBestServing", () => {
  it("prefers metric serving when available", () => {
    const servings = [
      { serving_description: "1 cup", calories: "200" },
      { serving_description: "100g", metric_serving_amount: "100", metric_serving_unit: "g", calories: "150" },
    ];
    const best = pickBestServing(servings as any);
    expect(best.calories).toBe("150");
  });

  it("falls back to first serving when no metric", () => {
    const servings = [
      { serving_description: "1 cup", calories: "200" },
    ];
    const best = pickBestServing(servings as any);
    expect(best.calories).toBe("200");
  });
});

describe("normalizeServingToMacros", () => {
  it("normalizes string values to numbers", () => {
    const macros = normalizeServingToMacros({
      calories: "165",
      protein: "31",
      carbohydrate: "0",
      fat: "3.6",
      fiber: "0",
      sugar: "0",
      sodium: "74",
    } as any);
    expect(macros.calories).toBe(165);
    expect(macros.protein).toBe(31);
    expect(macros.fat).toBe(3.6);
    expect(macros.sodiumMg).toBe(74);
  });
});
