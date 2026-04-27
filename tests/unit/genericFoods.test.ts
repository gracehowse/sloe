/**
 * F-73 follow-up (2026-04-27) — pin the generic-foods match shim that
 * preempts USDA Branded noise for plain-food queries (e.g. "apple",
 * "chicken breast", "rice").
 *
 * Mirrors the shape of `genericBeverages.test.ts` so the two stay
 * legible side-by-side.
 */
import { describe, it, expect } from "vitest";
import {
  GENERIC_FOODS,
  matchGenericFood,
} from "../../src/lib/nutrition/genericFoods";

describe("matchGenericFood — F-73 follow-up", () => {
  it("matches the canonical fruit / veg / grain / protein queries", () => {
    expect(matchGenericFood("apple")?.id).toBe("apple");
    expect(matchGenericFood("banana")?.id).toBe("banana");
    expect(matchGenericFood("broccoli")?.id).toBe("broccoli");
    expect(matchGenericFood("chicken breast")?.id).toBe("chicken-breast");
    expect(matchGenericFood("salmon")?.id).toBe("salmon");
    expect(matchGenericFood("egg")?.id).toBe("egg");
    expect(matchGenericFood("rice")?.id).toBe("white-rice");
    expect(matchGenericFood("brown rice")?.id).toBe("brown-rice");
    expect(matchGenericFood("oats")?.id).toBe("oats-raw");
    expect(matchGenericFood("greek yogurt")?.id).toBe("greek-yogurt");
    expect(matchGenericFood("peanut butter")?.id).toBe("peanut-butter");
  });

  it("matches plurals / case-insensitive / whitespace tolerant", () => {
    expect(matchGenericFood("APPLES")?.id).toBe("apple");
    expect(matchGenericFood("  Bananas  ")?.id).toBe("banana");
    expect(matchGenericFood("eggs")?.id).toBe("egg");
    expect(matchGenericFood("Tomatoes")?.id).toBe("tomato");
  });

  it("matches British spelling variants where they exist", () => {
    expect(matchGenericFood("greek yoghurt")?.id).toBe("greek-yogurt");
    expect(matchGenericFood("courgette")).toBeNull(); // not in v1, deliberately
    expect(matchGenericFood("tinned tuna")?.id).toBe("tuna-canned");
  });

  it("returns null for empty / whitespace input", () => {
    expect(matchGenericFood("")).toBeNull();
    expect(matchGenericFood("   ")).toBeNull();
  });

  it("does not over-match on substrings (multi-word queries don't false-positive)", () => {
    // "rice pudding" is a different dish — must not collapse to "rice"
    expect(matchGenericFood("rice pudding")).toBeNull();
    // "chicken breast with skin" is more specific than the generic raw
    // skinless row — exact-alias matcher correctly returns null here so
    // the user gets the USDA cooked-with-skin row from the live search
    // instead of a misleading match.
    expect(matchGenericFood("chicken breast with skin")).toBeNull();
    // "apple pie" must not collapse to "apple"
    expect(matchGenericFood("apple pie")).toBeNull();
    // But the bare query does match
    expect(matchGenericFood("apple")?.id).toBe("apple");
  });

  it("returns null for unknown queries", () => {
    expect(matchGenericFood("ribeye steak")).toBeNull(); // not in v1 (generic enough but cut-specific)
    expect(matchGenericFood("ramen")).toBeNull();
    expect(matchGenericFood("foie gras")).toBeNull();
  });
});

describe("GENERIC_FOODS table integrity", () => {
  it("has the expected canonical food entries (fruit, veg, grains, protein, dairy, nuts)", () => {
    expect(GENERIC_FOODS.length).toBeGreaterThanOrEqual(30);
    const ids = GENERIC_FOODS.map((f) => f.id).sort();
    expect(ids).toContain("apple");
    expect(ids).toContain("banana");
    expect(ids).toContain("chicken-breast");
    expect(ids).toContain("salmon");
    expect(ids).toContain("egg");
    expect(ids).toContain("white-rice");
    expect(ids).toContain("oats-raw");
    expect(ids).toContain("greek-yogurt");
    expect(ids).toContain("peanut-butter");
    expect(ids).toContain("almonds");
  });

  it("every food has at least one alias and a positive serving size", () => {
    for (const f of GENERIC_FOODS) {
      expect(f.aliases.length).toBeGreaterThan(0);
      expect(f.servingG).toBeGreaterThan(0);
      expect(f.servingLabel.length).toBeGreaterThan(0);
      expect(f.per100g.calories).toBeGreaterThanOrEqual(0);
      // No invented values: protein/carbs/fat must be non-negative
      // (zero is allowed — e.g. butter has zero meaningful protein).
      expect(f.per100g.protein).toBeGreaterThanOrEqual(0);
      expect(f.per100g.carbs).toBeGreaterThanOrEqual(0);
      expect(f.per100g.fat).toBeGreaterThanOrEqual(0);
    }
  });

  it("every alias is unique across the table (no two foods share an alias)", () => {
    const seen = new Map<string, string>(); // alias → id
    for (const f of GENERIC_FOODS) {
      for (const a of f.aliases) {
        const norm = a.toLowerCase().trim();
        const prev = seen.get(norm);
        if (prev && prev !== f.id) {
          throw new Error(
            `Alias "${a}" (normalised "${norm}") is shared by ${prev} and ${f.id}`,
          );
        }
        seen.set(norm, f.id);
      }
    }
  });

  it("canonical names are distinct from each other", () => {
    const names = new Set(GENERIC_FOODS.map((f) => f.name.toLowerCase()));
    expect(names.size).toBe(GENERIC_FOODS.length);
  });

  it("calorie counts pass a sanity floor/ceiling (0..900 per 100g)", () => {
    // Catches paste/transposition errors. Butter is ~717, peanut butter
    // ~588, oils would be ~884 (we don't list oils); anything outside
    // 0..900 per-100g is almost certainly a typo.
    for (const f of GENERIC_FOODS) {
      expect(f.per100g.calories).toBeGreaterThanOrEqual(0);
      expect(f.per100g.calories).toBeLessThanOrEqual(900);
    }
  });
});
