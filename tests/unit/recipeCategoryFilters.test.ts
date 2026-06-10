/**
 * recipeCategoryFilters — ENG-921 / Figma `527:2` (Cookbook) + `528:2`
 * (Discover) category filter taxonomy + predicates.
 *
 * Pins the shared classification so web (`Library.tsx`,
 * `DiscoverFeed.tsx`) and mobile (`(tabs)/library.tsx`,
 * `(tabs)/discover.tsx`) can't drift. Covers:
 *   - pill ordering matches the Figma frames;
 *   - meal-type is LAYERED (structured `mealSlots` first, then title);
 *   - dish keywords work off the title only;
 *   - nutrition pills reuse the existing `isQuick` / `isHighProtein`
 *     predicates + the new `isUnder500` calorie gate;
 *   - `all` / Discover-only signals short-circuit (handled by caller).
 */
import { describe, expect, it } from "vitest";
import {
  DISCOVER_CATEGORY_PILLS,
  LIBRARY_CATEGORY_PILLS,
  UNDER_500_KCAL,
  isUnder500,
  matchesMealType,
  matchesRecipeCategory,
  type RecipeCategoryRecipe,
} from "../../src/lib/recipes/recipeCategoryFilters";

const R = (partial: Partial<RecipeCategoryRecipe>): RecipeCategoryRecipe => ({
  title: partial.title ?? "Untitled",
  protein: partial.protein ?? 0,
  prepTimeMin: partial.prepTimeMin ?? null,
  cookTimeMin: partial.cookTimeMin ?? null,
  calories: partial.calories ?? null,
  mealSlots: partial.mealSlots ?? null,
});

describe("recipeCategoryFilters — pill sets match Figma", () => {
  it("Library row matches Figma 527:2 order", () => {
    expect(LIBRARY_CATEGORY_PILLS.map((p) => p.id)).toEqual([
      "all",
      "breakfast",
      "lunch",
      "dinner",
      "dessert",
      "quick",
      "under-500",
      "high-protein",
      "soup",
      "pasta",
      "chicken",
      "salad",
    ]);
  });

  it("Discover row matches Figma 528:2 order (Trending + From Reels lead the nutrition pills)", () => {
    expect(DISCOVER_CATEGORY_PILLS.map((p) => p.id)).toEqual([
      "all",
      "trending",
      "quick",
      "under-500",
      "high-protein",
      "from-reels",
      "breakfast",
      "dinner",
      "dessert",
      "soup",
      "pasta",
      "chicken",
    ]);
  });

  it("labels use the exact Figma copy", () => {
    const byId = Object.fromEntries(LIBRARY_CATEGORY_PILLS.map((p) => [p.id, p.label]));
    expect(byId.quick).toBe("Quick 30");
    expect(byId["under-500"]).toBe("Under 500 cal");
    expect(byId["high-protein"]).toBe("High protein");
    expect(byId.breakfast).toBe("Breakfast");
  });
});

describe("recipeCategoryFilters — meal-type (layered: mealSlots → title)", () => {
  it("trusts a structured Breakfast slot even when the title is neutral", () => {
    expect(matchesMealType(R({ title: "Untitled bowl", mealSlots: ["Breakfast"] }), "breakfast")).toBe(true);
  });

  it("falls back to the title keyword when no slot is present (most imports)", () => {
    expect(matchesMealType(R({ title: "Blueberry Baked Oats" }), "breakfast")).toBe(true);
    expect(matchesMealType(R({ title: "Shakshuka with Eggs" }), "breakfast")).toBe(true);
    expect(matchesMealType(R({ title: "Beef Wellington" }), "breakfast")).toBe(false);
  });

  it("classifies dinner by slot or title keyword", () => {
    expect(matchesMealType(R({ title: "Random", mealSlots: ["Dinner"] }), "dinner")).toBe(true);
    expect(matchesMealType(R({ title: "Chicken Tikka Curry" }), "dinner")).toBe(true);
  });

  it("dessert is title-keyword only (no planner slot exists)", () => {
    expect(matchesMealType(R({ title: "Chocolate Brownie" }), "dessert")).toBe(true);
    expect(matchesMealType(R({ title: "Greek Salad" }), "dessert")).toBe(false);
    // A "Dinner" slot must not leak into dessert.
    expect(matchesMealType(R({ title: "Roast chicken", mealSlots: ["Dinner"] }), "dessert")).toBe(false);
  });

  it("empty/whitespace titles with no slot never match", () => {
    expect(matchesMealType(R({ title: "" }), "breakfast")).toBe(false);
    expect(matchesMealType(R({ title: "   " }), "dinner")).toBe(false);
  });
});

describe("recipeCategoryFilters — isUnder500", () => {
  it(`returns true at and below ${UNDER_500_KCAL} kcal`, () => {
    expect(isUnder500(R({ calories: UNDER_500_KCAL }))).toBe(true);
    expect(isUnder500(R({ calories: 320 }))).toBe(true);
  });
  it("returns false above the threshold", () => {
    expect(isUnder500(R({ calories: UNDER_500_KCAL + 1 }))).toBe(false);
    expect(isUnder500(R({ calories: 850 }))).toBe(false);
  });
  it("returns false for missing / zero / NaN calories (no free pass for bad data)", () => {
    expect(isUnder500(R({ calories: null }))).toBe(false);
    expect(isUnder500(R({ calories: 0 }))).toBe(false);
    expect(isUnder500(R({ calories: Number.NaN }))).toBe(false);
  });
});

describe("recipeCategoryFilters — matchesRecipeCategory", () => {
  it("reset + Discover-only ids short-circuit to true (caller handles them)", () => {
    const beef = R({ title: "Beef Stew", calories: 900, protein: 5 });
    expect(matchesRecipeCategory("all", beef)).toBe(true);
    expect(matchesRecipeCategory("trending", beef)).toBe(true);
    expect(matchesRecipeCategory("from-reels", beef)).toBe(true);
  });

  it("reuses isQuick / isHighProtein / isUnder500", () => {
    expect(matchesRecipeCategory("quick", R({ prepTimeMin: 10, cookTimeMin: 10 }))).toBe(true);
    expect(matchesRecipeCategory("quick", R({ prepTimeMin: 30, cookTimeMin: 30 }))).toBe(false);
    expect(matchesRecipeCategory("high-protein", R({ protein: 40 }))).toBe(true);
    expect(matchesRecipeCategory("high-protein", R({ protein: 10 }))).toBe(false);
    expect(matchesRecipeCategory("under-500", R({ calories: 420 }))).toBe(true);
    expect(matchesRecipeCategory("under-500", R({ calories: 700 }))).toBe(false);
  });

  it("dish keywords match off the title", () => {
    expect(matchesRecipeCategory("soup", R({ title: "Miso Ramen" }))).toBe(true);
    expect(matchesRecipeCategory("pasta", R({ title: "Three Cheese Fusilli" }))).toBe(true);
    expect(matchesRecipeCategory("chicken", R({ title: "Chicken Kale Salad" }))).toBe(true);
    expect(matchesRecipeCategory("salad", R({ title: "Chicken Kale Salad" }))).toBe(true);
    expect(matchesRecipeCategory("pasta", R({ title: "Greek Salad" }))).toBe(false);
    expect(matchesRecipeCategory("chicken", R({ title: "Mushroom Risotto" }))).toBe(false);
  });
});
