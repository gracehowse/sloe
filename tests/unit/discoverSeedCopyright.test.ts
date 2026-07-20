/** Legal/provenance contract for the first-party Sloe Kitchen seed. */
import { describe, expect, it } from "vitest";
import { SEED_RECIPES_V2 } from "../../src/lib/recipes/seedRecipesV2";

describe("discoverSeedCopyright", () => {
  it("attributes every recipe and image to the reviewed first-party collection", () => {
    for (const recipe of SEED_RECIPES_V2) {
      expect(recipe.attribution.author).toBe("Sloe Kitchen");
      expect(["original", "ai-generated-edited"]).toContain(
        recipe.attribution.origin,
      );
      expect(recipe.attribution.imageSource.provider).toBe("openai-imagegen");
      expect(recipe.attribution.imageSource.url).toBe(recipe.heroImageUrl);
      expect(recipe.attribution.imageSource.sourceArtifact).toMatch(/^exec-[a-z0-9-]+\.png$/);
      expect(recipe.attribution.notes?.length).toBeGreaterThan(0);
      expect(recipe.attribution.notes).not.toMatch(/https?:\/\//);
      expect((recipe as { sourceUrl?: unknown }).sourceUrl).toBeUndefined();
    }
  });
});
