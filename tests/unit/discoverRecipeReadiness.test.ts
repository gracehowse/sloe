import { describe, expect, it } from "vitest";
import { isDiscoverReadyRecipeCard } from "../../src/lib/recipes/discoverRecipeReadiness";
import { RETIRED_STOCK_IMAGE_URLS } from "../../src/lib/recipes/heroImageFallback";
import { SEED_RECIPES_V2 } from "../../src/lib/recipes/seedRecipesV2";
import { seedsToRecipeCards } from "../../src/lib/recipes/seedRecipesToCard";

const READY_RECIPE = {
  title: "Roast tomato pasta",
  image: "https://cdn.example.com/roast-tomato-pasta.jpg",
  servings: 4,
  calories: 520,
  protein: 24,
  carbs: 68,
  fat: 17,
  prepTimeMin: 15,
  cookTimeMin: 30,
};

describe("isDiscoverReadyRecipeCard", () => {
  it("accepts a complete editorial recipe", () => {
    expect(isDiscoverReadyRecipeCard(READY_RECIPE)).toBe(true);
  });

  it.each([null, "", "not-a-url", "file:///tmp/dish.jpg"])(
    "rejects a missing or non-remote image: %s",
    (image) => {
      expect(isDiscoverReadyRecipeCard({ ...READY_RECIPE, image })).toBe(false);
    },
  );

  it("rejects a retired fabricated stock image", () => {
    const retiredImage = [...RETIRED_STOCK_IMAGE_URLS][0];
    expect(isDiscoverReadyRecipeCard({ ...READY_RECIPE, image: retiredImage })).toBe(false);
  });

  it.each(["", "Untitled recipe", "Unavailable", "Unknown recipe", "Recipe"])(
    "rejects a placeholder title: %s",
    (title) => {
      expect(isDiscoverReadyRecipeCard({ ...READY_RECIPE, title })).toBe(false);
    },
  );

  it("requires positive servings and calories", () => {
    expect(isDiscoverReadyRecipeCard({ ...READY_RECIPE, servings: 0 })).toBe(false);
    expect(isDiscoverReadyRecipeCard({ ...READY_RECIPE, calories: 0 })).toBe(false);
  });

  it("allows a legitimate zero macro but rejects missing or negative macros", () => {
    expect(isDiscoverReadyRecipeCard({ ...READY_RECIPE, carbs: 0 })).toBe(true);
    expect(isDiscoverReadyRecipeCard({ ...READY_RECIPE, protein: null })).toBe(false);
    expect(isDiscoverReadyRecipeCard({ ...READY_RECIPE, fat: -1 })).toBe(false);
  });

  it("requires a positive prep or cook duration", () => {
    expect(
      isDiscoverReadyRecipeCard({
        ...READY_RECIPE,
        prepTimeMin: null,
        cookTimeMin: null,
      }),
    ).toBe(false);
    expect(
      isDiscoverReadyRecipeCard({
        ...READY_RECIPE,
        prepTimeMin: null,
        cookTimeMin: null,
        prepTime: "15 min",
      }),
    ).toBe(true);
  });

  it("keeps every approved Sloe Kitchen recipe above the gate", () => {
    const cards = seedsToRecipeCards(SEED_RECIPES_V2);
    expect(cards).toHaveLength(18);
    expect(cards.every(isDiscoverReadyRecipeCard)).toBe(true);
  });
});
