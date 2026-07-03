/**
 * ENG-1276 — `matchedAliasKeyForRow` gating.
 *
 * The value written to `recipe_ingredients.matched_alias_key` on every insert
 * path. `"source:food_id"` (lowercased) ONLY when the match is trusted
 * (confidence ≥ 0.85 with both source + food id present), else `null`. This
 * is the CLAUDE.md reject-low-confidence rule at the persistence boundary —
 * a weak/absent match must never seed an alias.
 */
import { describe, it, expect } from "vitest";
import { matchedAliasKeyForRow } from "../../src/lib/recipe/matchedAliasPersist";
import { MATCHED_ALIAS_MIN_CONFIDENCE } from "../../src/lib/recipe/canonicalImageKey";

describe("matchedAliasKeyForRow", () => {
  it("returns source:food_id (lowercased) for a trusted match", () => {
    expect(
      matchedAliasKeyForRow({
        name: "baby spinach",
        source: "FatSecret",
        fatsecretFoodId: "4001",
        confidence: 0.9,
      }),
    ).toBe("fatsecret:4001");
  });

  it("returns the key exactly at the confidence floor (0.85)", () => {
    expect(
      matchedAliasKeyForRow({
        name: "rice",
        source: "USDA",
        fatsecretFoodId: "12345",
        confidence: MATCHED_ALIAS_MIN_CONFIDENCE,
      }),
    ).toBe("usda:12345");
  });

  it("returns null just below the confidence floor", () => {
    expect(
      matchedAliasKeyForRow({
        name: "rice",
        source: "USDA",
        fatsecretFoodId: "12345",
        confidence: 0.84,
      }),
    ).toBeNull();
  });

  it("returns null when the food id is missing", () => {
    expect(
      matchedAliasKeyForRow({
        name: "rice",
        source: "USDA",
        fatsecretFoodId: null,
        confidence: 0.95,
      }),
    ).toBeNull();
  });

  it("returns null when the source is missing", () => {
    expect(
      matchedAliasKeyForRow({
        name: "rice",
        source: null,
        fatsecretFoodId: "12345",
        confidence: 0.95,
      }),
    ).toBeNull();
  });

  it("returns null when confidence is absent (unverified rows)", () => {
    expect(
      matchedAliasKeyForRow({
        name: "rice",
        source: "Unverified",
        fatsecretFoodId: null,
        confidence: null,
      }),
    ).toBeNull();
  });
});
