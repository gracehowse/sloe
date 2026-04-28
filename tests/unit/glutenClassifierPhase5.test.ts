/**
 * glutenClassifierPhase5 — pins the Phase 5 / B3.2 gluten classification
 * behaviour at both the ingredient level and the recipe-aggregate level.
 *
 * Authority: D-2026-04-27-13 (one allergen done brilliantly = gluten).
 * Source: src/lib/nutrition/glutenClassifier.ts +
 *         src/lib/nutrition/recipeTrust.ts (classifyRecipeGluten).
 *
 * Coverage strategy: regression-pinning the four edge classes that the
 * coeliac UX has to get right —
 *   1. Explicit gluten-bearing grain → contains + high.
 *   2. Implicit gluten dish (pasta, bread) → contains + high unless
 *      qualified ("gluten-free pasta", "rice noodles", etc.).
 *   3. Risk markers (oats, soy sauce, miso) → risk + medium unless
 *      cleared by qualifier (certified gluten-free / tamari / etc.).
 *   4. Known gluten-free flours / explicit "gluten-free" qualifier →
 *      free + high.
 *
 * Recipe-aggregate: the chip-decision matrix —
 *   - any contains  → null (gluten-containing recipe by intent).
 *   - any risk      → `gluten-uncertain`.
 *   - all high-conf → `gluten-high-conf`.
 *   - mix of high + low confidence → null (insufficient surface to
 *     claim high confidence in good faith).
 */

import { describe, it, expect } from "vitest";

import { classifyIngredientGluten } from "../../src/lib/nutrition/glutenClassifier";
import { classifyRecipeGluten } from "../../src/lib/nutrition/recipeTrust";

describe("classifyIngredientGluten — explicit gluten-bearing", () => {
  it.each([
    "200g wheat flour",
    "1 cup barley",
    "rye bread",
    "barley malt syrup",
    "100g semolina",
    "durum wheat pasta",
    "spelt flour",
    "kamut grain",
    "1 tbsp triticale",
    "100g bulgur",
    "200g couscous",
    "freekeh, cooked",
    "2 cups farina",
    "einkorn flour",
    "seitan, cubed",
  ])("classifies %s as contains + high", (text) => {
    const c = classifyIngredientGluten(text);
    expect(c.status).toBe("contains");
    expect(c.confidence).toBe("high");
    expect(c.matched).toBeTruthy();
  });

  it("does NOT match 'wheat' as a substring of 'buckwheat'", () => {
    // word-boundary regex must not trip on "buckwheat" → "wheat" is the
    // canonical false positive to guard against.
    const c = classifyIngredientGluten("100g buckwheat flour");
    expect(c.status).toBe("free");
    expect(c.confidence).toBe("high");
  });

  it("does NOT match 'rye' as a substring of unrelated words", () => {
    // Pure word-boundary regex: 'turkey' should not match 'rye'.
    const c = classifyIngredientGluten("200g turkey breast");
    expect(c.status).not.toBe("contains");
  });
});

describe("classifyIngredientGluten — implicit gluten dishes", () => {
  it("treats unqualified 'pasta' as contains", () => {
    const c = classifyIngredientGluten("400g pasta");
    expect(c.status).toBe("contains");
    expect(c.confidence).toBe("high");
  });

  it("clears 'rice pasta' to free", () => {
    const c = classifyIngredientGluten("400g rice pasta");
    expect(c.status).toBe("free");
    expect(c.confidence).toBe("high");
  });

  it("clears 'gluten-free pasta' to free", () => {
    const c = classifyIngredientGluten("400g gluten-free pasta");
    expect(c.status).toBe("free");
    expect(c.confidence).toBe("high");
  });

  it("treats unqualified 'bread' as contains", () => {
    const c = classifyIngredientGluten("2 slices bread");
    expect(c.status).toBe("contains");
  });

  it("clears 'gluten-free bread' to free", () => {
    const c = classifyIngredientGluten("2 slices gluten-free bread");
    expect(c.status).toBe("free");
    expect(c.confidence).toBe("high");
  });

  it("clears 'corn tortilla' to free", () => {
    const c = classifyIngredientGluten("1 corn tortilla");
    expect(c.status).toBe("free");
  });
});

describe("classifyIngredientGluten — risk markers", () => {
  it("treats unqualified oats as risk + medium", () => {
    const c = classifyIngredientGluten("50g oats");
    expect(c.status).toBe("risk");
    expect(c.confidence).toBe("medium");
    expect(c.matched).toBe("oats");
  });

  it("clears 'certified gluten-free oats' to free", () => {
    const c = classifyIngredientGluten("50g certified gluten-free oats");
    expect(c.status).toBe("free");
    expect(c.confidence).toBe("high");
  });

  it("treats unqualified soy sauce as risk", () => {
    const c = classifyIngredientGluten("2 tbsp soy sauce");
    expect(c.status).toBe("risk");
    expect(c.confidence).toBe("medium");
  });

  it("clears 'tamari' as a soy-sauce alternative", () => {
    const c = classifyIngredientGluten("2 tbsp tamari soy sauce");
    expect(c.status).toBe("free");
  });

  it("treats unqualified miso as risk", () => {
    const c = classifyIngredientGluten("1 tbsp miso paste");
    expect(c.status).toBe("risk");
  });

  it("clears 'gluten-free miso' to free", () => {
    const c = classifyIngredientGluten("1 tbsp gluten-free miso");
    expect(c.status).toBe("free");
    expect(c.confidence).toBe("high");
  });

  it("treats unqualified noodles as risk", () => {
    const c = classifyIngredientGluten("200g noodles");
    expect(c.status).toBe("risk");
  });

  it("clears 'rice noodles' to free", () => {
    const c = classifyIngredientGluten("200g rice noodles");
    expect(c.status).toBe("free");
  });
});

describe("classifyIngredientGluten — known gluten-free + edge", () => {
  it("classifies almond flour as free + high", () => {
    const c = classifyIngredientGluten("100g almond flour");
    expect(c.status).toBe("free");
    expect(c.confidence).toBe("high");
  });

  it("classifies quinoa as free + high", () => {
    const c = classifyIngredientGluten("1 cup cooked quinoa");
    expect(c.status).toBe("free");
    expect(c.confidence).toBe("high");
  });

  it("explicit 'gluten-free' qualifier wins over implicit dish keyword", () => {
    const c = classifyIngredientGluten("gluten-free spaghetti");
    expect(c.status).toBe("free");
    expect(c.confidence).toBe("high");
  });

  it("returns free + low for ambiguous unfamiliar tokens", () => {
    // Unrecognised seasoning — defaults to cautious-free with low
    // confidence. The recipe-level aggregator silences a chip on
    // any line we can't classify with high confidence.
    const c = classifyIngredientGluten("1 dash mystery sauce");
    expect(c.status).toBe("free");
    expect(c.confidence).toBe("low");
  });

  it("handles empty input safely", () => {
    expect(classifyIngredientGluten("").confidence).toBe("low");
    expect(classifyIngredientGluten("   ").confidence).toBe("low");
  });
});

describe("classifyRecipeGluten — recipe-level aggregation", () => {
  it("returns null variant when ingredients list is empty", () => {
    const r = classifyRecipeGluten([]);
    expect(r.variant).toBeNull();
    expect(r.message).toBe("");
  });

  it("returns null variant when any ingredient contains gluten (recipe is gluten-containing by intent)", () => {
    const r = classifyRecipeGluten([
      "200g chicken breast",
      "100g pasta",
      "olive oil",
    ]);
    expect(r.variant).toBeNull();
    expect(r.message).toBe("");
  });

  it("returns gluten-uncertain on any risk ingredient", () => {
    const r = classifyRecipeGluten([
      "200g salmon",
      "1 tbsp soy sauce",
      "1 cup steamed rice",
    ]);
    expect(r.variant).toBe("gluten-uncertain");
    expect(r.message).toBe("Contains potential gluten · review");
  });

  it("returns gluten-high-conf when every ingredient is free + high confidence", () => {
    const r = classifyRecipeGluten([
      "200g chicken breast",
      "1 cup quinoa",
      "100g almond flour",
      "olive oil, gluten-free",
    ]);
    expect(r.variant).toBe("gluten-high-conf");
    expect(r.message).toBe("No gluten-containing ingredients");
  });

  it("returns null variant when any ingredient is free + low (insufficient surface)", () => {
    // Coeliac-grade UX: claim high-confidence only when EVERY line
    // is high-confidence. A single ambiguous line silences the chip.
    // "mystery seasoning blend" and "small handful of leaves" don't
    // match any grain / produce / meat token so they classify as
    // free + low — silencing the high-confidence claim.
    const r = classifyRecipeGluten([
      "1 mystery seasoning blend",
      "1 cup quinoa", // high
    ]);
    expect(r.variant).toBeNull();
  });

  it("returns gluten-uncertain when soy sauce sits next to known gluten-free items", () => {
    const r = classifyRecipeGluten([
      "200g tofu",
      "200g rice noodles",
      "2 tbsp soy sauce", // risk overrides the otherwise-clean recipe
    ]);
    expect(r.variant).toBe("gluten-uncertain");
  });

  it("perIngredient surfaces matched tokens for inline UI flagging", () => {
    const r = classifyRecipeGluten([
      "200g chicken",
      "100g pasta",
      "1 tbsp soy sauce",
    ]);
    // null variant (because pasta = contains) but perIngredient still
    // reflects per-line classifications.
    expect(r.perIngredient).toHaveLength(3);
    expect(r.perIngredient[1].status).toBe("contains");
    expect(r.perIngredient[1].matched).toBe("pasta");
    expect(r.perIngredient[2].status).toBe("risk");
  });
});
