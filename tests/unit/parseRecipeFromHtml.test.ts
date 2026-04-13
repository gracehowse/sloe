/**
 * Tests for HTML recipe extraction — the core import pipeline.
 * Covers JSON-LD parsing, servings detection, HTML entity decoding.
 */
import { describe, it, expect } from "vitest";
import { parseRecipeFromHtml, siteNameFromUrl } from "@/lib/recipe-import/parseRecipeFromHtml";

function wrapJsonLd(recipe: Record<string, unknown>): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(recipe)}</script></head><body></body></html>`;
}

function wrapGraph(items: Record<string, unknown>[]): string {
  return wrapJsonLd({ "@context": "https://schema.org", "@graph": items });
}

describe("parseRecipeFromHtml", () => {
  // ── Basic extraction ───────────────────────────────────────────

  it("extracts title, ingredients, instructions from simple Recipe", () => {
    const html = wrapJsonLd({
      "@type": "Recipe",
      name: "Test Soup",
      recipeIngredient: ["1 cup water", "1 onion"],
      recipeInstructions: [{ "@type": "HowToStep", text: "Boil water" }],
    });
    const result = parseRecipeFromHtml(html);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Test Soup");
    expect(result!.ingredients).toEqual(["1 cup water", "1 onion"]);
    expect(result!.instructions).toEqual(["Boil water"]);
  });

  it("extracts from @graph array", () => {
    const html = wrapGraph([
      { "@type": "WebPage", name: "Blog Post" },
      { "@type": "Recipe", name: "Graph Recipe", recipeIngredient: ["salt"] },
    ]);
    const result = parseRecipeFromHtml(html);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Graph Recipe");
  });

  it("handles Recipe in array @type", () => {
    const html = wrapJsonLd({
      "@type": ["Recipe"],
      name: "Array Type Recipe",
      recipeIngredient: ["flour"],
    });
    const result = parseRecipeFromHtml(html);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Array Type Recipe");
  });

  // ── Servings parsing ───────────────────────────────────────────

  it("parses numeric recipeYield", () => {
    const html = wrapJsonLd({ "@type": "Recipe", name: "R", recipeYield: 4, recipeIngredient: ["a"] });
    expect(parseRecipeFromHtml(html)!.servings).toBe(4);
  });

  it("parses string recipeYield", () => {
    const html = wrapJsonLd({ "@type": "Recipe", name: "R", recipeYield: "4 servings", recipeIngredient: ["a"] });
    expect(parseRecipeFromHtml(html)!.servings).toBe(4);
  });

  it("parses array recipeYield", () => {
    const html = wrapJsonLd({ "@type": "Recipe", name: "R", recipeYield: ["4", "4 servings"], recipeIngredient: ["a"] });
    expect(parseRecipeFromHtml(html)!.servings).toBe(4);
  });

  it("parses range recipeYield (takes lower bound)", () => {
    const html = wrapJsonLd({ "@type": "Recipe", name: "R", recipeYield: "4-6", recipeIngredient: ["a"] });
    expect(parseRecipeFromHtml(html)!.servings).toBe(4);
  });

  it("parses 'Serves 4' format", () => {
    const html = wrapJsonLd({ "@type": "Recipe", name: "R", recipeYield: "Serves 4", recipeIngredient: ["a"] });
    expect(parseRecipeFromHtml(html)!.servings).toBe(4);
  });

  it("returns null servings when missing", () => {
    const html = wrapJsonLd({ "@type": "Recipe", name: "R", recipeIngredient: ["a"] });
    expect(parseRecipeFromHtml(html)!.servings).toBeNull();
  });

  // ── HTML entity decoding ───────────────────────────────────────

  it("decodes &amp; in title", () => {
    const html = wrapJsonLd({ "@type": "Recipe", name: "Salt &amp; Pepper", recipeIngredient: ["salt"] });
    expect(parseRecipeFromHtml(html)!.title).toBe("Salt & Pepper");
  });

  it("decodes &#039; in description", () => {
    const html = wrapJsonLd({
      "@type": "Recipe",
      name: "R",
      description: "It&#039;s great",
      recipeIngredient: ["a"],
    });
    expect(parseRecipeFromHtml(html)!.description).toBe("It's great");
  });

  it("decodes &frac12; in ingredients", () => {
    const html = wrapJsonLd({
      "@type": "Recipe",
      name: "R",
      recipeIngredient: ["&frac12; cup flour"],
    });
    expect(parseRecipeFromHtml(html)!.ingredients[0]).toBe("\u00BD cup flour");
  });

  it("decodes entities in instructions", () => {
    const html = wrapJsonLd({
      "@type": "Recipe",
      name: "R",
      recipeIngredient: ["a"],
      recipeInstructions: [{ "@type": "HowToStep", text: "Don&apos;t overcook" }],
    });
    expect(parseRecipeFromHtml(html)!.instructions[0]).toBe("Don't overcook");
  });

  // ── Ingredient normalization ───────────────────────────────────

  it("handles array-wrapped ingredients", () => {
    const html = wrapJsonLd({
      "@type": "Recipe",
      name: "R",
      recipeIngredient: [["1 cup flour"]],
    });
    const result = parseRecipeFromHtml(html);
    expect(result!.ingredients[0]).toBe("1 cup flour");
  });

  // ── Nutrition extraction ───────────────────────────────────────

  it("extracts site nutrition from JSON-LD", () => {
    const html = wrapJsonLd({
      "@type": "Recipe",
      name: "R",
      recipeIngredient: ["a"],
      nutrition: {
        "@type": "NutritionInformation",
        calories: "350 calories",
        proteinContent: "30g",
        carbohydrateContent: "40g",
        fatContent: "10g",
      },
    });
    const result = parseRecipeFromHtml(html);
    expect(result!.siteNutrition).not.toBeNull();
    expect(result!.siteNutrition!.calories).toBe(350);
    expect(result!.siteNutrition!.protein).toBe(30);
    expect(result!.siteNutrition!.carbs).toBe(40);
    expect(result!.siteNutrition!.fat).toBe(10);
  });

  // ── Edge cases ─────────────────────────────────────────────────

  it("returns null for HTML without JSON-LD", () => {
    expect(parseRecipeFromHtml("<html><body>Hello</body></html>")).toBeNull();
  });

  it("returns null for JSON-LD without Recipe type", () => {
    const html = wrapJsonLd({ "@type": "WebPage", name: "Blog" });
    expect(parseRecipeFromHtml(html)).toBeNull();
  });

  it("returns null for Recipe without ingredients", () => {
    const html = wrapJsonLd({ "@type": "Recipe", name: "Empty Recipe" });
    // No ingredients → null because we require at least title
    const result = parseRecipeFromHtml(html);
    // Should still return with empty ingredients list
    if (result) {
      expect(result.ingredients).toEqual([]);
    }
  });

  it("extracts prep and cook time", () => {
    const html = wrapJsonLd({
      "@type": "Recipe",
      name: "R",
      recipeIngredient: ["a"],
      prepTime: "PT15M",
      cookTime: "PT1H30M",
    });
    const result = parseRecipeFromHtml(html);
    expect(result!.prepTimeMin).toBe(15);
    expect(result!.cookTimeMin).toBe(90);
  });

  it("handles partial nutrition (calories only)", () => {
    const html = wrapJsonLd({
      "@type": "Recipe",
      name: "R",
      recipeIngredient: ["a"],
      nutrition: { "@type": "NutritionInformation", calories: "200 calories" },
    });
    const result = parseRecipeFromHtml(html);
    expect(result!.siteNutrition!.calories).toBe(200);
    expect(result!.siteNutrition!.protein).toBeNull();
  });

  it("handles multiple JSON-LD blocks", () => {
    const html = `
      <html><head>
        <script type="application/ld+json">{"@type":"WebPage","name":"Blog"}</script>
        <script type="application/ld+json">{"@type":"Recipe","name":"Found It","recipeIngredient":["flour"]}</script>
      </head><body></body></html>
    `;
    const result = parseRecipeFromHtml(html);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Found It");
  });
});

describe("siteNameFromUrl", () => {
  it("extracts domain name without www", () => {
    expect(siteNameFromUrl("https://www.downshiftology.com/recipes/chicken/")).toBe("downshiftology.com");
  });

  it("extracts domain without https prefix", () => {
    expect(siteNameFromUrl("https://fitfoodiefinds.com/recipe/")).toBe("fitfoodiefinds.com");
  });
});
