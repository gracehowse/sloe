/**
 * Structural and nutrition-trust contract for the founder-approved Sloe
 * Kitchen Discover catalogue.
 */
import { describe, expect, it } from "vitest";
import {
  SEED_CLUSTERS,
  SEED_RECIPES_V2,
  SEED_RECIPE_ID_PREFIX,
  findSeedRecipeById,
  getSeedRecipesByCluster,
  isRetiredDiscoverSeedCard,
  isSeedRecipeId,
  type SeedCuisineCluster,
} from "../../src/lib/recipes/seedRecipesV2";

const ACTIVE_CLUSTERS: ReadonlyArray<SeedCuisineCluster> = [
  "mediterranean",
  "asian",
  "latin",
];

const CLUSTER_SIZE_CONTRACT: Record<SeedCuisineCluster, number> = {
  mediterranean: 6,
  asian: 10,
  latin: 2,
};

describe("discoverSeedShape", () => {
  it("ships exactly the 18 founder-approved Sloe Kitchen recipes", () => {
    expect(SEED_RECIPES_V2).toHaveLength(18);
  });

  it("declares only the three populated clusters in reading order", () => {
    expect(SEED_CLUSTERS.map((cluster) => cluster.id)).toEqual(ACTIVE_CLUSTERS);
    for (const cluster of SEED_CLUSTERS) {
      expect(cluster.title.length).toBeGreaterThan(0);
      expect(cluster.description.length).toBeGreaterThan(0);
    }
  });

  it("pins the reviewed collection count in each cluster", () => {
    for (const cluster of ACTIVE_CLUSTERS) {
      expect(getSeedRecipesByCluster(cluster)).toHaveLength(
        CLUSTER_SIZE_CONTRACT[cluster],
      );
    }
  });

  it("carries complete, executable recipe content", () => {
    for (const recipe of SEED_RECIPES_V2) {
      expect(recipe.id).toMatch(/^seed-v2-[a-z-]+-[a-z0-9-]+$/);
      expect(recipe.title.length).toBeGreaterThan(0);
      expect(recipe.servings).toBeGreaterThan(0);
      expect(recipe.totalTimeMin).toBe(recipe.prepTimeMin + recipe.cookTimeMin);
      expect(recipe.ingredients.length).toBeGreaterThanOrEqual(6);
      expect(recipe.ingredients.length).toBeLessThanOrEqual(24);
      expect(recipe.steps.length).toBeGreaterThanOrEqual(4);
      expect(recipe.steps.length).toBeLessThanOrEqual(8);
      expect(recipe.allergens).toBeInstanceOf(Array);

      for (const ingredient of recipe.ingredients) {
        expect(ingredient.name.length).toBeGreaterThan(0);
        expect(ingredient.grams).toBeGreaterThan(0);
      }
      for (const step of recipe.steps) expect(step.length).toBeGreaterThan(0);
    }
  });

  it("uses production-hosted Sloe Kitchen heroes", () => {
    for (const recipe of SEED_RECIPES_V2) {
      expect(recipe.heroImageUrl).toMatch(
        /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/recipe-images\/sloe-kitchen\/v1\/[a-z0-9-]+\.jpg$/,
      );
      expect(recipe.heroImageUrl).not.toMatch(/unsplash|blob:|data:/);
    }
  });

  it("publishes only engine-verified headline nutrition", () => {
    for (const recipe of SEED_RECIPES_V2) {
      expect(recipe.kcalPerPortion).toBeGreaterThan(0);
      expect(recipe.proteinG).toBeGreaterThan(0);
      expect(recipe.carbsG).toBeGreaterThan(0);
      expect(recipe.fatG).toBeGreaterThan(0);
      expect(recipe.fiberG).toBeGreaterThanOrEqual(0);
      expect(recipe.sugarG).toBeGreaterThanOrEqual(0);
      expect(recipe.sodiumMg).toBeGreaterThanOrEqual(0);
      expect(recipe.nutritionVerification.status).toBe("verified");
      expect(recipe.nutritionVerification.engine).toBe("verifyIngredients");
      expect(recipe.nutritionVerification.minIngredientConfidence).toBeGreaterThanOrEqual(0.55);
    }
  });

  it("keeps ids, cluster lookup and prefix helpers coherent", () => {
    const ids = SEED_RECIPES_V2.map((recipe) => recipe.id);
    expect(new Set(ids).size).toBe(ids.length);
    const knownId = "seed-v2-mediterranean-butter-bean-shakshuka";
    expect(isSeedRecipeId(knownId)).toBe(true);
    expect(findSeedRecipeById(knownId)?.cluster).toBe("mediterranean");
    expect(findSeedRecipeById("not-real")).toBeNull();
    expect(isSeedRecipeId(null)).toBe(false);

    for (const recipe of SEED_RECIPES_V2) {
      expect(recipe.id.startsWith(SEED_RECIPE_ID_PREFIX)).toBe(true);
      expect(recipe.id.slice(SEED_RECIPE_ID_PREFIX.length)).toMatch(
        new RegExp(`^${recipe.cluster}-`),
      );
    }
  });

  it("retires cached and database-backed recipes from superseded catalogues", () => {
    expect(
      isRetiredDiscoverSeedCard({
        id: "seed-v2-mediterranean-classic-greek-salad",
        feedSource: "catalog",
      }),
    ).toBe(true);
    expect(
      isRetiredDiscoverSeedCard({
        id: "19a30f80-7b97-4bf3-8722-262acd50db51",
        creatorName: "Suppr Kitchen",
        contentOrigin: "first_party",
      }),
    ).toBe(true);
    expect(
      isRetiredDiscoverSeedCard({
        id: SEED_RECIPES_V2[0]!.id,
        creatorName: "Sloe Kitchen",
        feedSource: "catalog",
      }),
    ).toBe(false);
    expect(
      isRetiredDiscoverSeedCard({
        id: "19a30f80-7b97-4bf3-8722-262acd50db51",
        creatorName: "Sloe Kitchen",
        authorId: "user-1",
        contentOrigin: "first_party",
      }),
    ).toBe(false);
  });

  it("keeps tags non-empty", () => {
    for (const recipe of SEED_RECIPES_V2) {
      for (const tag of recipe.tags ?? []) expect(tag.length).toBeGreaterThan(0);
    }
  });
});
