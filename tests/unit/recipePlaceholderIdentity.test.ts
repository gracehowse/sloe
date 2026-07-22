import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getRecipeFallback,
  recipePlaceholderGlyphScale,
  resolveRecipePlaceholderIdentity,
  RECIPE_PLACEHOLDER_IDENTITY_FLAG,
} from "../../src/lib/recipe/recipeHeroFallback";

describe("ENG-1667 placeholder identity", () => {
  it("resolveRecipePlaceholderIdentity aliases getRecipeFallback", () => {
    const input = { id: "recipe-tofu-bowl", title: "Tofu bowl", tags: ["vegan"] };
    expect(resolveRecipePlaceholderIdentity(input)).toEqual(getRecipeFallback(input));
  });

  it("same recipe id freezes pattern + glyph + tint across calls", () => {
    const a = getRecipeFallback({ id: "stable-id-1", title: "Salmon rice", tags: ["fish"] });
    const b = getRecipeFallback({ id: "stable-id-1", title: "Salmon rice", tags: ["fish"] });
    expect(a.pattern).toBe(b.pattern);
    expect(a.glyph).toBe(b.glyph);
    expect(a.gradientStart).toBe(b.gradientStart);
    expect(a.bucket).toBe("blues");
  });

  it("glyph scale caps grow when identity flag is on for hero slabs only", () => {
    expect(recipePlaceholderGlyphScale(false, "thumb")).toEqual({ maxPx: 112, cqminFrac: 0.3 });
    expect(recipePlaceholderGlyphScale(false, "hero")).toEqual({ maxPx: 112, cqminFrac: 0.3 });
    expect(recipePlaceholderGlyphScale(true, "thumb")).toEqual({ maxPx: 112, cqminFrac: 0.3 });
    expect(recipePlaceholderGlyphScale(true, "hero")).toEqual({ maxPx: 144, cqminFrac: 0.38 });
  });

  it("web + mobile RecipeHeroFallback both consume shared getRecipeFallback", () => {
    const web = readFileSync(resolve("src/app/components/suppr/RecipeHeroFallback.tsx"), "utf8");
    const mobile = readFileSync(resolve("apps/mobile/components/RecipeHeroFallback.tsx"), "utf8");
    expect(web).toContain("getRecipeFallback");
    expect(mobile).toContain("getRecipeFallback");
    expect(web).toContain(RECIPE_PLACEHOLDER_IDENTITY_FLAG);
    expect(mobile).toContain(RECIPE_PLACEHOLDER_IDENTITY_FLAG);
    expect(web).toContain("recipeHeroGlyphClampCss");
    expect(mobile).toContain("resolveRecipeHeroGlyphPx");
  });

  it("hero surfaces pass variant=\"hero\" on web + mobile", () => {
    const webHeros = [
      "src/app/components/RecipeDetail.tsx",
      "app/recipe/[id]/page.tsx",
      "src/app/components/library/FeaturedHero.tsx",
      "src/app/components/suppr/discover-recipe-image.tsx",
    ];
    for (const file of webHeros) {
      expect(readFileSync(resolve(file), "utf8")).toMatch(/variant="hero"/);
    }
    const mobileHeros = [
      "apps/mobile/components/recipe/RecipeDetailHero.tsx",
      "apps/mobile/app/(tabs)/discover.tsx",
    ];
    for (const file of mobileHeros) {
      expect(readFileSync(resolve(file), "utf8")).toMatch(/variant="hero"/);
    }
  });
});
