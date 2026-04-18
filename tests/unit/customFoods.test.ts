/**
 * Pure-helper tests for custom foods (Batch 3.9).
 *
 * These cover the logic that silently powers scaling + dedupe + name
 * normalisation. If any of these drift, web vs mobile UIs can display
 * different macros for the same food — which is the failure mode we
 * most want to catch before it ships.
 */
import { describe, expect, it } from "vitest";
import {
  buildCustomFoodPortions,
  customFoodToMacrosPer100g,
  dedupeServings,
  normaliseCustomFoodName,
  resolvePortionToGrams,
  scaleMacrosForGrams,
  type CustomFood,
} from "@/lib/nutrition/customFoods";

describe("scaleMacrosForGrams", () => {
  const food = {
    baseGrams: 100,
    calories: 400,
    protein: 10,
    carbs: 60,
    fat: 12,
  };

  it("scales linearly to the requested gram weight", () => {
    expect(scaleMacrosForGrams(food, 100)).toEqual({
      calories: 400,
      protein: 10,
      carbs: 60,
      fat: 12,
    });
    expect(scaleMacrosForGrams(food, 50)).toEqual({
      calories: 200,
      protein: 5,
      carbs: 30,
      fat: 6,
    });
    expect(scaleMacrosForGrams(food, 80)).toEqual({
      calories: 320,
      protein: 8,
      carbs: 48,
      fat: 9.6,
    });
  });

  it("rounds calories to integer and macros to one decimal", () => {
    const withDecimals = {
      baseGrams: 100,
      calories: 123.456,
      protein: 7.77,
      carbs: 3.333,
      fat: 1.111,
    };
    expect(scaleMacrosForGrams(withDecimals, 100)).toEqual({
      calories: 123,
      protein: 7.8,
      carbs: 3.3,
      fat: 1.1,
    });
  });

  it("returns zeros when grams is zero or negative (never NaN)", () => {
    expect(scaleMacrosForGrams(food, 0)).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
    expect(scaleMacrosForGrams(food, -10)).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it("guards against baseGrams = 0 (never divides by zero, never invents)", () => {
    expect(scaleMacrosForGrams({ ...food, baseGrams: 0 }, 100)).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it("is NaN-safe across all inputs", () => {
    const out = scaleMacrosForGrams(
      // @ts-expect-error — testing runtime coercion of bad input
      { baseGrams: "oops", calories: Number.NaN, protein: null, carbs: undefined, fat: 0 },
      100,
    );
    expect(out).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    // @ts-expect-error — testing runtime coercion
    expect(scaleMacrosForGrams(food, "bad")).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it("echoes fiber only when the source food has a numeric fiber", () => {
    // With fiber — scales and rounds.
    expect(scaleMacrosForGrams({ ...food, fiber: 6 }, 50)).toEqual({
      calories: 200,
      protein: 5,
      carbs: 30,
      fat: 6,
      fiber: 3,
    });
    // Without fiber — no fiber key on output.
    const out = scaleMacrosForGrams(food, 50);
    expect("fiber" in out).toBe(false);
    // Zero-grams path still echoes fiber key (so UI isn't shown a
    // disappearing column) — but as 0, not NaN.
    expect(scaleMacrosForGrams({ ...food, fiber: 6 }, 0)).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
    });
  });
});

describe("resolvePortionToGrams", () => {
  const food: Pick<CustomFood, "servings"> = {
    servings: [
      { label: "1 bowl", grams: 80 },
      { label: "1 tbsp", grams: 12 },
      { label: "1 cup", grams: 120 },
    ],
  };

  it("returns grams directly when the portion is a raw gram input", () => {
    expect(resolvePortionToGrams(food, { type: "grams", grams: 55 })).toBe(55);
  });

  it("clamps negative / non-finite grams to 0 for the grams branch", () => {
    expect(resolvePortionToGrams(food, { type: "grams", grams: -5 })).toBe(0);
    expect(
      // @ts-expect-error — testing runtime coercion
      resolvePortionToGrams(food, { type: "grams", grams: "bad" }),
    ).toBe(0);
  });

  it("resolves a named serving × quantity", () => {
    expect(
      resolvePortionToGrams(food, { type: "serving", label: "1 bowl", quantity: 2 }),
    ).toBe(160);
    expect(
      resolvePortionToGrams(food, { type: "serving", label: "1 tbsp", quantity: 3 }),
    ).toBe(36);
  });

  it("is case-insensitive on the label match", () => {
    expect(
      resolvePortionToGrams(food, { type: "serving", label: "1 BOWL", quantity: 1 }),
    ).toBe(80);
    expect(
      resolvePortionToGrams(food, { type: "serving", label: "  1 Cup  ", quantity: 1 }),
    ).toBe(120);
  });

  it("throws on an unknown serving label (fail-fast — never silently log 0)", () => {
    expect(() =>
      resolvePortionToGrams(food, { type: "serving", label: "1 scoop", quantity: 1 }),
    ).toThrow(/unknown serving label/);
  });

  it("throws on an empty serving label", () => {
    expect(() =>
      resolvePortionToGrams(food, { type: "serving", label: "", quantity: 1 }),
    ).toThrow(/serving label is required/);
  });

  it("returns 0 if quantity is zero or negative (never negative grams)", () => {
    expect(
      resolvePortionToGrams(food, { type: "serving", label: "1 bowl", quantity: 0 }),
    ).toBe(0);
    expect(
      resolvePortionToGrams(food, { type: "serving", label: "1 bowl", quantity: -2 }),
    ).toBe(0);
  });
});

describe("normaliseCustomFoodName", () => {
  it("trims and collapses internal whitespace", () => {
    expect(normaliseCustomFoodName("  Homemade   granola  ")).toBe("Homemade granola");
    expect(normaliseCustomFoodName("Bread\n\trolls")).toBe("Bread rolls");
  });

  it("caps at 120 characters", () => {
    const long = "a".repeat(150);
    const out = normaliseCustomFoodName(long);
    expect(out.length).toBe(120);
    expect(out).toBe("a".repeat(120));
  });

  it("returns empty string for non-string / empty / whitespace-only input", () => {
    expect(normaliseCustomFoodName("")).toBe("");
    expect(normaliseCustomFoodName("     ")).toBe("");
    // @ts-expect-error — testing runtime coercion
    expect(normaliseCustomFoodName(undefined)).toBe("");
    // @ts-expect-error — testing runtime coercion
    expect(normaliseCustomFoodName(null)).toBe("");
    // @ts-expect-error — testing runtime coercion
    expect(normaliseCustomFoodName(123)).toBe("");
  });
});

describe("dedupeServings", () => {
  it("drops rows with empty labels or grams <= 0", () => {
    const out = dedupeServings([
      { label: "1 bowl", grams: 80 },
      { label: "", grams: 50 },
      { label: "  ", grams: 10 },
      { label: "1 scoop", grams: 0 },
      { label: "1 tbsp", grams: -5 },
      { label: "1 cup", grams: 120 },
    ]);
    expect(out.map((s) => s.label)).toEqual(["1 bowl", "1 cup"]);
  });

  it("dedupes case-insensitively, keeping the first occurrence", () => {
    const out = dedupeServings([
      { label: "1 Bowl", grams: 80 },
      { label: "1 BOWL", grams: 999 }, // ignored — duplicate
      { label: "1 bowl", grams: 999 }, // ignored — duplicate
      { label: "1 cup", grams: 120 },
    ]);
    expect(out).toEqual([
      { label: "1 Bowl", grams: 80 },
      { label: "1 cup", grams: 120 },
    ]);
  });

  it("collapses whitespace on labels so '1  bowl' dedupes against '1 bowl'", () => {
    const out = dedupeServings([
      { label: "1 bowl", grams: 80 },
      { label: "1  bowl", grams: 999 },
    ]);
    expect(out).toEqual([{ label: "1 bowl", grams: 80 }]);
  });

  it("returns an empty array for non-array / garbage input", () => {
    // @ts-expect-error — testing runtime coercion
    expect(dedupeServings(null)).toEqual([]);
    // @ts-expect-error — testing runtime coercion
    expect(dedupeServings(undefined)).toEqual([]);
    // @ts-expect-error — testing runtime coercion
    expect(dedupeServings([null, undefined, 42, "oops"])).toEqual([]);
  });

  it("rounds grams to two decimals (matches server-side tolerance)", () => {
    const out = dedupeServings([{ label: "1 bowl", grams: 80.12345 }]);
    expect(out).toEqual([{ label: "1 bowl", grams: 80.12 }]);
  });
});

// ── Food-search adapters (Batch 3.9 wire-up) ────────────────────────
//
// These helpers power the "Custom" rows + portion chips inside
// `FoodSearch.tsx` (web) and `FoodSearchModal.tsx` (mobile). They must
// agree to the byte so a homemade granola row doesn't scale to different
// macros on different platforms. If these tests drift, so does the UI.
describe("customFoodToMacrosPer100g", () => {
  it("is a no-op when macros already reference 100g", () => {
    expect(
      customFoodToMacrosPer100g({
        baseGrams: 100,
        calories: 400,
        protein: 10,
        carbs: 60,
        fat: 12,
      }),
    ).toEqual({
      calories: 400,
      protein: 10,
      carbs: 60,
      fat: 12,
      fiberG: 0,
      sugarG: 0,
      sodiumMg: 0,
    });
  });

  it("projects 80g-basis macros onto 100g (factor 1.25)", () => {
    expect(
      customFoodToMacrosPer100g({
        baseGrams: 80,
        calories: 200,
        protein: 8,
        carbs: 20,
        fat: 6,
        fiber: 4,
      }),
    ).toEqual({
      calories: 250,
      protein: 10,
      carbs: 25,
      fat: 7.5,
      fiberG: 5,
      sugarG: 0,
      sodiumMg: 0,
    });
  });

  it("falls back to a 100g basis when baseGrams is zero, negative or non-finite", () => {
    // Zero basis → fall back to 100 so we don't divide by zero.
    expect(
      customFoodToMacrosPer100g({
        baseGrams: 0,
        calories: 300,
        protein: 5,
        carbs: 40,
        fat: 10,
      }).calories,
    ).toBe(300);
    expect(
      customFoodToMacrosPer100g({
        baseGrams: -5,
        calories: 300,
        protein: 5,
        carbs: 40,
        fat: 10,
      }).calories,
    ).toBe(300);
    expect(
      customFoodToMacrosPer100g({
        baseGrams: Number.NaN,
        calories: 300,
        protein: 5,
        carbs: 40,
        fat: 10,
      }).calories,
    ).toBe(300);
  });

  it("echoes fiberG as 0 when the food has no saved fiber", () => {
    const out = customFoodToMacrosPer100g({
      baseGrams: 100,
      calories: 100,
      protein: 5,
      carbs: 10,
      fat: 2,
    });
    expect(out.fiberG).toBe(0);
    expect(out.sugarG).toBe(0);
    expect(out.sodiumMg).toBe(0);
  });

  it("rounds consistently with scaleMacrosForGrams so logs match previews", () => {
    const food = {
      baseGrams: 30,
      calories: 133,
      protein: 4.7,
      carbs: 24.2,
      fat: 1.1,
    };
    const per100 = customFoodToMacrosPer100g(food);
    // A 30g portion should re-derive the original macros (mod rounding).
    expect(per100.calories).toBeCloseTo(Math.round((133 / 30) * 100), 0);
    expect(per100.protein).toBeCloseTo(Math.round((4.7 / 30) * 100 * 10) / 10, 1);
  });
});

describe("buildCustomFoodPortions", () => {
  it("always exposes grams as the first chip so users can log any weight", () => {
    const out = buildCustomFoodPortions({ servings: [] });
    expect(out).toEqual([{ label: "g", gramWeight: 1, amount: 1 }]);
  });

  it("appends one chip per saved serving in order", () => {
    const out = buildCustomFoodPortions({
      servings: [
        { label: "1 bowl", grams: 80 },
        { label: "1 cup", grams: 120 },
      ],
    });
    expect(out).toEqual([
      { label: "g", gramWeight: 1, amount: 1 },
      { label: "1 bowl", gramWeight: 80, amount: 1 },
      { label: "1 cup", gramWeight: 120, amount: 1 },
    ]);
  });

  it("drops empty labels and non-positive gram weights via dedupeServings", () => {
    const out = buildCustomFoodPortions({
      servings: [
        { label: "", grams: 80 },
        { label: "  ", grams: 50 },
        { label: "1 bowl", grams: 0 },
        { label: "1 bowl", grams: -5 },
        { label: "1 bowl", grams: 80 },
      ],
    });
    expect(out).toEqual([
      { label: "g", gramWeight: 1, amount: 1 },
      { label: "1 bowl", gramWeight: 80, amount: 1 },
    ]);
  });

  it("dedupes servings case-insensitively so '1 BOWL' cannot shadow '1 bowl'", () => {
    const out = buildCustomFoodPortions({
      servings: [
        { label: "1 bowl", grams: 80 },
        { label: "1 BOWL", grams: 999 },
      ],
    });
    expect(out).toEqual([
      { label: "g", gramWeight: 1, amount: 1 },
      { label: "1 bowl", gramWeight: 80, amount: 1 },
    ]);
  });

  it("treats missing `servings` as an empty array (never throws)", () => {
    // Rare but possible: a partially-hydrated row from a stale cache.
    const out = buildCustomFoodPortions({ servings: undefined as unknown as CustomFood["servings"] });
    expect(out).toEqual([{ label: "g", gramWeight: 1, amount: 1 }]);
  });
});
