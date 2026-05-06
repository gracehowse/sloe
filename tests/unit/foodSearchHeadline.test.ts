/**
 * Food-search headline helper — per-serving vs per-100g decision table.
 *
 * TestFlight build 11 `AKvgjnb` + `APGJJlg` (2026-04-19): the tester
 * reported "Everything defaults to 100g" and "Lots of foods still
 * defaulting to 100g" even after the primary-serving inference shipped.
 * The row render now delegates the badge + headline-kcal decision to
 * `resolveFoodSearchHeadline`, and this test pins the decision table
 * so a future refactor cannot silently regress back to per-100g copy.
 */
import { describe, expect, it } from "vitest";
import {
  FOOD_SEARCH_PER_100G_BADGE,
  FOOD_SEARCH_PER_SERVING_BADGE,
  resolveFoodSearchHeadline,
} from "@/lib/nutrition/foodSearchHeadline";
import type { PrimaryServing } from "@/lib/nutrition/primaryServing";

const pretSandwichPrimary: PrimaryServing = {
  label: "1 sandwich",
  grams: 230,
  kcal: 485,
  protein: 23.7,
  carbs: 55.4,
  fat: 17.7,
};

const pretPer100g = {
  calories: 211,
  protein: 10.3,
  carbs: 24.1,
  fat: 7.7,
};

describe("resolveFoodSearchHeadline — primary present", () => {
  it("picks per-serving mode when a primaryServing is attached", () => {
    const h = resolveFoodSearchHeadline({
      primaryServing: pretSandwichPrimary,
      macrosPer100g: { ...pretPer100g, fiberG: 0, sugarG: 0, sodiumMg: 0 } as never,
      calsPer100g: 211,
    });
    expect(h.mode).toBe("per-serving");
  });

  it("flips the headline kcal to the per-serving value (485, not 211)", () => {
    const h = resolveFoodSearchHeadline({
      primaryServing: pretSandwichPrimary,
      calsPer100g: 211,
    });
    if (h.mode !== "per-serving") throw new Error("wrong mode");
    expect(h.headlineKcal).toBe(485);
    expect(h.headlineKcal).not.toBe(211);
  });

  it("renders macros from the per-serving numbers, not per-100g", () => {
    const h = resolveFoodSearchHeadline({
      primaryServing: pretSandwichPrimary,
      macrosPer100g: pretPer100g,
    });
    if (h.mode !== "per-serving") throw new Error("wrong mode");
    expect(h.macros.calories).toBe(485);
    expect(h.macros.protein).toBe(23.7);
    expect(h.macros.carbs).toBe(55.4);
    expect(h.macros.fat).toBe(17.7);
  });

  it("sets the badge to the per-serving constant", () => {
    const h = resolveFoodSearchHeadline({ primaryServing: pretSandwichPrimary });
    if (h.mode !== "per-serving") throw new Error("wrong mode");
    expect(h.badge).toBe(FOOD_SEARCH_PER_SERVING_BADGE);
    expect(h.badge).toBe("per serving");
  });

  it('serving label reads "{label} ({grams} g)"', () => {
    const h = resolveFoodSearchHeadline({ primaryServing: pretSandwichPrimary });
    if (h.mode !== "per-serving") throw new Error("wrong mode");
    expect(h.servingLabel).toBe("1 sandwich (230 g)");
  });

  it("appends a per-100g reference when calsPer100g is a positive number", () => {
    const h = resolveFoodSearchHeadline({
      primaryServing: pretSandwichPrimary,
      calsPer100g: 211,
    });
    if (h.mode !== "per-serving") throw new Error("wrong mode");
    expect(h.per100gReference).toBe("211 kcal / 100 g");
  });

  it("omits the per-100g reference when calsPer100g is missing", () => {
    const h = resolveFoodSearchHeadline({
      primaryServing: pretSandwichPrimary,
      // no calsPer100g, no macrosPer100g
    });
    if (h.mode !== "per-serving") throw new Error("wrong mode");
    expect(h.per100gReference).toBeNull();
  });

  it("falls back to macrosPer100g.calories for the /100 g reference", () => {
    const h = resolveFoodSearchHeadline({
      primaryServing: pretSandwichPrimary,
      macrosPer100g: { calories: 260, protein: 5, carbs: 20, fat: 10 },
    });
    if (h.mode !== "per-serving") throw new Error("wrong mode");
    expect(h.per100gReference).toBe("260 kcal / 100 g");
  });
});

describe("resolveFoodSearchHeadline — primary absent", () => {
  it("drops to per-100g mode with full macro block when macrosPer100g is present", () => {
    const h = resolveFoodSearchHeadline({
      primaryServing: null,
      macrosPer100g: { calories: 180, protein: 9, carbs: 22, fat: 6 },
    });
    expect(h.mode).toBe("per-100g");
    if (h.mode !== "per-100g") throw new Error("wrong mode");
    expect(h.badge).toBe(FOOD_SEARCH_PER_100G_BADGE);
    expect(h.badge).toBe("per 100g");
    expect(h.headlineKcal).toBe(180);
    expect(h.macros).toEqual({ calories: 180, protein: 9, carbs: 22, fat: 6 });
  });

  it("still picks per-100g mode when only calsPer100g is populated (pre-backfill USDA row)", () => {
    const h = resolveFoodSearchHeadline({
      primaryServing: null,
      calsPer100g: 95,
    });
    expect(h.mode).toBe("per-100g");
    if (h.mode !== "per-100g") throw new Error("wrong mode");
    expect(h.badge).toBe("per 100g");
    expect(h.headlineKcal).toBe(95);
    expect(h.macros).toBeNull();
  });

  it("returns placeholder mode when nothing is known about the row", () => {
    const h = resolveFoodSearchHeadline({ primaryServing: null });
    expect(h.mode).toBe("placeholder");
  });

  it("treats calories=0 as placeholder, never invents a per-100g badge", () => {
    const h = resolveFoodSearchHeadline({
      primaryServing: null,
      macrosPer100g: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      calsPer100g: 0,
    });
    expect(h.mode).toBe("placeholder");
  });
});

describe("resolveFoodSearchHeadline — edge cases", () => {
  it("does not invent a serving when primary is explicitly null", () => {
    // Covers the CLAUDE.md rule: never invent nutrition values. A null
    // primaryServing must always route to per-100g or placeholder.
    const h = resolveFoodSearchHeadline({
      primaryServing: null,
      macrosPer100g: { calories: 300, protein: 10, carbs: 30, fat: 15 },
      calsPer100g: 300,
    });
    expect(h.mode).toBe("per-100g");
  });

  it("ignores non-finite calsPer100g values (NaN, Infinity) when picking the /100g reference", () => {
    const h = resolveFoodSearchHeadline({
      primaryServing: pretSandwichPrimary,
      calsPer100g: Number.NaN,
    });
    if (h.mode !== "per-serving") throw new Error("wrong mode");
    expect(h.per100gReference).toBeNull();
  });

  it("rounds the headline kcal to an integer", () => {
    const h = resolveFoodSearchHeadline({
      primaryServing: null,
      macrosPer100g: { calories: 120.4, protein: 5, carbs: 15, fat: 3 },
    });
    if (h.mode !== "per-100g") throw new Error("wrong mode");
    expect(h.headlineKcal).toBe(120);
  });

  it("rounds per-100g macros to 1dp so search rows don't render USDA Branded raw floats", () => {
    // 2026-05-06 — TestFlight feedback ("lots of random decimals on
    // some entries"): USDA Branded ships per-100g protein as raw
    // floats (e.g. 7.967347722423224). The search row renders
    // `P {macros.protein}g` directly, so anything past 1dp leaks
    // into the UI. Pin: macros come back rounded to 1dp.
    const h = resolveFoodSearchHeadline({
      primaryServing: null,
      macrosPer100g: {
        calories: 141.234,
        protein: 7.967347722423224,
        carbs: 14.500830618896225,
        fat: 5.876200094747999,
      },
    });
    if (h.mode !== "per-100g" || !h.macros) throw new Error("wrong mode");
    expect(h.macros).toEqual({
      calories: 141,
      protein: 8,
      carbs: 14.5,
      fat: 5.9,
    });
  });

  it("rounds per-serving macros to 1dp so primary-serving rows don't render raw floats", () => {
    const h = resolveFoodSearchHeadline({
      primaryServing: {
        label: "1 patty",
        grams: 92,
        kcal: 257,
        protein: 25.6789,
        carbs: 12.34567,
        fat: 9.87654321,
      },
    });
    if (h.mode !== "per-serving") throw new Error("wrong mode");
    expect(h.macros).toEqual({
      calories: 257,
      protein: 25.7,
      carbs: 12.3,
      fat: 9.9,
    });
  });
});
