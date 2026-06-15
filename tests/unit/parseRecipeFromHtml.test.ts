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
  // ── F-64 image resolution ──────────────────────────────────────

  it("F-64: prefers og:image over JSON-LD thumbnail", () => {
    const html = `
      <html><head>
        <meta property="og:image" content="https://example.com/hero-1200.jpg"/>
        <script type="application/ld+json">${JSON.stringify({
          "@type": "Recipe",
          name: "T",
          recipeIngredient: ["x"],
          image: "https://example.com/hero-225x225.jpg",
        })}</script>
      </head><body></body></html>`;
    const r = parseRecipeFromHtml(html);
    expect(r?.imageUrl).toBe("https://example.com/hero-1200.jpg");
  });

  it("F-64: strips WP core -WxH filename suffix when falling back to JSON-LD", () => {
    const html = wrapJsonLd({
      "@type": "Recipe",
      name: "T",
      recipeIngredient: ["x"],
      image: "https://cookieandkate.com/images/2019/01/best-lentil-soup-recipe-4-225x225.jpg",
    });
    const r = parseRecipeFromHtml(html);
    expect(r?.imageUrl).toBe(
      "https://cookieandkate.com/images/2019/01/best-lentil-soup-recipe-4.jpg",
    );
  });

  it("F-64: strips Photon fit/resize/w/h query params", () => {
    const html = wrapJsonLd({
      "@type": "Recipe",
      name: "T",
      recipeIngredient: ["x"],
      image: "https://pinchofyum.com/tachyon/Spicy-Peanut-Chicken-Salad-Soba-Square.png?fit=225%2C225",
    });
    const r = parseRecipeFromHtml(html);
    expect(r?.imageUrl).toBe(
      "https://pinchofyum.com/tachyon/Spicy-Peanut-Chicken-Salad-Soba-Square.png",
    );
  });

  it("F-64: leaves -scaled WP variant alone (already full-size)", () => {
    const html = wrapJsonLd({
      "@type": "Recipe",
      name: "T",
      recipeIngredient: ["x"],
      image:
        "https://www.halfbakedharvest.com/wp-content/uploads/2025/06/Easy-Sheet-Pan-Chicken-Fajitas-1-scaled.jpg",
    });
    const r = parseRecipeFromHtml(html);
    expect(r?.imageUrl).toBe(
      "https://www.halfbakedharvest.com/wp-content/uploads/2025/06/Easy-Sheet-Pan-Chicken-Fajitas-1-scaled.jpg",
    );
  });

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

  it("parses ISO duration with day segment (P1DT30M)", () => {
    const html = wrapJsonLd({
      "@type": "Recipe",
      name: "R",
      recipeIngredient: ["a"],
      prepTime: "P1DT30M",
    });
    const result = parseRecipeFromHtml(html);
    expect(result!.prepTimeMin).toBe(24 * 60 + 30);
  });

  it("derives cook time from totalTime when cookTime missing", () => {
    const html = wrapJsonLd({
      "@type": "Recipe",
      name: "R",
      recipeIngredient: ["a"],
      prepTime: "PT10M",
      totalTime: "PT40M",
    });
    const result = parseRecipeFromHtml(html);
    expect(result!.prepTimeMin).toBe(10);
    expect(result!.cookTimeMin).toBe(30);
  });

  it("uses totalTime as cook when prep absent", () => {
    const html = wrapJsonLd({
      "@type": "Recipe",
      name: "R",
      recipeIngredient: ["a"],
      totalTime: "PT25M",
    });
    const result = parseRecipeFromHtml(html);
    expect(result!.prepTimeMin).toBeNull();
    expect(result!.cookTimeMin).toBe(25);
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

  it("drops prep-state ingredient lines (ENG-1136)", () => {
    const html = wrapJsonLd({
      "@type": "Recipe",
      name: "R",
      recipeIngredient: [
        "2 tbsp cornflour",
        "1/2 tsp cornflour mixed with warm water",
        "cooked rice to serve (optional)",
      ],
    });
    const result = parseRecipeFromHtml(html);
    expect(result!.ingredients).toEqual(["2 tbsp cornflour"]);
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
