/**
 * Recipe-detail viewing-servings stepper helpers — pure-helper coverage
 * for `src/lib/nutrition/recipeViewScale.ts`.
 *
 * The DOM-level interaction (stepper +/- on the screen) is exercised
 * separately by `recipeViewScaleScreens.test.tsx`. This file locks
 * the bounds, clamp, multiplier, and seed maths so the contract
 * ("ingredient grams scale proportionally; min 1, max 99; seed from
 * deep-link `?portion=N` deterministically") cannot regress without
 * a test failure.
 */

import { describe, expect, it } from "vitest";
import {
  RECIPE_VIEW_SERVINGS_MAX,
  RECIPE_VIEW_SERVINGS_MIN,
  RECIPE_VIEW_STEPPER_DEBOUNCE_MS,
  clampViewServings,
  initialViewServings,
  stepViewServings,
  viewMultiplier,
} from "../../src/lib/nutrition/recipeViewScale.ts";

describe("recipeViewScale — constants", () => {
  it("min is 1 (a recipe must always make at least one portion)", () => {
    expect(RECIPE_VIEW_SERVINGS_MIN).toBe(1);
  });

  it("max is 99 (defensive ceiling against pathological input)", () => {
    expect(RECIPE_VIEW_SERVINGS_MAX).toBe(99);
  });

  it("debounce is 200ms (web + mobile share one cadence)", () => {
    expect(RECIPE_VIEW_STEPPER_DEBOUNCE_MS).toBe(200);
  });
});

describe("clampViewServings", () => {
  it("returns the input when in range", () => {
    expect(clampViewServings(4)).toBe(4);
    expect(clampViewServings(50)).toBe(50);
    expect(clampViewServings(1)).toBe(1);
    expect(clampViewServings(99)).toBe(99);
  });

  it("snaps below 1 up to 1", () => {
    expect(clampViewServings(0)).toBe(1);
    expect(clampViewServings(-1)).toBe(1);
    expect(clampViewServings(-99)).toBe(1);
  });

  it("snaps above 99 down to 99", () => {
    expect(clampViewServings(100)).toBe(99);
    expect(clampViewServings(10000)).toBe(99);
  });

  it("rounds non-integer inputs to the nearest whole portion", () => {
    expect(clampViewServings(2.4)).toBe(2);
    expect(clampViewServings(2.6)).toBe(3);
    expect(clampViewServings(0.5)).toBe(1); // rounds to 1, then clamped (also 1).
  });

  it("treats NaN / Infinity / non-numbers as 1", () => {
    expect(clampViewServings(Number.NaN)).toBe(1);
    expect(clampViewServings(Number.POSITIVE_INFINITY)).toBe(1);
    expect(clampViewServings(Number.NEGATIVE_INFINITY)).toBe(1);
    expect(clampViewServings("4" as unknown as number)).toBe(1);
    expect(clampViewServings(undefined as unknown as number)).toBe(1);
    expect(clampViewServings(null as unknown as number)).toBe(1);
  });
});

describe("stepViewServings", () => {
  it("increments by 1", () => {
    expect(stepViewServings(4, 1)).toBe(5);
  });

  it("decrements by 1", () => {
    expect(stepViewServings(4, -1)).toBe(3);
  });

  it("does not go below 1 on a minus tap at 1", () => {
    expect(stepViewServings(1, -1)).toBe(1);
  });

  it("does not go above 99 on a plus tap at 99", () => {
    expect(stepViewServings(99, 1)).toBe(99);
  });

  it("clamps a +5 step from 96 → 99 (not 101)", () => {
    expect(stepViewServings(96, 5)).toBe(99);
  });

  it("clamps a -10 step from 4 → 1 (not -6)", () => {
    expect(stepViewServings(4, -10)).toBe(1);
  });

  it("0 delta is a no-op (handy for a bounce-back debounce flush)", () => {
    expect(stepViewServings(4, 0)).toBe(4);
  });
});

describe("viewMultiplier", () => {
  it("scales 4-serving recipe to 6 portions → 1.5×", () => {
    expect(viewMultiplier(6, 4)).toBeCloseTo(1.5, 6);
  });

  it("scales 4-serving recipe to 2 portions → 0.5×", () => {
    expect(viewMultiplier(2, 4)).toBeCloseTo(0.5, 6);
  });

  it("returns 1 when view == base", () => {
    expect(viewMultiplier(4, 4)).toBe(1);
  });

  it("treats 0-yield base as 1 (defensive)", () => {
    expect(viewMultiplier(4, 0)).toBe(4);
  });

  it("treats nullish / NaN base as 1", () => {
    expect(viewMultiplier(4, null)).toBe(4);
    expect(viewMultiplier(4, undefined)).toBe(4);
    expect(viewMultiplier(4, Number.NaN)).toBe(4);
  });

  it("never returns zero / negative / NaN even with pathological inputs", () => {
    expect(viewMultiplier(0, 4)).toBeGreaterThan(0);
    expect(viewMultiplier(-1, 4)).toBeGreaterThan(0);
    expect(viewMultiplier(Number.NaN, 4)).toBeGreaterThan(0);
  });

  // Spec acceptance: chicken 400g in a 4-serving recipe scaled to 6
  // portions becomes 600g.
  it("scales chicken 400g → 600g (4-serving recipe → 6 portions)", () => {
    const factor = viewMultiplier(6, 4);
    expect(Math.round(400 * factor)).toBe(600);
  });

  it("scales chicken 400g → 200g (4-serving recipe → 2 portions)", () => {
    const factor = viewMultiplier(2, 4);
    expect(Math.round(400 * factor)).toBe(200);
  });
});

describe("initialViewServings", () => {
  it("defaults to the recipe yield when no portion param", () => {
    expect(initialViewServings({ baseServings: 4 })).toBe(4);
  });

  it("multiplies by the portion param when present (1.5× of a 4-serving recipe → 6)", () => {
    expect(initialViewServings({ baseServings: 4, portionParam: 1.5 })).toBe(6);
  });

  it("clamps a malicious portion param into the max", () => {
    expect(initialViewServings({ baseServings: 4, portionParam: 10000 })).toBe(99);
  });

  it("treats a 0 / negative / NaN portion param as 1×", () => {
    expect(initialViewServings({ baseServings: 4, portionParam: 0 })).toBe(4);
    expect(initialViewServings({ baseServings: 4, portionParam: -1 })).toBe(4);
    expect(initialViewServings({ baseServings: 4, portionParam: Number.NaN })).toBe(4);
    expect(initialViewServings({ baseServings: 4, portionParam: null })).toBe(4);
    expect(initialViewServings({ baseServings: 4, portionParam: undefined })).toBe(4);
  });

  it("treats a 0 / NaN baseServings as 1 (defensive)", () => {
    expect(initialViewServings({ baseServings: 0 })).toBe(1);
    expect(initialViewServings({ baseServings: Number.NaN })).toBe(1);
  });

  it("rounds a fractional seed to the nearest whole portion", () => {
    // 3 × 1.6 = 4.8 → 5; 3 × 1.4 = 4.2 → 4.
    expect(initialViewServings({ baseServings: 3, portionParam: 1.6 })).toBe(5);
    expect(initialViewServings({ baseServings: 3, portionParam: 1.4 })).toBe(4);
  });
});
