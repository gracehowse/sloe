/**
 * Primary-serving inference tests.
 *
 * Covers the display primitive behind TestFlight build 9 feedback
 * `APo0qS9vcFvmBJEJJ_-61YA` (2026-04-19): MFP/LoseIt default to the
 * item's natural portion in food search. These tests pin the
 * source-specific rules so a future refactor can't silently drift.
 */
import { describe, it, expect } from "vitest";
import {
  pickEdamamPrimaryServing,
  pickUsdaBrandedPrimaryServing,
  pickUsdaFoodPortionsPrimaryServing,
  parseOffPrimaryServing,
  scalePrimaryServingFromPer100g,
  primaryServingToPortionChip,
} from "@/lib/nutrition/primaryServing";

// Per-100g numbers roughly matching the Pret tuna sandwich screenshot
// from the TestFlight feedback — 211 kcal / 100 g.
const pretPer100g = { calories: 211, protein: 10.3, carbs: 24.1, fat: 7.7 };

describe("scalePrimaryServingFromPer100g", () => {
  it("scales a 100g macro block to 230g correctly (Pret tuna sandwich)", () => {
    const ps = scalePrimaryServingFromPer100g(pretPer100g, "1 sandwich", 230);
    expect(ps).not.toBeNull();
    // 211 × 2.3 = 485.3 → round to 485
    expect(ps!.kcal).toBe(485);
    // 10.3 × 2.3 = 23.69 → round to 1dp: 23.7
    expect(ps!.protein).toBe(23.7);
    // 24.1 × 2.3 = 55.43 → 55.4
    expect(ps!.carbs).toBe(55.4);
    // 7.7 × 2.3 = 17.71 → 17.7
    expect(ps!.fat).toBe(17.7);
    expect(ps!.grams).toBe(230);
    expect(ps!.label).toBe("1 sandwich");
  });

  it("returns null for 0 or negative grams", () => {
    expect(scalePrimaryServingFromPer100g(pretPer100g, "foo", 0)).toBeNull();
    expect(scalePrimaryServingFromPer100g(pretPer100g, "foo", -5)).toBeNull();
    expect(scalePrimaryServingFromPer100g(pretPer100g, "foo", NaN)).toBeNull();
  });
});

describe("pickEdamamPrimaryServing", () => {
  it("picks the non-Gram serving when both are present (real Pret shape)", () => {
    const ps = pickEdamamPrimaryServing(pretPer100g, [
      { uri: "http://example/serving", label: "Serving", quantity: 230 },
      { uri: "http://example/gram", label: "Gram", quantity: 1 },
    ]);
    expect(ps).not.toBeNull();
    expect(ps!.label).toBe("1 serving");
    expect(ps!.grams).toBe(230);
    expect(ps!.kcal).toBe(485);
  });

  it("picks a labelled portion like 'Sandwich'", () => {
    const ps = pickEdamamPrimaryServing(pretPer100g, [
      { uri: "x", label: "Sandwich", quantity: 230 },
    ]);
    expect(ps).not.toBeNull();
    expect(ps!.label).toBe("1 sandwich");
    expect(ps!.grams).toBe(230);
  });

  it("returns null when only a Gram serving is exposed", () => {
    const ps = pickEdamamPrimaryServing(pretPer100g, [
      { uri: "x", label: "Gram", quantity: 1 },
    ]);
    expect(ps).toBeNull();
  });

  it("returns null for an empty array", () => {
    expect(pickEdamamPrimaryServing(pretPer100g, [])).toBeNull();
    expect(pickEdamamPrimaryServing(pretPer100g, null)).toBeNull();
    expect(pickEdamamPrimaryServing(pretPer100g, undefined)).toBeNull();
  });

  it("skips rows with missing or non-positive quantity", () => {
    const ps = pickEdamamPrimaryServing(pretPer100g, [
      { label: "Serving", quantity: 0 },
      { label: "Sandwich", quantity: 230 },
    ]);
    expect(ps).not.toBeNull();
    expect(ps!.label).toBe("1 sandwich");
  });
});

describe("pickUsdaBrandedPrimaryServing", () => {
  it("scales a branded 230g serving with household label", () => {
    const ps = pickUsdaBrandedPrimaryServing(pretPer100g, {
      servingSize: 230,
      servingSizeUnit: "g",
      householdServingFullText: "1 SANDWICH",
    });
    expect(ps).not.toBeNull();
    expect(ps!.label).toBe("1 sandwich");
    expect(ps!.grams).toBe(230);
    expect(ps!.kcal).toBe(485);
  });

  it("falls back to '1 serving' when householdServingFullText is missing", () => {
    const ps = pickUsdaBrandedPrimaryServing(pretPer100g, {
      servingSize: 30,
      servingSizeUnit: "g",
      householdServingFullText: null,
    });
    expect(ps).not.toBeNull();
    expect(ps!.label).toBe("1 serving");
    expect(ps!.grams).toBe(30);
  });

  it("accepts GRM and ml units (case-insensitive) as mass-equivalent", () => {
    expect(
      pickUsdaBrandedPrimaryServing(pretPer100g, {
        servingSize: 30,
        servingSizeUnit: "GRM",
      })?.grams,
    ).toBe(30);
    expect(
      pickUsdaBrandedPrimaryServing(pretPer100g, {
        servingSize: 250,
        servingSizeUnit: "ml",
      })?.grams,
    ).toBe(250);
  });

  it("returns null for a non-mass unit like 'piece'", () => {
    expect(
      pickUsdaBrandedPrimaryServing(pretPer100g, {
        servingSize: 1,
        servingSizeUnit: "piece",
      }),
    ).toBeNull();
  });

  it("returns null when servingSize is missing or non-positive", () => {
    expect(pickUsdaBrandedPrimaryServing(pretPer100g, { servingSizeUnit: "g" })).toBeNull();
    expect(pickUsdaBrandedPrimaryServing(pretPer100g, { servingSize: 0, servingSizeUnit: "g" })).toBeNull();
    expect(pickUsdaBrandedPrimaryServing(pretPer100g, null)).toBeNull();
  });
});

describe("pickUsdaFoodPortionsPrimaryServing", () => {
  it("picks the first non-placeholder portion", () => {
    const ps = pickUsdaFoodPortionsPrimaryServing(pretPer100g, [
      { gramWeight: 1, portionDescription: "Quantity not specified" },
      { gramWeight: 120, portionDescription: "1 cup, sliced" },
    ]);
    expect(ps).not.toBeNull();
    expect(ps!.grams).toBe(120);
    expect(ps!.label).toBe("1 cup, sliced");
  });

  it("skips the '1 g' placeholder modifier", () => {
    const ps = pickUsdaFoodPortionsPrimaryServing(pretPer100g, [
      { gramWeight: 1, modifier: "1 g" },
      { gramWeight: 85, portionDescription: "1 slice" },
    ]);
    expect(ps).not.toBeNull();
    expect(ps!.grams).toBe(85);
  });

  it("builds a label from amount + unit + modifier when portionDescription is absent", () => {
    const ps = pickUsdaFoodPortionsPrimaryServing(pretPer100g, [
      {
        gramWeight: 50,
        amount: 2,
        modifier: "small",
        measureUnit: { name: "tbsp" },
      },
    ]);
    expect(ps).not.toBeNull();
    // Normalised to lowercase.
    expect(ps!.label).toBe("2 tbsp small");
  });

  it("returns null when every portion is a placeholder", () => {
    expect(
      pickUsdaFoodPortionsPrimaryServing(pretPer100g, [
        { gramWeight: 1, portionDescription: "Quantity not specified" },
        { gramWeight: 1, modifier: "1 g" },
      ]),
    ).toBeNull();
  });

  it("returns null for empty / missing portions array", () => {
    expect(pickUsdaFoodPortionsPrimaryServing(pretPer100g, null)).toBeNull();
    expect(pickUsdaFoodPortionsPrimaryServing(pretPer100g, [])).toBeNull();
  });
});

describe("parseOffPrimaryServing", () => {
  it("parses '1 slice (28 g)' → 28g with 'slice' label", () => {
    const ps = parseOffPrimaryServing(pretPer100g, "1 slice (28 g)");
    expect(ps).not.toBeNull();
    expect(ps!.grams).toBe(28);
    expect(ps!.label).toBe("1 slice");
  });

  it("parses bare '28 g' → 28g with '1 serving' label", () => {
    const ps = parseOffPrimaryServing(pretPer100g, "28 g");
    expect(ps).not.toBeNull();
    expect(ps!.grams).toBe(28);
    expect(ps!.label).toBe("1 serving");
  });

  it("parses '250 ml' as a mass-equivalent 250g", () => {
    const ps = parseOffPrimaryServing(pretPer100g, "250 ml");
    expect(ps).not.toBeNull();
    expect(ps!.grams).toBe(250);
  });

  it("returns null for '1 piece' without a gram weight (no guessing)", () => {
    expect(parseOffPrimaryServing(pretPer100g, "1 piece")).toBeNull();
  });

  it("returns null for empty / null / non-string input", () => {
    expect(parseOffPrimaryServing(pretPer100g, null)).toBeNull();
    expect(parseOffPrimaryServing(pretPer100g, undefined)).toBeNull();
    expect(parseOffPrimaryServing(pretPer100g, "")).toBeNull();
    expect(parseOffPrimaryServing(pretPer100g, "   ")).toBeNull();
  });
});

describe("primaryServingToPortionChip", () => {
  it("maps a PrimaryServing to the FoodPortion chip shape", () => {
    const ps = scalePrimaryServingFromPer100g(pretPer100g, "1 sandwich", 230)!;
    const chip = primaryServingToPortionChip(ps);
    expect(chip.label).toBe("1 sandwich");
    expect(chip.gramWeight).toBe(230);
    expect(chip.amount).toBe(1);
  });
});
