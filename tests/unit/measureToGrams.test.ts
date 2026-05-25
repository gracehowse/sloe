/**
 * Tests for unit-to-gram conversion.
 * Accuracy here affects all nutrition calculations.
 */
import { describe, it, expect } from "vitest";
import {
  measureToGrams,
  measureToGramsDetailed,
  ML_PER_CUP_US,
  ML_PER_CUP_UK,
  ML_PER_CUP_METRIC,
  EGG_SIZE_G,
  poultryBreastGramsEach,
} from "@/lib/nutrition/measureToGrams";

describe("measureToGrams", () => {
  // ── Standard weight units ──────────────────────────────────────

  it("grams pass through", () => {
    expect(measureToGrams({ name: "flour", amount: 100, unit: "g" })).toBe(100);
  });

  it("kg to grams", () => {
    expect(measureToGrams({ name: "potato", amount: 1, unit: "kg" })).toBe(1000);
  });

  it("oz to grams", () => {
    const g = measureToGrams({ name: "cheese", amount: 2, unit: "oz" });
    expect(g).toBeCloseTo(56.7, 0);
  });

  it("lb to grams", () => {
    const g = measureToGrams({ name: "beef", amount: 1, unit: "lb" });
    expect(g).toBeCloseTo(453.6, 0);
  });

  // ── Volume units ───────────────────────────────────────────────

  it("tbsp", () => {
    const g = measureToGrams({ name: "oil", amount: 1, unit: "tbsp" });
    expect(g).toBeCloseTo(14.79, 0);
  });

  it("tsp", () => {
    const g = measureToGrams({ name: "salt", amount: 1, unit: "tsp" });
    expect(g).toBeCloseTo(4.93, 0);
  });

  it("cup with default density", () => {
    const g = measureToGrams({ name: "flour", amount: 1, unit: "cup" });
    // 236.588 ml × 0.9 default density ≈ 213g
    expect(g).toBeGreaterThan(200);
    expect(g).toBeLessThan(225);
  });

  it("cup with explicit density override", () => {
    // Flour: 0.53 g/ml → 236.588 × 0.53 ≈ 125g
    const g = measureToGrams({ name: "flour", amount: 1, unit: "cup", gPerMl: 0.53 });
    expect(g).toBeGreaterThan(120);
    expect(g).toBeLessThan(135);
  });

  it("ml", () => {
    expect(measureToGrams({ name: "water", amount: 100, unit: "ml" })).toBe(100);
  });

  it("fl oz", () => {
    const g = measureToGrams({ name: "milk", amount: 1, unit: "fl oz" });
    expect(g).toBeCloseTo(29.57, 0);
  });

  // ── Countable units ────────────────────────────────────────────

  it("clove of garlic = 4g", () => {
    expect(measureToGrams({ name: "garlic", amount: 3, unit: "clove" })).toBe(12);
  });

  it("rasher of bacon = 28g", () => {
    expect(measureToGrams({ name: "bacon", amount: 2, unit: "rasher" })).toBe(56);
  });

  it("medium onion = 110g", () => {
    expect(measureToGrams({ name: "onion", amount: 1, unit: "medium" })).toBe(110);
  });

  it("large pepper = 180g", () => {
    expect(measureToGrams({ name: "pepper", amount: 1, unit: "large" })).toBe(180);
  });

  it("breast = 200g (raw)", () => {
    expect(measureToGrams({ name: "chicken", amount: 2, unit: "breast" })).toBe(400);
  });

  it("F-158: cooked chicken shredded × 2 breast = 300g (150g each)", () => {
    expect(poultryBreastGramsEach("cooked chicken shredded")).toBe(150);
    expect(measureToGrams({ name: "cooked chicken shredded", amount: 2, unit: "breast" })).toBe(300);
  });

  it("thigh = 120g", () => {
    expect(measureToGrams({ name: "chicken", amount: 3, unit: "thigh" })).toBe(360);
  });

  it("fillet = 170g", () => {
    expect(measureToGrams({ name: "salmon", amount: 1, unit: "fillet" })).toBe(170);
  });

  // ── Tins ───────────────────────────────────────────────────────

  it("tin of tomatoes = 400g", () => {
    expect(measureToGrams({ name: "chopped tomatoes", amount: 1, unit: "tin" })).toBe(400);
  });

  it("tin of beans = 240g (drained)", () => {
    expect(measureToGrams({ name: "chickpeas", amount: 1, unit: "tin" })).toBe(240);
  });

  it("tin of coconut milk = 400g (named variant)", () => {
    expect(measureToGrams({ name: "coconut milk", amount: 1, unit: "tin" })).toBe(400);
  });

  it("tin of tuna = 145g (drained)", () => {
    expect(measureToGrams({ name: "tuna", amount: 1, unit: "tin" })).toBe(145);
  });

  it("tin of anchovies = 50g", () => {
    expect(measureToGrams({ name: "anchovies", amount: 1, unit: "tin" })).toBe(50);
  });

  it("tin of generic unknown item = 220g fallback", () => {
    expect(measureToGrams({ name: "mystery paste", amount: 1, unit: "tin" })).toBe(220);
  });

  // ── Slices with food-specific weights ──────────────────────────

  it("slice of prosciutto = 10g", () => {
    expect(measureToGrams({ name: "prosciutto", amount: 4, unit: "slice" })).toBe(40);
  });

  it("slice of bread = 30g", () => {
    expect(measureToGrams({ name: "bread", amount: 2, unit: "slice" })).toBe(60);
  });

  it("slice of cheese = 20g", () => {
    expect(measureToGrams({ name: "cheese", amount: 3, unit: "slice" })).toBe(60);
  });

  // ── No unit (countable by name) ────────────────────────────────

  it("eggs without unit = 50g each", () => {
    const g = measureToGrams({ name: "egg", amount: 2, unit: "" });
    expect(g).toBe(100);
  });

  it("chicken breast without unit = 200g each", () => {
    const g = measureToGrams({ name: "chicken breast", amount: 1, unit: "" });
    expect(g).toBe(200);
  });

  it("banana without unit = medium (110g)", () => {
    const g = measureToGrams({ name: "banana", amount: 1, unit: "" });
    expect(g).toBe(110);
  });

  // ── Edge cases ─────────────────────────────────────────────────

  it("zero amount defaults to 1", () => {
    const g = measureToGrams({ name: "salt", amount: 0, unit: "tsp" });
    expect(g).toBeGreaterThan(0);
  });

  it("negative amount defaults to 1", () => {
    const g = measureToGrams({ name: "salt", amount: -5, unit: "tsp" });
    expect(g).toBeGreaterThan(0);
  });

  it("unknown unit returns 80g × amount", () => {
    const g = measureToGrams({ name: "something", amount: 2, unit: "blob" });
    expect(g).toBe(160);
  });

  // ── Missing units from audit ───────────────────────────────

  it("drizzle = 8g", () => {
    expect(measureToGrams({ name: "oil", amount: 1, unit: "drizzle" })).toBe(8);
  });

  it("dash = 2g", () => {
    expect(measureToGrams({ name: "soy sauce", amount: 1, unit: "dash" })).toBe(2);
  });

  it("splash = 10g", () => {
    expect(measureToGrams({ name: "wine", amount: 1, unit: "splash" })).toBe(10);
  });

  it("handful = 30g", () => {
    expect(measureToGrams({ name: "spinach", amount: 1, unit: "handful" })).toBe(30);
  });

  it("bunch = 60g", () => {
    expect(measureToGrams({ name: "parsley", amount: 1, unit: "bunch" })).toBe(60);
  });

  it("knob = 15g", () => {
    expect(measureToGrams({ name: "butter", amount: 1, unit: "knob" })).toBe(15);
  });

  it("head = 200g", () => {
    expect(measureToGrams({ name: "cauliflower", amount: 1, unit: "head" })).toBe(200);
  });

  it("chop = 150g", () => {
    expect(measureToGrams({ name: "pork", amount: 2, unit: "chop" })).toBe(300);
  });

  it("steak = 225g", () => {
    expect(measureToGrams({ name: "beef", amount: 1, unit: "steak" })).toBe(225);
  });

  it("herbs by name = 3g each", () => {
    expect(measureToGrams({ name: "oregano", amount: 1, unit: "" })).toBe(3);
    expect(measureToGrams({ name: "thyme", amount: 2, unit: "" })).toBe(6);
  });

  it("sausage by name = 50g each", () => {
    expect(measureToGrams({ name: "sausage", amount: 3, unit: "" })).toBe(150);
  });

  it("can unit = tin equivalent", () => {
    expect(measureToGrams({ name: "tomatoes", amount: 1, unit: "can" })).toBe(400);
    expect(measureToGrams({ name: "chickpeas", amount: 1, unit: "can" })).toBe(240);
  });

  it("l (liter) = 1000g", () => {
    expect(measureToGrams({ name: "water", amount: 1, unit: "l" })).toBe(1000);
  });

  // ── H13 — cup region constants ─────────────────────────────────

  it("exports US/UK/metric cup constants", () => {
    expect(ML_PER_CUP_US).toBeCloseTo(236.588, 3);
    expect(ML_PER_CUP_UK).toBe(284);
    expect(ML_PER_CUP_METRIC).toBe(250);
  });

  it("cup defaults to US convention when no region given", () => {
    const g = measureToGrams({ name: "water", amount: 1, unit: "cup", gPerMl: 1 });
    expect(g).toBeCloseTo(ML_PER_CUP_US, 1);
  });

  it("cup respects UK region", () => {
    const g = measureToGrams({ name: "water", amount: 1, unit: "cup", gPerMl: 1, cupRegion: "uk" });
    expect(g).toBe(ML_PER_CUP_UK);
  });

  it("cup respects metric region", () => {
    const g = measureToGrams({ name: "water", amount: 1, unit: "cup", gPerMl: 1, cupRegion: "metric" });
    expect(g).toBe(ML_PER_CUP_METRIC);
  });

  // ── H14 — density defaulted flag ───────────────────────────────

  it("flags densityDefaulted when cup conversion uses the 0.9 fallback", () => {
    const r = measureToGramsDetailed({ name: "mystery", amount: 1, unit: "cup" });
    expect(r.densityDefaulted).toBe(true);
  });

  it("does NOT flag densityDefaulted when caller provides gPerMl", () => {
    const r = measureToGramsDetailed({ name: "flour", amount: 1, unit: "cup", gPerMl: 0.53 });
    expect(r.densityDefaulted).toBeUndefined();
  });

  it("does NOT flag densityDefaulted for non-cup units", () => {
    const r = measureToGramsDetailed({ name: "beef", amount: 100, unit: "g" });
    expect(r.densityDefaulted).toBeUndefined();
  });

  // ── M5 — egg size modifiers ────────────────────────────────────

  it("2 medium eggs = 2 × 44g (not 2 × 110g)", () => {
    expect(measureToGrams({ name: "eggs", amount: 2, unit: "medium" })).toBe(88);
  });

  it("1 small egg = 38g", () => {
    expect(measureToGrams({ name: "egg", amount: 1, unit: "small" })).toBe(EGG_SIZE_G.small);
  });

  it("1 large egg = 50g", () => {
    expect(measureToGrams({ name: "egg", amount: 1, unit: "large" })).toBe(EGG_SIZE_G.large);
  });

  it("size modifier does NOT apply when the item is not an egg", () => {
    // A medium onion must still be 110g.
    expect(measureToGrams({ name: "onion", amount: 1, unit: "medium" })).toBe(110);
  });
});
