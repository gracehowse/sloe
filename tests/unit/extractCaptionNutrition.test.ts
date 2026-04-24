import { describe, it, expect } from "vitest";
import {
  extractCaptionNutrition,
  nutritionDelta,
  MATERIAL_DIVERGENCE_THRESHOLD,
} from "../../src/lib/recipe-import/extractCaptionNutrition.ts";

describe("extractCaptionNutrition", () => {
  it("pulls kcal + macros when clearly per-serving", () => {
    const out = extractCaptionNutrition(
      "Healthy pistachio pudding pots 🍮 130 kcal per serving, 9g protein, 14g carbs, 8g fat",
    );
    expect(out.caloriesPerServing).toBe(130);
    expect(out.proteinG).toBe(9);
    expect(out.carbsG).toBe(14);
    expect(out.fatG).toBe(8);
  });

  it("accepts 'each' as a per-serving hint", () => {
    const out = extractCaptionNutrition("Makes 4 pots, 130 cal each");
    expect(out.caloriesPerServing).toBe(130);
  });

  it("accepts 'approx.' / '~' prefixes", () => {
    expect(extractCaptionNutrition("~210 kcal per serving").caloriesPerServing).toBe(210);
    expect(extractCaptionNutrition("Approx. 210 kcal per serving").caloriesPerServing).toBe(210);
  });

  it("rejects ranges (ambiguous claim)", () => {
    const out = extractCaptionNutrition("200-300 kcal per serving");
    expect(out.caloriesPerServing).toBeNull();
  });

  it("rejects numbers with no per-serving hint anywhere", () => {
    const out = extractCaptionNutrition(
      "Whisk the tofu and chocolate together. 800 kcal total batch. 60g chocolate.",
    );
    expect(out.caloriesPerServing).toBeNull();
  });

  it("returns all nulls for empty / non-string input", () => {
    expect(extractCaptionNutrition(null).caloriesPerServing).toBeNull();
    expect(extractCaptionNutrition("").caloriesPerServing).toBeNull();
    expect(extractCaptionNutrition("   ").caloriesPerServing).toBeNull();
  });

  it("does not misread protein from 'protein powder'", () => {
    const out = extractCaptionNutrition(
      "Add 1 scoop of protein powder. Makes 4 servings. 200 kcal per serving.",
    );
    expect(out.caloriesPerServing).toBe(200);
    // No '25g protein' claim, so protein claim should stay null
    expect(out.proteinG).toBeNull();
  });

  it("tolerates 'protein: 25g' colon form", () => {
    const out = extractCaptionNutrition("Per serving — Protein: 25g, Carbs: 40g, Fat: 10g");
    expect(out.proteinG).toBe(25);
    expect(out.carbsG).toBe(40);
    expect(out.fatG).toBe(10);
  });
});

describe("nutritionDelta", () => {
  const claim = { caloriesPerServing: 130, proteinG: null, carbsG: null, fatG: null };

  it("flags >25% divergence", () => {
    const out = nutritionDelta(claim, 210);
    expect(out.caloriesDelta).toBe(80);
    expect(out.caloriesPercent).toBeCloseTo(0.62, 2);
    expect(out.materiallyDiverges).toBe(true);
  });

  it("does not flag when within threshold", () => {
    const out = nutritionDelta(claim, 150); // 15% over
    expect(out.materiallyDiverges).toBe(false);
  });

  it("flags negative divergence too (we undercounted)", () => {
    const out = nutritionDelta(claim, 80); // -38%
    expect(out.caloriesDelta).toBe(-50);
    expect(out.materiallyDiverges).toBe(true);
  });

  it("returns neutral payload when no claim exists", () => {
    const out = nutritionDelta({ caloriesPerServing: null, proteinG: null, carbsG: null, fatG: null }, 210);
    expect(out.caloriesDelta).toBeNull();
    expect(out.materiallyDiverges).toBe(false);
  });

  it("constant threshold is 25%", () => {
    expect(MATERIAL_DIVERGENCE_THRESHOLD).toBe(0.25);
  });
});
