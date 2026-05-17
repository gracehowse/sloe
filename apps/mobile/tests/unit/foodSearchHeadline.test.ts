/**
 * Mobile food-search headline — per-serving vs per-100g decision table.
 *
 * TestFlight build 11 `AKvgjnb` + `APGJJlg` (2026-04-19): tester reports
 * "Everything defaults to 100g". The mobile row render now delegates
 * the headline-kcal + badge decision to the shared helper at
 * `src/lib/nutrition/foodSearchHeadline.ts`. This test pins the decision
 * for the mobile side so if the import is ever re-implemented inline
 * (or worse, re-pointed to a mobile-only clone) the assertion breaks.
 *
 * Complements the web-side pin in
 * `tests/unit/foodSearchHeadline.test.ts`. Both surfaces must observe
 * identical mode / badge / headlineKcal outputs for the same row inputs.
 */
import { describe, expect, it } from "vitest";
import {
  FOOD_SEARCH_PER_100G_BADGE,
  FOOD_SEARCH_PER_SERVING_BADGE,
  resolveFoodSearchHeadline,
} from "@suppr/shared/nutrition/foodSearchHeadline";
import type { PrimaryServing } from "@suppr/shared/nutrition/primaryServing";

// "4 tacos (99 g)" shape from the tester's `APGJJlg` screenshot.
// Per-100g base: 263 kcal. Primary: 99 g → round(263 × 0.99) = 260.
const tacoPrimary: PrimaryServing = {
  label: "4 tacos",
  grams: 99,
  kcal: 260,
  protein: 18.0,
  carbs: 26.0,
  fat: 10.0,
};
const tacoPer100g = { calories: 263, protein: 18.2, carbs: 26.3, fat: 10.1 };

describe("mobile food-search headline — per-serving path", () => {
  it("picks per-serving mode when the source supplied a primary portion (taco chicken row)", () => {
    const h = resolveFoodSearchHeadline({
      primaryServing: tacoPrimary,
      macrosPer100g: tacoPer100g,
      calsPer100g: 263,
    });
    expect(h.mode).toBe("per-serving");
    if (h.mode !== "per-serving") throw new Error("wrong mode");
    // Right-rail headline must show the per-serving kcal (260), not 263.
    expect(h.headlineKcal).toBe(260);
    expect(h.badge).toBe(FOOD_SEARCH_PER_SERVING_BADGE);
    expect(h.servingLabel).toBe("4 tacos (99 g)");
    expect(h.per100gReference).toBe("263 kcal / 100 g");
  });

  it("macros strip shows per-serving numbers (260/18/26/10) not per-100g", () => {
    const h = resolveFoodSearchHeadline({
      primaryServing: tacoPrimary,
      macrosPer100g: tacoPer100g,
    });
    if (h.mode !== "per-serving") throw new Error("wrong mode");
    expect(h.macros).toEqual({
      calories: 260,
      protein: 18,
      carbs: 26,
      fat: 10,
    });
  });
});

describe("mobile food-search headline — per-100g fallback", () => {
  it('falls back to per-100g + "per 100g" badge when the source had no natural portion (eggs benedict)', () => {
    const h = resolveFoodSearchHeadline({
      primaryServing: null,
      macrosPer100g: { calories: 214, protein: 10.2, carbs: 14.3, fat: 13.5 },
    });
    expect(h.mode).toBe("per-100g");
    if (h.mode !== "per-100g") throw new Error("wrong mode");
    expect(h.badge).toBe(FOOD_SEARCH_PER_100G_BADGE);
    expect(h.badge).toBe("per 100g");
    expect(h.headlineKcal).toBe(214);
  });

  it("falls back to per-100g even when only calsPer100g was populated (pre-backfill)", () => {
    const h = resolveFoodSearchHeadline({
      primaryServing: null,
      calsPer100g: 142,
    });
    if (h.mode !== "per-100g") throw new Error("wrong mode");
    expect(h.headlineKcal).toBe(142);
    expect(h.macros).toBeNull();
  });

  it("returns placeholder when the row has no nutrition at all — never invents a badge", () => {
    const h = resolveFoodSearchHeadline({ primaryServing: null });
    expect(h.mode).toBe("placeholder");
  });
});

describe("mobile food-search headline — badge constants are shared", () => {
  it("both platforms use exactly the same strings", () => {
    // A web-side test pins the same constants; this test ensures the
    // mobile import resolves to the same strings (no drift via tsconfig
    // path alias or wrong module).
    expect(FOOD_SEARCH_PER_SERVING_BADGE).toBe("per serving");
    expect(FOOD_SEARCH_PER_100G_BADGE).toBe("per 100g");
  });
});
