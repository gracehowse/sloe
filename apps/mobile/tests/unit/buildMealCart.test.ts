import { describe, it, expect } from "vitest";
import {
  buildMealCartTotals,
  cartItemKcal,
  resolveMealName,
  type BuildMealCartItem,
} from "@/lib/buildMealCart";

/**
 * ENG-757 — build-meal cart pure logic, exercised through the MOBILE
 * import alias (`@/lib/buildMealCart` → `@suppr/shared/nutrition/
 * buildMealCart`). This pins that the mobile re-export shim resolves
 * and that the cart total + meal-name logic behaves identically to
 * web (web pins the same module in `tests/unit/buildMealCart.test.ts`).
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

describe("buildMealCartTotals (mobile alias)", () => {
  it("returns all-zero for an empty cart", () => {
    expect(buildMealCartTotals([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("sums multiple items, each scaled by its own servings", () => {
    const totals = buildMealCartTotals([
      item({ id: "a", kcal: 165, protein: 31, carbs: 0, fat: 3.6, servings: 1 }),
      item({ id: "b", kcal: 120, protein: 17, carbs: 7, fat: 3, servings: 2 }),
      item({ id: "c", kcal: 105, protein: 1.3, carbs: 27, fat: 0.4, servings: 1 }),
    ]);
    expect(totals.kcal).toBe(510);
    expect(totals.protein).toBeCloseTo(66.3, 5);
    expect(totals.carbs).toBeCloseTo(41, 5);
    expect(totals.fat).toBeCloseTo(10, 5);
  });

  it("clamps negative or non-finite values to 0", () => {
    const totals = buildMealCartTotals([
      item({ id: "a", kcal: -50, protein: 10, carbs: 20, fat: 5, servings: 1 }),
      item({ id: "b", kcal: Number.NaN, protein: 5, carbs: 5, fat: 5, servings: 1 }),
      item({ id: "c", kcal: 100, protein: 10, carbs: 10, fat: 10, servings: -2 }),
    ]);
    expect(totals.kcal).toBe(0);
    expect(totals.protein).toBe(15);
    expect(totals.carbs).toBe(25);
    expect(totals.fat).toBe(10);
  });
});

describe("cartItemKcal (mobile alias)", () => {
  it("returns rounded kcal × servings", () => {
    expect(cartItemKcal(item({ kcal: 165, servings: 2 }))).toBe(330);
  });
});

describe("resolveMealName (mobile alias)", () => {
  const single: BuildMealCartItem[] = [item({ title: "Greek yogurt, plain 2%" })];
  const multi: BuildMealCartItem[] = [
    item({ id: "a", title: "Chicken breast" }),
    item({ id: "b", title: "Brown rice" }),
    item({ id: "c", title: "Broccoli" }),
  ];

  it("prefers a trimmed typed name", () => {
    expect(resolveMealName("  Lunch bowl  ", multi)).toBe("Lunch bowl");
  });

  it("falls back to the single item's title", () => {
    expect(resolveMealName("", single)).toBe("Greek yogurt, plain 2%");
  });

  it('falls back to "N-item meal" for a multi-item cart', () => {
    expect(resolveMealName("", multi)).toBe("3-item meal");
  });
});
