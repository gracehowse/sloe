import { describe, it, expect } from "vitest";
import {
  buildMealCartTotals,
  cartItemKcal,
  resolveMealName,
  type BuildMealCartItem,
} from "@/lib/nutrition/buildMealCart";

/**
 * ENG-757 — build-meal cart pure logic. This module is the single
 * source of truth for the cart total + combined-meal naming shared by
 * web (`src/app/components/suppr/log-sheet.tsx`) and mobile
 * (`apps/mobile/components/today/LogSheet.tsx`). These tests protect:
 *   - cart totals = sum of (per-item macros × servings)
 *   - meal-name fallback priority (typed → single title → "N-item meal")
 *   - defensive clamping (no invented or negative nutrition)
 */

function item(over: Partial<BuildMealCartItem> = {}): BuildMealCartItem {
  return {
    id: "c1",
    title: "Food",
    kcal: 100,
    protein: 10,
    carbs: 20,
    fat: 5,
    servings: 1,
    ...over,
  };
}

describe("buildMealCartTotals", () => {
  it("returns all-zero for an empty cart", () => {
    expect(buildMealCartTotals([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("passes a single item through unchanged (servings 1)", () => {
    const totals = buildMealCartTotals([item({ kcal: 165, protein: 31, carbs: 0, fat: 3.6 })]);
    expect(totals).toEqual({ kcal: 165, protein: 31, carbs: 0, fat: 3.6 });
  });

  it("multiplies each item's macros by its servings", () => {
    const totals = buildMealCartTotals([
      item({ id: "a", kcal: 100, protein: 10, carbs: 20, fat: 5, servings: 2 }),
    ]);
    expect(totals).toEqual({ kcal: 200, protein: 20, carbs: 40, fat: 10 });
  });

  it("sums multiple items, each scaled by its own servings", () => {
    const totals = buildMealCartTotals([
      item({ id: "a", kcal: 165, protein: 31, carbs: 0, fat: 3.6, servings: 1 }),
      item({ id: "b", kcal: 120, protein: 17, carbs: 7, fat: 3, servings: 2 }),
      item({ id: "c", kcal: 105, protein: 1.3, carbs: 27, fat: 0.4, servings: 1 }),
    ]);
    // kcal: 165 + 240 + 105 = 510
    expect(totals.kcal).toBe(510);
    // protein: 31 + 34 + 1.3 = 66.3
    expect(totals.protein).toBeCloseTo(66.3, 5);
    // carbs: 0 + 14 + 27 = 41
    expect(totals.carbs).toBeCloseTo(41, 5);
    // fat: 3.6 + 6 + 0.4 = 10
    expect(totals.fat).toBeCloseTo(10, 5);
  });

  it("rounds kcal to a whole number and macros to one decimal", () => {
    const totals = buildMealCartTotals([
      item({ kcal: 33.4, protein: 0.77, carbs: 7.74, fat: 0.31, servings: 3 }),
    ]);
    // kcal 100.2 → 100; protein 2.31 → 2.3; carbs 23.22 → 23.2; fat 0.93 → 0.9
    expect(totals.kcal).toBe(100);
    expect(totals.protein).toBe(2.3);
    expect(totals.carbs).toBe(23.2);
    expect(totals.fat).toBe(0.9);
  });

  it("clamps negative or non-finite values to 0 (never invents nutrition)", () => {
    const totals = buildMealCartTotals([
      item({ id: "a", kcal: -50, protein: 10, carbs: 20, fat: 5, servings: 1 }),
      item({ id: "b", kcal: Number.NaN, protein: 5, carbs: 5, fat: 5, servings: 1 }),
      item({ id: "c", kcal: 100, protein: 10, carbs: 10, fat: 10, servings: -2 }),
    ]);
    // Only the protein/carbs/fat of item a survive; item b kcal NaN→0;
    // item c servings -2 → 0 so it contributes nothing.
    expect(totals.kcal).toBe(0);
    expect(totals.protein).toBe(15);
    expect(totals.carbs).toBe(25);
    expect(totals.fat).toBe(10);
  });
});

describe("cartItemKcal", () => {
  it("returns rounded kcal × servings for a single row", () => {
    expect(cartItemKcal(item({ kcal: 165, servings: 2 }))).toBe(330);
    expect(cartItemKcal(item({ kcal: 33.4, servings: 3 }))).toBe(100);
  });

  it("clamps bad values to 0", () => {
    expect(cartItemKcal(item({ kcal: -10, servings: 2 }))).toBe(0);
    expect(cartItemKcal(item({ kcal: 100, servings: Number.NaN }))).toBe(0);
  });
});

describe("resolveMealName", () => {
  const single: BuildMealCartItem[] = [item({ title: "Greek yogurt, plain 2%" })];
  const multi: BuildMealCartItem[] = [
    item({ id: "a", title: "Chicken breast" }),
    item({ id: "b", title: "Brown rice" }),
    item({ id: "c", title: "Broccoli" }),
  ];

  it("prefers a non-blank typed name (trimmed)", () => {
    expect(resolveMealName("  Lunch bowl  ", multi)).toBe("Lunch bowl");
    expect(resolveMealName("Lunch bowl", single)).toBe("Lunch bowl");
  });

  it("falls back to the single item's title when no name typed", () => {
    expect(resolveMealName("", single)).toBe("Greek yogurt, plain 2%");
    expect(resolveMealName("   ", single)).toBe("Greek yogurt, plain 2%");
  });

  it('falls back to "N-item meal" for a multi-item cart', () => {
    expect(resolveMealName("", multi)).toBe("3-item meal");
  });

  it("typed name wins even over a multi-item cart", () => {
    expect(resolveMealName("Dinner", multi)).toBe("Dinner");
  });
});
