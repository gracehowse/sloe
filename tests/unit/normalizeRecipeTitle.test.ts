/**
 * Polish (2026-04-25) — recipe-title normalisation contract.
 *
 * Bug pinned: imported recipes sometimes arrived in ALL CAPS
 * ("PEANUT LIME CHIC...") and rendered verbatim across the app. Helper
 * title-cases ALL-CAPS inputs while leaving any author-chosen mixed casing
 * untouched.
 */
import { describe, it, expect } from "vitest";
import { normalizeRecipeTitle } from "../../src/lib/recipes/normalizeRecipeTitle";

describe("normalizeRecipeTitle", () => {
  it("title-cases ALL-CAPS input", () => {
    expect(normalizeRecipeTitle("PEANUT LIME CHICKEN BOWL")).toBe(
      "Peanut Lime Chicken Bowl",
    );
    expect(normalizeRecipeTitle("HEALTHY 3 INGREDIENT PASTA")).toBe(
      "Healthy 3 Ingredient Pasta",
    );
  });

  it("uses lowercase stop-words in the middle, capitalises first/last word", () => {
    expect(normalizeRecipeTitle("OF MICE AND MEN")).toBe("Of Mice and Men");
    expect(normalizeRecipeTitle("CHICKEN AND RICE")).toBe("Chicken and Rice");
    expect(normalizeRecipeTitle("THE BEST RECIPE OF THE YEAR")).toBe(
      "The Best Recipe of the Year",
    );
  });

  it("preserves mixed-case input untouched", () => {
    expect(normalizeRecipeTitle("Banh Mi")).toBe("Banh Mi");
    expect(normalizeRecipeTitle("My Mom's Lasagna")).toBe("My Mom's Lasagna");
    expect(normalizeRecipeTitle("iPhone-friendly Pasta")).toBe(
      "iPhone-friendly Pasta",
    );
  });

  it("title-cases hyphenated compounds", () => {
    expect(normalizeRecipeTitle("BLACK-BEAN TACOS")).toBe("Black-Bean Tacos");
  });

  it("returns 'Untitled recipe' for empty / null / undefined", () => {
    expect(normalizeRecipeTitle("")).toBe("Untitled recipe");
    expect(normalizeRecipeTitle("   ")).toBe("Untitled recipe");
    expect(normalizeRecipeTitle(null)).toBe("Untitled recipe");
    expect(normalizeRecipeTitle(undefined)).toBe("Untitled recipe");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeRecipeTitle("  CHICKEN CURRY  ")).toBe("Chicken Curry");
  });
});
