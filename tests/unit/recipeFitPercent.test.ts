/**
 * Unit tests for `computeRecipeFitPercent` — 2026-04-20 prototype
 * port. The helper drives the per-card fit-percent pill on the
 * Discover hero cards (web + mobile). Tests cover:
 *   - null targets → neutral synthesised fallback
 *   - zeroed targets → neutral synthesised fallback
 *   - perfect match → 100%
 *   - mild miss → floor-clamped
 *   - way-off macros → floor clamp at 40
 *   - deterministic (same inputs → same percent)
 */
import { describe, expect, it } from "vitest";
import {
  computeRecipeFitPercent,
  recipeFitPercent,
} from "../../src/lib/nutrition/recipeFitPercent";

const RECIPE_BALANCED = {
  calories: 600,
  protein: 50,
  carbs: 67,
  fat: 22,
};

const TARGETS_2K = {
  calories: 1800,
  protein: 150,
  carbs: 200,
  fat: 65,
};

describe("computeRecipeFitPercent", () => {
  it("returns the neutral fallback when targets are null", () => {
    const r = computeRecipeFitPercent(RECIPE_BALANCED, null);
    expect(r.synthesised).toBe(true);
    expect(r.percent).toBeGreaterThanOrEqual(40);
    expect(r.percent).toBeLessThanOrEqual(100);
  });

  it("returns the neutral fallback when any target is zero", () => {
    const r = computeRecipeFitPercent(RECIPE_BALANCED, {
      calories: 0,
      protein: 150,
      carbs: 200,
      fat: 65,
    });
    expect(r.synthesised).toBe(true);
  });

  it("returns ~100% when the recipe matches the per-meal share exactly", () => {
    // per-meal share for 3 meals/day at TARGETS_2K == RECIPE_BALANCED
    const r = computeRecipeFitPercent(RECIPE_BALANCED, TARGETS_2K);
    expect(r.synthesised).toBe(false);
    expect(r.percent).toBeGreaterThanOrEqual(95);
  });

  it("clamps to the 40% floor when the recipe is wildly off", () => {
    // A pure-carb 2000 kcal snack vs. moderate 2k targets. The
    // scoreOne function will tank on all four macros.
    const r = computeRecipeFitPercent(
      { calories: 2000, protein: 2, carbs: 500, fat: 2 },
      TARGETS_2K,
    );
    expect(r.synthesised).toBe(false);
    expect(r.percent).toBeGreaterThanOrEqual(40);
    expect(r.percent).toBeLessThan(70);
  });

  it("is deterministic — same inputs produce the same percent", () => {
    const a = computeRecipeFitPercent(RECIPE_BALANCED, TARGETS_2K);
    const b = computeRecipeFitPercent(RECIPE_BALANCED, TARGETS_2K);
    expect(a.percent).toBe(b.percent);
  });

  it("thin `recipeFitPercent` wrapper returns just the integer", () => {
    const pct = recipeFitPercent(RECIPE_BALANCED, TARGETS_2K);
    expect(Number.isInteger(pct)).toBe(true);
    expect(pct).toBeGreaterThanOrEqual(40);
    expect(pct).toBeLessThanOrEqual(100);
  });

  it("never produces a percent below 40 or above 100", () => {
    const cases = [
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
      { calories: 10_000, protein: 500, carbs: 1000, fat: 500 },
      { calories: 1, protein: 1, carbs: 1, fat: 1 },
    ];
    for (const r of cases) {
      const withTargets = computeRecipeFitPercent(r, TARGETS_2K).percent;
      const withoutTargets = computeRecipeFitPercent(r, null).percent;
      expect(withTargets).toBeGreaterThanOrEqual(40);
      expect(withTargets).toBeLessThanOrEqual(100);
      expect(withoutTargets).toBeGreaterThanOrEqual(40);
      expect(withoutTargets).toBeLessThanOrEqual(100);
    }
  });
});
