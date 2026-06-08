/**
 * Canonical ingredient-image key — the SINGLE SOURCE OF TRUTH for
 * `ingredient_images` grouping (Sloe image system, 2026-06-08).
 *
 * The prior `ingredient_images` bug was write/read KEY DRIFT: the backfill
 * keyed rows one way and the display read another → placeholders forever +
 * runaway regeneration. These tests are the guard rail:
 *
 *   1. WRITER-key == READER-key for ~40 real corpus strings. The backfill
 *      writer keys with `canonicalImageKey`; the display reader resolves
 *      with the SAME function (via `resolveIngredientTileImage` /
 *      `canonicalKeysForNames`). If they ever diverge, this fails.
 *   2. The key is idempotent + stable (re-keying a key yields itself).
 *   3. The granularity policy (spec §2): the right things collapse, the
 *      right things stay distinct, raw/cooked never split.
 */
import { describe, expect, it } from "vitest";
import {
  canonicalImageKey,
  deriveTextKey,
  matchedAliasKey,
} from "../../src/lib/recipe/canonicalImageKey";
import {
  resolveIngredientTileImage,
  getIngredientTilePlaceholder,
} from "../../src/lib/recipe/ingredientImageTile";
import { canonicalKeysForNames } from "../../src/lib/recipe/ingredientImages";

/**
 * The real distinct `recipe_ingredients.name` corpus (dumped from production
 * 2026-06-08, 51 distinct names) plus a few canonical/spec strings. This is
 * what the backfill writer actually sees.
 */
const REAL_CORPUS: string[] = [
  "1 large red onion",
  "1 medium Red onion",
  "1 tbsp soy sauce",
  "1 tsp honey (or monkfruit)",
  "1 tsp oyster sauce",
  "1/2 tbsp water",
  "1/4 tsp salt",
  "1/4 tsp sesame oil",
  "¼ tsp ground cinnamon",
  "10ml lemon juice (2 tsp)",
  "120 grams spinach",
  "120g spinach",
  "180g raw or cooked shrimp",
  "2 heaped tsp capers",
  "2 scallions, finely sliced",
  "2 tsp dry oregano",
  "20g fresh basil",
  "3 large potatoes",
  "3 tbsp red wine vinegar",
  "3-6 rice paper wrappers (1 or 2 per roll)",
  "4 whole eggs",
  "500 g Puntalette (De Cecco)",
  "500 grams chicken mince",
  "5g toasted flaked almonds (around 2 tsp)",
  "70g green olives",
  "Almond milk, unsweetened",
  "Amylu · Chicken Meatballs with Basil & Parmesan",
  "Cherry Tomatoes",
  "Dr Kellyann · Bone Broth Roasted Chicken",
  "Essential Waitrose · Garden Peas",
  "Evolve · Plant Based Protein Powder",
  "Extra virgin olive oil",
  "Fage · 0% Milkfat All Natural Greek Strained Yogurt",
  "Fage · Total 0% Nonfat Greek Strained Yogurt",
  "Fine sea salt",
  "Fly By Jing · Original Sichuan Chili Crisp",
  "Freshly ground black pepper",
  "Good Culture · Cottage Cheese",
  "Good Culture · Organic Cottage Cheese",
  "Kirkland Signature · Egg Whites",
  "Lidl · Reduced Fat Feta Cheese",
  "Lindt · Excellence 70% Cocoa Dark Chocolate",
  "Milk, whole",
  "Myprotein · Instant Oats",
  "Ora · Superfood Protein Supplement",
  "Organic Valley · Organic Egg Whites",
  "PBfit · Peanut Butter Powder",
  "Pear, raw",
  "Quaker · Quaker Jumbo Rolled Porridge Oats 1kg",
  "Smart Chicken · Ground Chicken Breast",
  "Waitrose · Greek natural fat free strained yogurt",
];

describe("canonicalImageKey — writer key == reader key (the anti-drift guard)", () => {
  it("computes the SAME key the reader resolves for every real corpus string", () => {
    for (const raw of REAL_CORPUS) {
      const writerKey = canonicalImageKey(raw); // what the backfill stores
      // The reader resolves an image map keyed by the writer key. Simulate a
      // map populated under the writer key and confirm the reader finds it.
      const map = new Map([[writerKey, "https://cdn/img.jpg"]]);
      expect(resolveIngredientTileImage(raw, map)).toBe("https://cdn/img.jpg");
      // And `canonicalKeysForNames` (used by `fetchIngredientImages`) yields it.
      expect(canonicalKeysForNames([raw])).toContain(writerKey);
    }
  });

  it("placeholder + image share the same canonical key (consistent fallback)", () => {
    // The cream placeholder is keyed the same way, so the initial/tint is
    // stable + consistent with the eventual photo.
    for (const raw of ["120g spinach", "Fine sea salt", "Cherry Tomatoes"]) {
      const ph = getIngredientTilePlaceholder(raw);
      const key = canonicalImageKey(raw);
      const firstLetter = key.match(/[a-z]/i)?.[0]?.toUpperCase() ?? "·";
      expect(ph.initial).toBe(firstLetter);
    }
  });

  it("never produces an empty key for a real food name", () => {
    for (const raw of REAL_CORPUS) {
      // (degenerate quantity-only strings are tested separately; every real
      // corpus row resolves to a non-empty key)
      expect(canonicalImageKey(raw).length).toBeGreaterThan(0);
    }
  });
});

describe("canonicalImageKey — idempotent + stable", () => {
  it("is idempotent: key(key(x)) === key(x) across the corpus", () => {
    for (const raw of REAL_CORPUS) {
      const once = canonicalImageKey(raw);
      const twice = canonicalImageKey(once);
      const thrice = canonicalImageKey(twice);
      expect(twice).toBe(once);
      expect(thrice).toBe(once);
    }
  });

  it("deriveTextKey is the spine and is also idempotent", () => {
    for (const raw of ["Extra virgin olive oil", "500 grams chicken mince", "egg white"]) {
      const k = deriveTextKey(raw);
      expect(deriveTextKey(k)).toBe(k);
    }
  });

  it("handles empty / junk input without throwing", () => {
    expect(canonicalImageKey("")).toBe("");
    expect(canonicalImageKey("   ")).toBe("");
    expect(canonicalImageKey({ name: "" })).toBe("");
    // a degenerate quantity-only string stays stable (reader + writer both
    // produce the same thing, so no drift even on junk)
    const j = canonicalImageKey("500 g");
    expect(canonicalImageKey(j)).toBe(j);
  });
});

describe("canonicalImageKey — quantity + brand normalisation (the dup-tile fix)", () => {
  it("collapses the same food at different quantities to ONE key", () => {
    expect(canonicalImageKey("120 grams spinach")).toBe(canonicalImageKey("120g spinach"));
    expect(canonicalImageKey("120g spinach")).toBe(canonicalImageKey("baby spinach"));
  });

  it("collapses brand-prefixed variants of the same food", () => {
    expect(canonicalImageKey("Good Culture · Cottage Cheese")).toBe(
      canonicalImageKey("Good Culture · Organic Cottage Cheese"),
    );
    // three real Greek-yogurt brand forms → one tile
    const greek = canonicalImageKey("Fage · 0% Milkfat All Natural Greek Strained Yogurt");
    expect(canonicalImageKey("Fage · Total 0% Nonfat Greek Strained Yogurt")).toBe(greek);
    expect(canonicalImageKey("Waitrose · Greek natural fat free strained yogurt")).toBe(greek);
    expect(greek).toBe("greek yogurt");
  });

  it("strips section tags + leading quantities", () => {
    expect(canonicalImageKey("[Sauce] 2 tbsp soy sauce")).toBe("soy sauce");
    expect(canonicalImageKey("4 whole eggs")).toBe("egg");
  });
});

describe("canonicalImageKey — granularity policy (spec §2)", () => {
  const same = (a: string, b: string) => expect(canonicalImageKey(a)).toBe(canonicalImageKey(b));
  const diff = (a: string, b: string) =>
    expect(canonicalImageKey(a)).not.toBe(canonicalImageKey(b));

  it("COLLAPSES: all salt → salt", () => {
    same("fine salt", "kosher salt");
    same("sea salt", "flaky salt");
    same("1/4 tsp salt", "table salt");
    expect(canonicalImageKey("Fine sea salt")).toBe("salt");
  });

  it("COLLAPSES: olive-oil grades → olive oil", () => {
    same("extra virgin olive oil", "olive oil");
    same("light olive oil", "extra-virgin olive oil");
    expect(canonicalImageKey("Extra virgin olive oil")).toBe("olive oil");
  });

  it("COLLAPSES: herb preps → the herb; regional synonyms", () => {
    same("fresh thyme", "thyme leaves");
    same("dried thyme", "thyme");
    same("courgette", "zucchini");
    same("prawns", "shrimp");
    same("fresh coriander", "cilantro");
  });

  it("COLLAPSES: meat mince → ground X", () => {
    same("chicken mince", "ground chicken");
    same("minced beef", "ground beef");
    expect(canonicalImageKey("500 grams chicken mince")).toBe(
      canonicalImageKey("Smart Chicken · Ground Chicken Breast"),
    );
  });

  it("DISTINCT: egg ≠ egg white ≠ egg yolk", () => {
    diff("egg", "egg white");
    diff("egg white", "egg yolk");
    diff("egg", "egg yolk");
    // whole egg IS egg (same photo)
    same("4 whole eggs", "2 eggs");
    expect(canonicalImageKey("Kirkland Signature · Egg Whites")).toBe("egg white");
  });

  it("DISTINCT: milk types", () => {
    diff("milk", "oat milk");
    diff("oat milk", "almond milk");
    diff("milk", "almond milk");
  });

  it("DISTINCT: tomato forms", () => {
    diff("cherry tomato", "tomato");
    diff("tomato", "tomato paste");
    diff("tomato paste", "tomato sauce");
    diff("cherry tomato", "sun-dried tomato");
  });

  it("DISTINCT: chicken cuts; sugars; onions; rice; cheeses", () => {
    diff("chicken breast", "chicken thigh");
    diff("chicken breast", "ground chicken");
    diff("brown sugar", "sugar");
    diff("sugar", "powdered sugar");
    diff("red onion", "yellow onion");
    diff("red onion", "shallot");
    diff("scallion", "shallot");
    diff("brown rice", "white rice");
    diff("parmesan", "mozzarella");
    diff("cottage cheese", "cream cheese");
  });

  it("raw/cooked do NOT split the image key (spec §2)", () => {
    same("raw chicken breast", "cooked chicken breast");
    same("raw shrimp", "cooked shrimp");
    same("180g raw or cooked shrimp", "shrimp");
  });
});

describe("matchedAliasKey — only trusts high-confidence matches", () => {
  it("returns null for a weak / absent match (reject low-confidence collapse)", () => {
    expect(matchedAliasKey({ name: "x", matchedSource: "fatsecret", matchedFoodId: "1", confidence: 0.5 })).toBeNull();
    expect(matchedAliasKey({ name: "x", matchedSource: "fatsecret", matchedFoodId: null, confidence: 0.99 })).toBeNull();
    expect(matchedAliasKey({ name: "x", matchedSource: null, matchedFoodId: "1", confidence: 0.99 })).toBeNull();
    expect(matchedAliasKey({ name: "x" })).toBeNull();
  });

  it("builds source:food_id only at/above the confidence floor", () => {
    expect(
      matchedAliasKey({ name: "x", matchedSource: "FatSecret", matchedFoodId: "12345", confidence: 0.9 }),
    ).toBe("fatsecret:12345");
    expect(
      matchedAliasKey({ name: "x", matchedSource: "usda", matchedFoodId: "9", confidence: 0.85 }),
    ).toBe("usda:9");
  });

  it("the text key is ALWAYS the canonical key regardless of match (v1 text-only path)", () => {
    // Even with a strong match, the canonical key is the text spine — the
    // alias is recorded separately (ENG-905), never folded in, so a weak
    // match can never corrupt grouping.
    const withMatch = canonicalImageKey({
      name: "chicken mince",
      matchedSource: "fatsecret",
      matchedFoodId: "999",
      confidence: 0.95,
    });
    expect(withMatch).toBe("ground chicken");
  });
});
