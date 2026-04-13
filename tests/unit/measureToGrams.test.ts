/**
 * Tests for unit-to-gram conversion.
 * Accuracy here affects all nutrition calculations.
 */
import { describe, it, expect } from "vitest";
import { measureToGrams } from "@/lib/nutrition/measureToGrams";

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
    // 236.588 ml × 0.55 default density ≈ 130g
    expect(g).toBeGreaterThan(120);
    expect(g).toBeLessThan(140);
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

  it("breast = 200g", () => {
    expect(measureToGrams({ name: "chicken", amount: 2, unit: "breast" })).toBe(400);
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

  it("tin of generic = 220g", () => {
    expect(measureToGrams({ name: "coconut milk", amount: 1, unit: "tin" })).toBe(220);
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
});
