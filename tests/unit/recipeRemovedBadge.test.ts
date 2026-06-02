/**
 * ENG-766 — shared "Recipe removed" badge gate.
 *
 * The bug: the badge showed whenever a plan row's recipeId wasn't in
 * `knownRecipeIds` — including the window before the recipe library
 * hydrates (it loads after the plan), so every row flashed "Recipe
 * removed" + an imageless card on first paint. The gate suppresses the
 * badge until the library is loaded. Shared so web + mobile can't drift.
 */
import { describe, it, expect } from "vitest";
import { shouldShowRecipeRemovedBadge } from "../../src/lib/nutrition/recipeRemovedBadge.ts";

const known = new Set<string>(["r-keep"]);

describe("shouldShowRecipeRemovedBadge (ENG-766)", () => {
  it("never shows during hydration (libraryLoaded=false), even for an unknown id", () => {
    expect(
      shouldShowRecipeRemovedBadge({
        hasRecipe: true,
        recipeId: "r-gone",
        knownRecipeIds: new Set(),
        libraryLoaded: false,
      }),
    ).toBe(false);
  });

  it("shows once loaded when the recipeId is genuinely gone", () => {
    expect(
      shouldShowRecipeRemovedBadge({
        hasRecipe: true,
        recipeId: "r-gone",
        knownRecipeIds: known,
        libraryLoaded: true,
      }),
    ).toBe(true);
  });

  it("does not show when the recipe is still in the library", () => {
    expect(
      shouldShowRecipeRemovedBadge({
        hasRecipe: true,
        recipeId: "r-keep",
        knownRecipeIds: known,
        libraryLoaded: true,
      }),
    ).toBe(false);
  });

  it("stays silent for placeholder rows (no recipe / no id)", () => {
    expect(
      shouldShowRecipeRemovedBadge({ hasRecipe: false, recipeId: "r-gone", knownRecipeIds: known, libraryLoaded: true }),
    ).toBe(false);
    expect(
      shouldShowRecipeRemovedBadge({ hasRecipe: true, recipeId: null, knownRecipeIds: known, libraryLoaded: true }),
    ).toBe(false);
  });

  it("web proxy: an empty known-set reads as not-yet-loaded → no badge", () => {
    // Web passes libraryLoaded = knownRecipeIds.size > 0.
    const empty = new Set<string>();
    expect(
      shouldShowRecipeRemovedBadge({
        hasRecipe: true,
        recipeId: "r-gone",
        knownRecipeIds: empty,
        libraryLoaded: empty.size > 0,
      }),
    ).toBe(false);
  });
});
