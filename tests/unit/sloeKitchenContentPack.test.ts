import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Ingredient = {
  item: string;
  grams: number;
};

type Recipe = {
  slug: string;
  image: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  ingredients: Ingredient[];
  steps: string[];
  allergens: string[];
  nutrition?: unknown;
};

const BASE = resolve(process.cwd(), "content/sloe-kitchen/v1");
const recipesFile = JSON.parse(
  readFileSync(resolve(BASE, "recipes.json"), "utf8"),
) as { recipes: Recipe[] };
const catalogueFile = JSON.parse(
  readFileSync(resolve(BASE, "catalogue.json"), "utf8"),
) as { recipes: Array<{ slug: string }> };
const provenanceFile = JSON.parse(
  readFileSync(resolve(BASE, "image-provenance.json"), "utf8"),
) as {
  generationMode: string;
  assets: Array<{ slug: string; approval: string }>;
};
const nutritionFile = JSON.parse(
  readFileSync(resolve(BASE, "nutrition.json"), "utf8"),
) as {
  recipes: Array<{
    slug: string;
    status: string;
    perServing: Record<string, number>;
    verification: {
      minIngredientConfidence: number;
      belowAcceptFloorCount: number;
    };
  }>;
};
const hostedImagesFile = JSON.parse(
  readFileSync(resolve(BASE, "hosted-images.json"), "utf8"),
) as {
  images: Array<{ slug: string; url: string; path: string }>;
};

const sorted = (values: string[]) => [...values].sort();

describe("Sloe Kitchen approved content pack", () => {
  it("contains exactly the 18 founder-approved recipes", () => {
    expect(recipesFile.recipes).toHaveLength(18);
    expect(new Set(recipesFile.recipes.map((recipe) => recipe.slug)).size).toBe(18);
  });

  it("keeps recipe, catalogue, provenance, nutrition, hosted asset and local image slugs in parity", () => {
    const recipeSlugs = sorted(recipesFile.recipes.map((recipe) => recipe.slug));
    const catalogueSlugs = sorted(catalogueFile.recipes.map((recipe) => recipe.slug));
    const provenanceSlugs = sorted(provenanceFile.assets.map((asset) => asset.slug));
    const nutritionSlugs = sorted(nutritionFile.recipes.map((recipe) => recipe.slug));
    const hostedImageSlugs = sorted(hostedImagesFile.images.map((image) => image.slug));
    const imageSlugs = sorted(
      readdirSync(resolve(BASE, "images"))
        .filter((name) => name.endsWith(".jpg"))
        .map((name) => name.slice(0, -4)),
    );

    expect(catalogueSlugs).toEqual(recipeSlugs);
    expect(provenanceSlugs).toEqual(recipeSlugs);
    expect(nutritionSlugs).toEqual(recipeSlugs);
    expect(hostedImageSlugs).toEqual(recipeSlugs);
    expect(imageSlugs).toEqual(recipeSlugs);
  });

  it("ships executable recipes with weighed ingredients and explicit allergens", () => {
    for (const recipe of recipesFile.recipes) {
      expect(recipe.servings, recipe.slug).toBeGreaterThan(0);
      expect(recipe.prepMinutes, recipe.slug).toBeGreaterThanOrEqual(0);
      expect(recipe.cookMinutes, recipe.slug).toBeGreaterThan(0);
      expect(recipe.ingredients.length, recipe.slug).toBeGreaterThanOrEqual(6);
      expect(recipe.steps.length, recipe.slug).toBeGreaterThanOrEqual(4);
      expect(recipe.steps.length, recipe.slug).toBeLessThanOrEqual(8);
      expect(recipe.allergens, recipe.slug).toBeInstanceOf(Array);
      expect(existsSync(resolve(BASE, recipe.image)), recipe.slug).toBe(true);

      for (const ingredient of recipe.ingredients) {
        expect(ingredient.item.length, recipe.slug).toBeGreaterThan(0);
        expect(ingredient.grams, `${recipe.slug}: ${ingredient.item}`).toBeGreaterThan(0);
      }
    }
  });

  it("does not publish hand-entered nutrition estimates", () => {
    for (const recipe of recipesFile.recipes) {
      expect(recipe.nutrition, recipe.slug).toBeUndefined();
    }
  });

  it("publishes only accepted engine nutrition and production-hosted images", () => {
    for (const recipe of nutritionFile.recipes) {
      expect(recipe.status, recipe.slug).toBe("verified");
      expect(recipe.verification.belowAcceptFloorCount, recipe.slug).toBe(0);
      expect(recipe.verification.minIngredientConfidence, recipe.slug).toBeGreaterThanOrEqual(0.55);
      expect(recipe.perServing.calories, recipe.slug).toBeGreaterThan(0);
    }

    for (const image of hostedImagesFile.images) {
      expect(image.path, image.slug).toBe(`sloe-kitchen/v1/${image.slug}.jpg`);
      expect(image.url, image.slug).toMatch(
        /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/recipe-images\/sloe-kitchen\/v1\//,
      );
    }
  });

  it("pins safe doneness cues for the higher-risk proteins", () => {
    const cues: Record<string, RegExp> = {
      "chicken-tinga-rice-bowl": /75°C/,
      "coconut-lime-chicken-curry": /75°C/,
      "gochujang-turkey-meatballs": /74°C/,
      "soy-ginger-cod-bok-choy": /63°C/,
      "prawn-saganaki-feta": /pink, opaque/,
      "mango-prawn-rice-bowl": /pink, opaque/,
      "thai-basil-beef-rice": /no pink mince remaining/,
      "ginger-chicken-udon": /fully opaque/,
    };

    for (const [slug, cue] of Object.entries(cues)) {
      const recipe = recipesFile.recipes.find((candidate) => candidate.slug === slug);
      expect(recipe, slug).toBeDefined();
      expect(recipe?.steps.join(" "), slug).toMatch(cue);
    }
  });

  it("records built-in generation and a positive founder selection", () => {
    expect(provenanceFile.generationMode).toBe("OpenAI built-in image generation");
    for (const asset of provenanceFile.assets) {
      expect(asset.approval.length, asset.slug).toBeGreaterThan(0);
    }
  });
});
