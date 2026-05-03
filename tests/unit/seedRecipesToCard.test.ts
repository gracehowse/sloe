/**
 * seedRecipesToCard — pin the seed → RecipeCard adapter contract.
 *
 * Both web (`AppDataContext`) and mobile (`apps/mobile/lib/recipes.ts`)
 * cast the helper output to their own RecipeCard shape. If a required
 * field stops being emitted, the silent runtime cast hides the bug
 * until Discover renders blank fields. These tests pin the shape.
 */
import { describe, expect, it } from "vitest";
import {
  seedToRecipeCard,
  seedsToRecipeCards,
} from "../../src/lib/recipes/seedRecipesToCard";
import { SEED_RECIPES_V2 } from "../../src/lib/recipes/seedRecipesV2";

describe("seedRecipesToCard", () => {
  it("emits all required RecipeCard fields", () => {
    const seed = SEED_RECIPES_V2[0];
    const card = seedToRecipeCard(seed);

    expect(card.id).toBe(seed.id);
    expect(card.title).toBe(seed.title);
    expect(card.image).toBe(seed.heroImageUrl);
    expect(card.calories).toBe(seed.kcalPerPortion);
    expect(card.servings).toBe(seed.servings);
    expect(card.protein).toBe(seed.proteinG);
    expect(card.carbs).toBe(seed.carbsG);
    expect(card.fat).toBe(seed.fatG);
    expect(card.fiberG).toBe(seed.fiberG);
    expect(card.creatorName).toBe("Suppr Kitchen");
    expect(card.feedSource).toBe("catalog");
    expect(card.isVerified).toBe(true);
  });

  it("formats prep + cook times as 'N min' strings", () => {
    const seed = SEED_RECIPES_V2.find((r) => r.cookTimeMin > 0)!;
    const card = seedToRecipeCard(seed);
    expect(card.prepTime).toBe(`${seed.prepTimeMin} min`);
    expect(card.cookTime).toBe(`${seed.cookTimeMin} min`);
  });

  it("returns empty time strings when prep/cook is zero (no-cook recipes)", () => {
    const noCook = SEED_RECIPES_V2.find((r) => r.cookTimeMin === 0);
    if (!noCook) return;
    const card = seedToRecipeCard(noCook);
    expect(card.cookTime).toBe("");
    expect(card.cookTimeMin).toBeNull();
  });

  it("preserves the cluster id for downstream grouping", () => {
    for (const seed of SEED_RECIPES_V2) {
      const card = seedToRecipeCard(seed);
      expect(card.cluster).toBe(seed.cluster);
    }
  });

  it("seedsToRecipeCards maps every entry without dropping any", () => {
    const cards = seedsToRecipeCards(SEED_RECIPES_V2);
    expect(cards.length).toBe(SEED_RECIPES_V2.length);
    const ids = new Set(cards.map((c) => c.id));
    for (const seed of SEED_RECIPES_V2) {
      expect(ids.has(seed.id)).toBe(true);
    }
  });

  it("never claims a save count for unsaved seeds", () => {
    for (const seed of SEED_RECIPES_V2) {
      const card = seedToRecipeCard(seed);
      expect(card.savedCount).toBe(0);
      expect(card.saves).toBe(0);
      expect(card.isSaved).toBe(false);
    }
  });

  it("carries optional tags through unchanged (empty array when absent)", () => {
    for (const seed of SEED_RECIPES_V2) {
      const card = seedToRecipeCard(seed);
      if (seed.tags) {
        expect(card.tags).toEqual(seed.tags);
      } else {
        expect(card.tags).toEqual([]);
      }
    }
  });

  it("creatorName pulls through the attribution.author so card byline matches recorded provenance", () => {
    // If someone changes the byline string here, the legal-review-
    // recorded provenance must follow. discoverSeedCopyright.test.ts
    // pins the attribution side; this test pins the wire side.
    for (const seed of SEED_RECIPES_V2) {
      const card = seedToRecipeCard(seed);
      expect(card.creatorName).toBe(seed.attribution.author);
    }
  });
});
