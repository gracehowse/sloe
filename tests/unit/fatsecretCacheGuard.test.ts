import { describe, it, expect } from "vitest";

import {
  isFatSecretSourced,
  scrubFatSecretMacros,
  scrubFatSecretRows,
  recipeAggregateHasFatSecret,
  ZEROED_RECIPE_AGGREGATE,
  SCRUBBED_SOURCE_LABEL,
} from "../../src/lib/nutrition/fatsecretCacheGuard";

/**
 * T19 Path B (2026-04-25) — FatSecret Basic-tier ToS guard.
 *
 * The Basic-tier ToS prohibits caching FatSecret macro values in the
 * database. The {@link scrubFatSecretMacros} helper must zero macros
 * + drop verification flags + rewrite source for any FatSecret-sourced
 * row, while leaving USDA / OFF / Edamam / Estimated rows untouched
 * (those sources permit caching).
 *
 * Invariants tested below:
 *
 *  1. FatSecret-sourced rows lose every macro and gain `source='Unverified'`.
 *  2. Non-FatSecret rows pass through byte-identical.
 *  3. `fatsecret_food_id` is preserved on scrub (it is the permitted
 *     reference pointer; only the macros are the violation).
 *  4. Aggregate detection is positive iff at least one row is FatSecret.
 *  5. Case sensitivity matches both `'FatSecret'` and `'fatsecret'`.
 */

describe("fatsecretCacheGuard.isFatSecretSourced", () => {
  it("returns true for source='FatSecret'", () => {
    expect(isFatSecretSourced({ source: "FatSecret" })).toBe(true);
  });

  it("returns true for lowercase 'fatsecret'", () => {
    expect(isFatSecretSourced({ source: "fatsecret" })).toBe(true);
  });

  it("returns false for USDA", () => {
    expect(isFatSecretSourced({ source: "USDA" })).toBe(false);
  });

  it("returns false for OFF / Open Food Facts", () => {
    expect(isFatSecretSourced({ source: "OFF" })).toBe(false);
    expect(isFatSecretSourced({ source: "Open Food Facts" })).toBe(false);
  });

  it("returns false for null source", () => {
    expect(isFatSecretSourced({ source: null })).toBe(false);
  });

  it("returns false for missing source even with fatsecret_food_id present", () => {
    // A row could legitimately keep a `fatsecret_food_id` pointer after
    // being re-verified against another source. Only the *current*
    // source label gates the scrub.
    expect(isFatSecretSourced({ source: "USDA", fatsecret_food_id: "fs-123" })).toBe(false);
  });
});

describe("fatsecretCacheGuard.scrubFatSecretMacros", () => {
  it("zeros all macros + drops verification on a FatSecret row", () => {
    const row = {
      recipe_id: "abc",
      name: "Quaker Oats",
      amount: 100,
      unit: "g",
      calories: 379,
      protein: 13,
      carbs: 67,
      fat: 7,
      fiber_g: 10,
      sugar_g: 1,
      sodium_mg: 6,
      fatsecret_food_id: "fs-12345",
      confidence: 0.95,
      is_verified: true,
      source: "FatSecret",
    };

    const out = scrubFatSecretMacros(row);

    expect(out.calories).toBe(0);
    expect(out.protein).toBe(0);
    expect(out.carbs).toBe(0);
    expect(out.fat).toBe(0);
    expect(out.fiber_g).toBe(0);
    expect(out.sugar_g).toBe(0);
    expect(out.sodium_mg).toBe(0);
    expect(out.is_verified).toBe(false);
    expect(out.source).toBe(SCRUBBED_SOURCE_LABEL);
    expect(out.confidence).toBeNull();
  });

  it("preserves fatsecret_food_id on a scrubbed row", () => {
    const out = scrubFatSecretMacros({
      source: "FatSecret",
      fatsecret_food_id: "fs-12345",
      calories: 200,
    });
    expect(out.fatsecret_food_id).toBe("fs-12345");
  });

  it("preserves non-macro columns on a scrubbed row", () => {
    const out = scrubFatSecretMacros({
      source: "FatSecret",
      recipe_id: "recipe-uuid",
      name: "Oats",
      amount: 100,
      unit: "g",
      calories: 379,
    });
    expect(out.recipe_id).toBe("recipe-uuid");
    expect(out.name).toBe("Oats");
    expect(out.amount).toBe(100);
    expect(out.unit).toBe("g");
  });

  it("returns a USDA row byte-identical (no mutation)", () => {
    const row = {
      source: "USDA",
      calories: 379,
      protein: 13,
      carbs: 67,
      fat: 7,
      fatsecret_food_id: null,
      is_verified: true,
    };
    const out = scrubFatSecretMacros(row);
    expect(out).toEqual(row);
  });

  it("returns an Estimated row untouched", () => {
    const row = { source: "Estimated", calories: 100, is_verified: false };
    expect(scrubFatSecretMacros(row)).toEqual(row);
  });
});

describe("fatsecretCacheGuard.scrubFatSecretRows", () => {
  it("scrubs only the FatSecret rows in a mixed list", () => {
    const rows = [
      { source: "USDA", calories: 100, protein: 5, carbs: 20, fat: 1 },
      { source: "FatSecret", calories: 200, protein: 10, carbs: 30, fat: 2, fatsecret_food_id: "fs-1" },
      { source: "OFF", calories: 50, protein: 2, carbs: 8, fat: 0 },
    ];

    const out = scrubFatSecretRows(rows);

    expect(out[0]).toEqual(rows[0]);
    expect(out[1]?.calories).toBe(0);
    expect(out[1]?.fatsecret_food_id).toBe("fs-1");
    expect(out[1]?.source).toBe(SCRUBBED_SOURCE_LABEL);
    expect(out[2]).toEqual(rows[2]);
  });
});

describe("fatsecretCacheGuard.recipeAggregateHasFatSecret", () => {
  it("returns true when any row is FatSecret-sourced", () => {
    expect(
      recipeAggregateHasFatSecret([
        { source: "USDA" },
        { source: "FatSecret" },
        { source: "OFF" },
      ]),
    ).toBe(true);
  });

  it("returns false for all USDA rows", () => {
    expect(
      recipeAggregateHasFatSecret([
        { source: "USDA" },
        { source: "USDA" },
      ]),
    ).toBe(false);
  });

  it("returns false for an empty list", () => {
    expect(recipeAggregateHasFatSecret([])).toBe(false);
  });
});

describe("fatsecretCacheGuard.ZEROED_RECIPE_AGGREGATE", () => {
  it("is the canonical zeroed shape for the recipes table", () => {
    expect(ZEROED_RECIPE_AGGREGATE.calories).toBe(0);
    expect(ZEROED_RECIPE_AGGREGATE.protein).toBe(0);
    expect(ZEROED_RECIPE_AGGREGATE.carbs).toBe(0);
    expect(ZEROED_RECIPE_AGGREGATE.fat).toBe(0);
    expect(ZEROED_RECIPE_AGGREGATE.fiber_g).toBe(0);
    expect(ZEROED_RECIPE_AGGREGATE.sugar_g).toBe(0);
    expect(ZEROED_RECIPE_AGGREGATE.sodium_mg).toBe(0);
    expect(ZEROED_RECIPE_AGGREGATE.is_verified).toBe(false);
    expect(ZEROED_RECIPE_AGGREGATE.verified_source).toBeNull();
    expect(ZEROED_RECIPE_AGGREGATE.verified_confidence).toBeNull();
    expect(ZEROED_RECIPE_AGGREGATE.verified_at).toBeNull();
  });
});
