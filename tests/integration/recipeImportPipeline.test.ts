/**
 * Integration tests for the recipe import pipeline.
 * Tests the parsing and extraction functions (not HTTP fetching).
 */
import { describe, it, expect } from "vitest";
import { parseRecipeFromHtml } from "@/lib/recipe-import/parseRecipeFromHtml";
import { detectSocialPlatform } from "@/lib/recipe-import/extractSocialRecipe";
import { parseRawIngredients } from "@/lib/nutrition/verifyIngredients";

describe("detectSocialPlatform", () => {
  it("detects Instagram", () => {
    expect(detectSocialPlatform("https://www.instagram.com/p/ABC123/")).toBe("instagram");
    expect(detectSocialPlatform("https://instagr.am/p/ABC123/")).toBe("instagram");
  });

  it("detects TikTok", () => {
    expect(detectSocialPlatform("https://www.tiktok.com/@user/video/123")).toBe("tiktok");
    expect(detectSocialPlatform("https://vm.tiktok.com/ABC123/")).toBe("tiktok");
  });

  it("detects YouTube", () => {
    expect(detectSocialPlatform("https://www.youtube.com/watch?v=abc123")).toBe("youtube");
    expect(detectSocialPlatform("https://youtu.be/abc123")).toBe("youtube");
    expect(detectSocialPlatform("https://m.youtube.com/shorts/abc123")).toBe("youtube");
  });

  it("returns null for regular URLs", () => {
    expect(detectSocialPlatform("https://downshiftology.com/recipes/chicken-fajitas/")).toBeNull();
    expect(detectSocialPlatform("https://example.com")).toBeNull();
  });
});

describe("parseRecipeFromHtml", () => {
  const minimalRecipeHtml = `
    <html><head>
      <script type="application/ld+json">
        {
          "@type": "Recipe",
          "name": "Test Chicken",
          "recipeIngredient": ["2 chicken breasts", "1 tbsp olive oil", "salt and pepper"],
          "recipeInstructions": [{"@type": "HowToStep", "text": "Cook the chicken."}],
          "recipeYield": "4 servings"
        }
      </script>
    </head><body></body></html>
  `;

  it("extracts recipe from JSON-LD", () => {
    const result = parseRecipeFromHtml(minimalRecipeHtml);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Test Chicken");
    expect(result!.ingredients).toHaveLength(3);
    expect(result!.ingredients[0]).toContain("chicken breasts");
    expect(result!.servings).toBe(4);
  });

  it("extracts instructions", () => {
    const result = parseRecipeFromHtml(minimalRecipeHtml);
    expect(result!.instructions).toHaveLength(1);
    expect(result!.instructions[0]).toContain("Cook the chicken");
  });

  it("returns null when no JSON-LD", () => {
    const result = parseRecipeFromHtml("<html><body><h1>Not a recipe</h1></body></html>");
    expect(result).toBeNull();
  });

  it("handles @graph wrapper", () => {
    const html = `<html><head><script type="application/ld+json">
      {"@graph": [{"@type": "Recipe", "name": "Graph Recipe", "recipeIngredient": ["1 egg"]}]}
    </script></head></html>`;
    const result = parseRecipeFromHtml(html);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Graph Recipe");
  });

  it("extracts nutrition from JSON-LD when present", () => {
    const html = `<html><head><script type="application/ld+json">
      {"@type": "Recipe", "name": "Nutritious", "recipeIngredient": ["1 egg"],
       "nutrition": {"@type": "NutritionInformation", "calories": "200 calories", "proteinContent": "15 g", "carbohydrateContent": "10 g", "fatContent": "12 g"}}
    </script></head></html>`;
    const result = parseRecipeFromHtml(html);
    expect(result!.siteNutrition).not.toBeNull();
    expect(result!.siteNutrition!.calories).toBe(200);
    expect(result!.siteNutrition!.protein).toBe(15);
  });
});

describe("parseRawIngredients", () => {
  it("parses structured ingredient lines", () => {
    const result = parseRawIngredients(["2 chicken breasts", "1 tbsp olive oil"]);
    expect(result).toHaveLength(2);
    expect(result[0].name).toContain("chicken");
    expect(result[0].amount).toBe("2");
  });

  it("handles fractional amounts", () => {
    const result = parseRawIngredients(["1/2 cup flour"]);
    expect(result).toHaveLength(1);
    expect(result[0].unit).toContain("cup");
  });

  it("handles empty array", () => {
    const result = parseRawIngredients([]);
    expect(result).toHaveLength(0);
  });
});
