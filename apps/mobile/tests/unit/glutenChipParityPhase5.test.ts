/**
 * glutenChipParityPhase5 — mobile parity test for B3.2.
 *
 * Authority: D-2026-04-27-13 (one allergen done brilliantly = gluten).
 * Pins that the mobile recipe-trust re-export forwards to the shared
 * `classifyRecipeGluten` so web and mobile resolve to the same chip
 * variant for any given ingredient list.
 */

import { describe, it, expect } from "vitest";

import {
  classifyRecipeGluten as mobileClassify,
  classifyIngredientGluten as mobileLineClassify,
} from "../../lib/recipeTrust";
import {
  classifyRecipeGluten as webClassify,
} from "@suppr/nutrition-core/recipeTrust";

describe("gluten chip parity (mobile re-export)", () => {
  it("mobile and web classifiers are the same function", () => {
    expect(mobileClassify).toBe(webClassify);
  });

  it("mobile classifyIngredientGluten resolves wheat as contains", () => {
    const r = mobileLineClassify("100g wheat flour");
    expect(r.status).toBe("contains");
    expect(r.confidence).toBe("high");
  });

  it("mobile classifyRecipeGluten resolves a clean recipe as gluten-high-conf", () => {
    const r = mobileClassify([
      "200g chicken breast",
      "1 cup quinoa",
      "olive oil, gluten-free",
    ]);
    expect(r.variant).toBe("gluten-high-conf");
    expect(r.message).toBe("No gluten-containing ingredients");
  });

  it("mobile classifyRecipeGluten resolves a soy sauce risk as gluten-uncertain", () => {
    const r = mobileClassify([
      "200g salmon",
      "1 tbsp soy sauce",
      "1 cup rice",
    ]);
    expect(r.variant).toBe("gluten-uncertain");
  });
});
