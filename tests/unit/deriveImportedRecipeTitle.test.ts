/**
 * ENG-1047 — imported-recipe title fallback chain.
 * Shared helper used by the web import route + mobile saveImportedRecipe, so a
 * title-less import gets the same derived title on both platforms.
 */
import { describe, it, expect } from "vitest";
import {
  deriveImportedRecipeTitle,
  deriveRecipeTitleFromIngredients,
  deriveTitleFromSourceDomain,
  IMPORTED_RECIPE_FALLBACK_TITLE,
} from "../../src/lib/recipes/deriveImportedRecipeTitle";

describe("deriveImportedRecipeTitle — fallback chain", () => {
  it("1. keeps a real sanitised title as-is", () => {
    expect(
      deriveImportedRecipeTitle({
        sanitizedTitle: "Grandma's Lasagne",
        ingredients: ["beef", "pasta"],
        sourceUrl: "https://allrecipes.com/x",
      }),
    ).toBe("Grandma's Lasagne");
  });

  it("2. untitled + ingredients → first non-generic ingredient (quantity stripped)", () => {
    expect(
      deriveImportedRecipeTitle({
        sanitizedTitle: null,
        ingredients: ["200 g chicken breast", "1 onion"],
        sourceUrl: "https://allrecipes.com/x",
      }),
    ).toBe("Chicken breast");
  });

  it("2b. skips leading generic ingredients (salt/water/oil) to the first real one", () => {
    expect(
      deriveImportedRecipeTitle({
        sanitizedTitle: null,
        ingredients: ["1 tsp salt", "2 cups water", "500 g beef chuck"],
        sourceUrl: null,
      }),
    ).toBe("Beef chuck");
  });

  it("3. untitled + no usable ingredients + source domain → domain brand", () => {
    expect(
      deriveImportedRecipeTitle({
        sanitizedTitle: null,
        ingredients: ["salt", "water"],
        sourceUrl: "https://www.food.com/recipe/123",
      }),
    ).toBe("Food");
  });

  it("4. untitled + nothing usable → the generic default", () => {
    expect(
      deriveImportedRecipeTitle({ sanitizedTitle: null, ingredients: [], sourceUrl: null }),
    ).toBe(IMPORTED_RECIPE_FALLBACK_TITLE);
    expect(IMPORTED_RECIPE_FALLBACK_TITLE).toBe("Imported recipe");
  });

  it("prefers a real title over ingredient/domain even when those exist", () => {
    expect(
      deriveImportedRecipeTitle({
        sanitizedTitle: "Thai Green Curry",
        ingredients: ["chicken"],
        sourceUrl: "https://food.com/x",
      }),
    ).toBe("Thai Green Curry");
  });
});

describe("deriveRecipeTitleFromIngredients", () => {
  it("returns the first non-generic food name, title-cased", () => {
    expect(deriveRecipeTitleFromIngredients(["2 lbs beef chuck", "1 onion"])).toBe("Beef chuck");
  });
  it("skips lines whose first word is in the stoplist", () => {
    expect(deriveRecipeTitleFromIngredients(["salt to taste", "1 clove garlic"])).toBeNull();
    expect(deriveRecipeTitleFromIngredients(["1 onion"])).toBeNull();
    // "butter" is in the stoplist → skipped; falls through to the real food
    expect(deriveRecipeTitleFromIngredients(["2 tbsp butter", "300 g cod fillet"])).toBe(
      "Cod fillet",
    );
  });
  it("skips ≤3-char scraps and non-strings", () => {
    expect(deriveRecipeTitleFromIngredients(["ham", "egg"])).toBeNull();
    // @ts-expect-error — guarding runtime junk
    expect(deriveRecipeTitleFromIngredients([null, 42, "fresh tomatoes"])).toBe("Fresh tomatoes");
  });
  it("returns null for empty / nullish", () => {
    expect(deriveRecipeTitleFromIngredients([])).toBeNull();
    expect(deriveRecipeTitleFromIngredients(null)).toBeNull();
    expect(deriveRecipeTitleFromIngredients(undefined)).toBeNull();
  });
});

describe("deriveTitleFromSourceDomain", () => {
  it("uses the second-level domain, title-cased, www-stripped", () => {
    expect(deriveTitleFromSourceDomain("https://allrecipes.com/recipe/1")).toBe("Allrecipes");
    expect(deriveTitleFromSourceDomain("https://www.food.com/x")).toBe("Food");
    // SLD, not the subdomain
    expect(deriveTitleFromSourceDomain("https://mail.google.com/x")).toBe("Google");
  });
  it("returns null for bare public suffixes (.co.uk → SLD 'co') — avoids titling a recipe 'Co'", () => {
    expect(deriveTitleFromSourceDomain("https://tasty.co.uk/x")).toBeNull();
  });
  it("returns null for unparseable / nullish / hostless input", () => {
    expect(deriveTitleFromSourceDomain("not a url")).toBeNull();
    expect(deriveTitleFromSourceDomain(null)).toBeNull();
    expect(deriveTitleFromSourceDomain(undefined)).toBeNull();
  });
});
