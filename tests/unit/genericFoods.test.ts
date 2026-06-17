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
    // ENG-746 staple addition (all-purpose flour)
    expect(matchGenericFood("flour")?.id).toBe("flour");
    expect(matchGenericFood("all-purpose flour")?.id).toBe("flour");
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
    // ENG-746: plain flour (UK) maps to the all-purpose entry
    expect(matchGenericFood("plain flour")?.id).toBe("flour");
  });

  it("ENG-1083: canned/tinned tomatoes map to the no-salt entry, not raw tomato", () => {
    // The no-salt-added canned entry — distinct from raw "tomato".
    expect(matchGenericFood("canned tomatoes")?.id).toBe("canned-tomatoes-no-salt");
    expect(matchGenericFood("tinned tomatoes")?.id).toBe("canned-tomatoes-no-salt");
    expect(matchGenericFood("chopped tomatoes")?.id).toBe("canned-tomatoes-no-salt");
    expect(matchGenericFood("canned chopped tomatoes")?.id).toBe("canned-tomatoes-no-salt");
    expect(matchGenericFood("no salt added canned tomatoes")?.id).toBe("canned-tomatoes-no-salt");
    expect(matchGenericFood("no-salt-added canned tomatoes")?.id).toBe("canned-tomatoes-no-salt");
    // The bare "tomato"/"tomatoes" query still lands the RAW entry — the
    // canned aliases must not steal it.
    expect(matchGenericFood("tomato")?.id).toBe("tomato");
    expect(matchGenericFood("tomatoes")?.id).toBe("tomato");
  });

  it("does NOT collapse non-plain flours onto the all-purpose entry", () => {
    // self-raising / bread / wholemeal flours differ — must fall through
    expect(matchGenericFood("self-raising flour")).toBeNull();
    expect(matchGenericFood("wholemeal flour")).toBeNull();
    expect(matchGenericFood("bread flour")).toBeNull();
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
    expect(ids).toContain("flour");
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

  it("the ENG-746 flour entry carries its nutrition-engine-validated per-100g", () => {
    // Locked against silent drift. Source: USDA SR Legacy #20081 (all-purpose,
    // enriched); micros baked from Foundation #789890 (kcal Δ 0.5%).
    const flour = GENERIC_FOODS.find((f) => f.id === "flour")!;
    expect(flour.per100g).toMatchObject({ calories: 364, protein: 10.3, carbs: 76.3, fat: 1.0, sodiumMg: 2 });
  });

  it("the ENG-1083 no-salt canned-tomato entry carries its low-sodium per-100g", () => {
    // Source: USDA SR Legacy #170138 (canned, packed in tomato juice, no salt
    // added). The defining property is the low sodium (10 mg/100g) vs the
    // salted canned counterpart (#170051 at 115 mg). Locked against silent drift.
    const canned = GENERIC_FOODS.find((f) => f.id === "canned-tomatoes-no-salt")!;
    expect(canned).toBeDefined();
    expect(canned.per100g).toMatchObject({ calories: 16, protein: 0.8, carbs: 3.5, fat: 0.3, sodiumMg: 10 });
    // It must read as a low-sodium food, not a default canned (salted) row.
    expect(canned.per100g.sodiumMg).toBeLessThan(50);
    expect(canned.subtitle).toMatch(/no salt added/i);
  });
});
