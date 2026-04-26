/**
 * F-85 (2026-04-25) — pin recipe-title display normalisation.
 *
 * Imported recipes (especially from blogs / Pinterest) often arrive in
 * shouty ALL CAPS. Display-only normalisation makes the recipe-detail
 * screen feel premium without rewriting the stored title.
 */
import { describe, expect, it } from "vitest";
import { normaliseRecipeDisplayTitle } from "@/../src/lib/recipe/normaliseDisplayTitle";

describe("normaliseRecipeDisplayTitle", () => {
  it("normalises ALL-CAPS imported titles to title case", () => {
    expect(normaliseRecipeDisplayTitle("HEALTHY 3 INGREDIENT WHIPPED PISTACHIO TIRAMISU"))
      .toBe("Healthy 3 Ingredient Whipped Pistachio Tiramisu");
  });

  it("leaves mixed-case titles unchanged", () => {
    expect(normaliseRecipeDisplayTitle("Best Chocolate Chip Cookies")).toBe("Best Chocolate Chip Cookies");
    expect(normaliseRecipeDisplayTitle("Mom's Sunday roast")).toBe("Mom's Sunday roast");
  });

  it("lowercases short articles / prepositions in the middle", () => {
    expect(normaliseRecipeDisplayTitle("MAC AND CHEESE WITH BACON")).toBe("Mac and Cheese with Bacon");
    expect(normaliseRecipeDisplayTitle("CHICKEN IN A POT")).toBe("Chicken in a Pot");
  });

  it("preserves protected acronyms", () => {
    expect(normaliseRecipeDisplayTitle("EASY PB COOKIES")).toBe("Easy PB Cookies");
    expect(normaliseRecipeDisplayTitle("BBQ PULLED PORK")).toBe("BBQ Pulled Pork");
    expect(normaliseRecipeDisplayTitle("UK STYLE FISH PIE")).toBe("UK Style Fish Pie");
  });

  it("handles numbers and units", () => {
    expect(normaliseRecipeDisplayTitle("3-INGREDIENT BANANA BREAD")).toBe("3-Ingredient Banana Bread");
    expect(normaliseRecipeDisplayTitle("30 MIN CHICKEN")).toBe("30 Min Chicken");
  });

  it("handles apostrophes and ampersands", () => {
    // Single-letter alphabetic segments between non-alpha characters get
    // capitalised — "Mac 'N' Cheese" rather than the stylistic "Mac 'n'
    // Cheese". Acceptable trade-off; full punctuation-aware lowering
    // would need a much heavier ruleset.
    expect(normaliseRecipeDisplayTitle("MAC 'N' CHEESE")).toBe("Mac 'N' Cheese");
    expect(normaliseRecipeDisplayTitle("GIN & TONIC SORBET")).toBe("Gin & Tonic Sorbet");
  });

  it("returns input unchanged when not predominantly uppercase", () => {
    expect(normaliseRecipeDisplayTitle("My GREAT recipe")).toBe("My GREAT recipe");
  });

  it("preserves first/last word capitalisation even when short", () => {
    expect(normaliseRecipeDisplayTitle("THE BEST")).toBe("The Best");
    expect(normaliseRecipeDisplayTitle("MAC AND")).toBe("Mac And"); // "and" capitalised because it is the last word
  });

  it("handles edge cases", () => {
    expect(normaliseRecipeDisplayTitle("")).toBe("");
    expect(normaliseRecipeDisplayTitle("   ")).toBe("");
    expect(normaliseRecipeDisplayTitle("ABC")).toBe("ABC"); // too short to act on
  });
});
