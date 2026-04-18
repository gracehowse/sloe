import { describe, expect, it } from "vitest";
import {
  effectiveMacros,
  hasOverride,
  recomputeRecipeTotals,
  sanitizeOverrideInput,
  type IngredientOverride,
  type RecipeIngredientLike,
} from "@/lib/nutrition/ingredientOverrides";

/**
 * Batch 2.7 — per-ingredient overrides + user-added rows.
 *
 * These tests lock down the shared totaliser so web (`RecipeDetail`) and
 * mobile (`app/recipe/verify.tsx`) cannot drift on:
 *   - override precedence (override replaces match)
 *   - zero / negative / fractional servings (clamped to 1)
 *   - user-added rows (counted in sums)
 *   - fiber visibility (only present when at least one row contributes it)
 */

function row(partial: Partial<RecipeIngredientLike>): RecipeIngredientLike {
  return {
    calories: 100,
    protein: 10,
    carbs: 10,
    fat: 5,
    fiberG: 0,
    ...partial,
  };
}

describe("effectiveMacros", () => {
  it("returns the override when all 4 macros are finite", () => {
    const override: IngredientOverride = { calories: 200, protein: 30, carbs: 10, fat: 8 };
    const eff = effectiveMacros(row({ calories: 100, protein: 10, carbs: 10, fat: 5, overrideMacros: override }));
    expect(eff.calories).toBe(200);
    expect(eff.protein).toBe(30);
    expect(eff.carbs).toBe(10);
    expect(eff.fat).toBe(8);
  });

  it("returns matched macros when no override is set", () => {
    const eff = effectiveMacros(row({ calories: 80, protein: 5, carbs: 12, fat: 2 }));
    expect(eff.calories).toBe(80);
    expect(eff.protein).toBe(5);
    expect(eff.carbs).toBe(12);
    expect(eff.fat).toBe(2);
  });

  it("handles null / undefined ingredient defensively", () => {
    expect(effectiveMacros(null)).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    expect(effectiveMacros(undefined)).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("ignores a malformed override (non-finite calories) and falls back to the match", () => {
    const bad = { calories: Number.NaN, protein: 10, carbs: 10, fat: 5 } as unknown as IngredientOverride;
    const eff = effectiveMacros(row({ calories: 77, overrideMacros: bad }));
    // Fallback to the matched snapshot because the override is not usable.
    expect(eff.calories).toBe(77);
  });

  it("includes override fiber when present, else matched fiber", () => {
    const withOvFiber = effectiveMacros(
      row({
        fiberG: 2,
        overrideMacros: { calories: 100, protein: 10, carbs: 10, fat: 5, fiber: 6 },
      }),
    );
    expect(withOvFiber.fiber).toBe(6);

    const withMatchedFiber = effectiveMacros(row({ fiberG: 4 }));
    expect(withMatchedFiber.fiber).toBe(4);

    const noFiber = effectiveMacros(row({ fiberG: 0 }));
    // A fiberG of 0 is indistinguishable from "not tracked" on the snapshot
    // column — the helper omits `fiber` so totals don't falsely light up
    // the fiber column.
    expect(noFiber.fiber).toBeUndefined();
  });
});

describe("hasOverride", () => {
  it("is true only when all 4 macros are finite numbers", () => {
    expect(hasOverride(null)).toBe(false);
    expect(hasOverride(row({}))).toBe(false);
    expect(
      hasOverride(
        row({ overrideMacros: { calories: 100, protein: 10, carbs: 10, fat: 5 } }),
      ),
    ).toBe(true);
    expect(
      hasOverride(
        row({
          overrideMacros: { calories: 100, protein: Number.NaN, carbs: 10, fat: 5 } as unknown as IngredientOverride,
        }),
      ),
    ).toBe(false);
  });
});

describe("recomputeRecipeTotals", () => {
  it("per-serving: sums effective macros and divides by servings", () => {
    const ings: RecipeIngredientLike[] = [
      row({ calories: 200, protein: 20, carbs: 10, fat: 10 }),
      row({ calories: 200, protein: 20, carbs: 10, fat: 10 }),
    ];
    const totals = recomputeRecipeTotals(ings, 2);
    expect(totals.calories).toBe(200);
    expect(totals.protein).toBe(20);
    expect(totals.carbs).toBe(10);
    expect(totals.fat).toBe(10);
    expect(totals.fiber).toBeUndefined();
  });

  it("overrides take precedence over matched snapshot when summing", () => {
    const ings: RecipeIngredientLike[] = [
      // matched 100 kcal, overridden to 300 kcal → override wins
      row({
        calories: 100,
        protein: 5,
        carbs: 5,
        fat: 2,
        overrideMacros: { calories: 300, protein: 30, carbs: 20, fat: 10 },
      }),
      row({ calories: 100, protein: 5, carbs: 5, fat: 2 }),
    ];
    const totals = recomputeRecipeTotals(ings, 1);
    expect(totals.calories).toBe(400);
    expect(totals.protein).toBe(35);
    expect(totals.carbs).toBe(25);
    expect(totals.fat).toBe(12);
  });

  it("counts user-added rows (addedByUser: true) in the sum", () => {
    const ings: RecipeIngredientLike[] = [
      row({ calories: 100, protein: 5, carbs: 5, fat: 2 }),
      row({ calories: 75, protein: 3, carbs: 1, fat: 6, addedByUser: true }),
    ];
    const totals = recomputeRecipeTotals(ings, 1);
    expect(totals.calories).toBe(175);
    expect(totals.protein).toBe(8);
  });

  it("clamps 0 servings to 1 (never divides by zero)", () => {
    const ings: RecipeIngredientLike[] = [row({ calories: 400 })];
    expect(recomputeRecipeTotals(ings, 0).calories).toBe(400);
    expect(recomputeRecipeTotals(ings, -3).calories).toBe(400);
    expect(recomputeRecipeTotals(ings, Number.NaN).calories).toBe(400);
  });

  it("fractional servings divide normally", () => {
    const ings: RecipeIngredientLike[] = [row({ calories: 100 })];
    expect(recomputeRecipeTotals(ings, 0.5).calories).toBe(200);
  });

  it("all-overrides case uses every override", () => {
    const ings: RecipeIngredientLike[] = [
      row({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        overrideMacros: { calories: 200, protein: 10, carbs: 5, fat: 5 },
      }),
      row({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        overrideMacros: { calories: 100, protein: 5, carbs: 5, fat: 2 },
      }),
    ];
    const totals = recomputeRecipeTotals(ings, 1);
    expect(totals.calories).toBe(300);
    expect(totals.protein).toBe(15);
  });

  it("fiber present only when any row contributes fiber", () => {
    const noFiber = recomputeRecipeTotals(
      [row({ fiberG: 0 }), row({ fiberG: 0 })],
      2,
    );
    // No row contributed fiber (all zero without explicit value) — fiber is
    // omitted from the result to avoid falsely looking "tracked".
    expect(noFiber.fiber).toBeUndefined();

    const someFiber = recomputeRecipeTotals([row({ fiberG: 4 }), row({ fiberG: 0 })], 1);
    expect(someFiber.fiber).toBe(4);
  });

  it("mixed rows: matched + override + user-added + zero", () => {
    const ings: RecipeIngredientLike[] = [
      row({ calories: 200, protein: 15, carbs: 10, fat: 5 }),
      row({
        calories: 200,
        protein: 15,
        carbs: 10,
        fat: 5,
        overrideMacros: { calories: 300, protein: 25, carbs: 15, fat: 8 },
      }),
      row({ calories: 100, protein: 10, carbs: 5, fat: 3, addedByUser: true }),
      row({ calories: 0, protein: 0, carbs: 0, fat: 0 }),
    ];
    const totals = recomputeRecipeTotals(ings, 2);
    expect(totals.calories).toBe(Math.round((200 + 300 + 100 + 0) / 2));
    expect(totals.protein).toBe(Math.round(((15 + 25 + 10 + 0) / 2) * 10) / 10);
  });

  it("rounds to 1 decimal for protein/carbs/fat and integer for calories", () => {
    const ings: RecipeIngredientLike[] = [row({ calories: 101, protein: 3.33, carbs: 3.33, fat: 3.33 })];
    const totals = recomputeRecipeTotals(ings, 3);
    expect(totals.calories).toBe(Math.round(101 / 3));
    expect(totals.protein).toBeCloseTo(Math.round((3.33 / 3) * 10) / 10, 2);
  });

  it("empty ingredient list returns zeros and omits fiber", () => {
    const totals = recomputeRecipeTotals([], 2);
    expect(totals).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });
});

describe("sanitizeOverrideInput", () => {
  it("returns null when every field is empty / undefined", () => {
    expect(sanitizeOverrideInput({})).toBeNull();
    expect(
      sanitizeOverrideInput({ calories: null, protein: null, carbs: null, fat: null }),
    ).toBeNull();
    expect(sanitizeOverrideInput({ calories: "", protein: "", carbs: "", fat: "" })).toBeNull();
  });

  it("returns an explicit-zero override when the user typed zeros", () => {
    const ov = sanitizeOverrideInput({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    expect(ov).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("coerces numeric strings to numbers and preserves fiber when typed", () => {
    const ov = sanitizeOverrideInput({
      calories: "180",
      protein: "22",
      carbs: "5.5",
      fat: "3",
      fiber: "2.5",
    });
    expect(ov).toEqual({ calories: 180, protein: 22, carbs: 5.5, fat: 3, fiber: 2.5 });
  });

  it("rejects negative / non-finite values by clamping to 0", () => {
    const ov = sanitizeOverrideInput({ calories: -5, protein: Number.NaN, carbs: 10, fat: "abc" });
    expect(ov).toEqual({ calories: 0, protein: 0, carbs: 10, fat: 0 });
  });
});
