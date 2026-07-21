/**
 * ENG-1274 — unit tests for recipe grocery cost estimation.
 */
import { describe, expect, it } from "vitest";

import {
  estimateRecipeCost,
  formatRecipeCostServingLabel,
  formatGbp,
} from "../../src/lib/recipe/estimateRecipeCost";
import { lookupIngredientPrice } from "../../src/lib/recipe/ingredientPriceTable";

describe("lookupIngredientPrice", () => {
  it("prefers the longer, more specific key (chicken breast before chicken)", () => {
    const rule = lookupIngredientPrice("boneless chicken breast");
    expect(rule?.key).toBe("chicken breast");
  });

  it("returns null for unknown ingredients", () => {
    expect(lookupIngredientPrice("unicorn dust")).toBeNull();
  });
});

describe("estimateRecipeCost — honest coverage gating", () => {
  const chickenRice = [
    { name: "chicken breast", amount: "400", unit: "g" },
    { name: "basmati rice", amount: "200", unit: "g" },
    { name: "onion", amount: "1", unit: "medium" },
  ];

  it("returns a per-serving range when enough lines are priced", () => {
    const est = estimateRecipeCost({ ingredients: chickenRice, servings: 4 });
    expect(est).not.toBeNull();
    expect(est!.pricedLineCount).toBeGreaterThanOrEqual(2);
    expect(est!.coverageRatio).toBeGreaterThanOrEqual(0.5);
    expect(est!.perServingLowGbp).toBeGreaterThan(0);
    expect(est!.perServingHighGbp).toBeGreaterThan(est!.perServingLowGbp);
  });

  it("returns null when fewer than two lines can be priced", () => {
    const est = estimateRecipeCost({
      ingredients: [{ name: "chicken breast", amount: "200", unit: "g" }],
      servings: 2,
    });
    expect(est).toBeNull();
  });

  it("returns null when coverage is below 50%", () => {
    const est = estimateRecipeCost({
      ingredients: [
        { name: "chicken breast", amount: "200", unit: "g" },
        { name: "xyzzylkom", amount: "100", unit: "g" },
        { name: "plughqwert", amount: "50", unit: "g" },
        { name: "zztopmix", amount: "30", unit: "g" },
      ],
      servings: 2,
    });
    expect(est).toBeNull();
  });

  it("excludes low-confidence count guesses from the total", () => {
    const pricedOnly = estimateRecipeCost({
      ingredients: [
        { name: "chicken breast", amount: "400", unit: "g" },
        { name: "basmati rice", amount: "200", unit: "g" },
      ],
      servings: 4,
    });
    const withGuess = estimateRecipeCost({
      ingredients: [
        { name: "chicken breast", amount: "400", unit: "g" },
        { name: "basmati rice", amount: "200", unit: "g" },
        { name: "mystery relish", amount: "2", unit: "" },
      ],
      servings: 4,
    });
    expect(withGuess?.pricedLineCount).toBe(2);
    expect(withGuess?.totalGbp).toBeCloseTo(pricedOnly?.totalGbp ?? 0, 5);
  });
});

describe("formatRecipeCostServingLabel", () => {
  it("formats a range when the spread is wide", () => {
    const label = formatRecipeCostServingLabel({
      totalGbp: 6.4,
      perServingLowGbp: 1.36,
      perServingHighGbp: 2.0,
      servings: 4,
      coverageRatio: 1,
      pricedLineCount: 3,
      totalLineCount: 3,
    });
    expect(label).toMatch(/^≈ £[\d.]+–£[\d.]+ \/ serving$/);
  });

  it("formats a single value when the spread is tight", () => {
    const label = formatRecipeCostServingLabel({
      totalGbp: 3.2,
      perServingLowGbp: 1.55,
      perServingHighGbp: 1.65,
      servings: 2,
      coverageRatio: 1,
      pricedLineCount: 2,
      totalLineCount: 2,
    });
    expect(label).toBe("≈ £1.60 / serving");
  });
});

describe("formatGbp", () => {
  it("always prefixes with £ and keeps two decimals under £10", () => {
    expect(formatGbp(1.6)).toBe("£1.60");
  });
});
