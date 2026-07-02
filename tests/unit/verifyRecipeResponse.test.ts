import { describe, expect, it } from "vitest";
import {
  flatMacroRowsFromVerifyJson,
  isVerifiedFromVerifyRow,
  perServingFromVerifyJson,
  verifyJsonNeedsReview,
} from "../../src/lib/nutrition/verifyRecipeResponse";
import { MIN_ACCEPT_CONFIDENCE } from "../../src/lib/nutrition/verifyConfidencePolicy";

describe("verifyRecipeResponse", () => {
  it("maps canonical verify API verified[] + macros", () => {
    const json = {
      ok: true,
      verified: [
        {
          input: { name: "x", amount: "1", unit: "cup" },
          resolved: { name: "x", amount: "1", unit: "cup" },
          fatSecretFoodId: null,
          matchedName: "Chicken",
          confidence: 0.82,
          source: "USDA",
          macros: { calories: 200, protein: 40, carbs: 0, fat: 4, fiberG: 0, sugarG: 0, sodiumMg: 100 },
        },
      ],
      totals: { calories: 200, protein: 40, carbs: 0, fat: 4, fiberG: 0, sugarG: 0, sodiumMg: 100 },
      perServing: { calories: 100, protein: 20, carbs: 0, fat: 2, fiberG: 0, sugarG: 0, sodiumMg: 50 },
      primarySource: "USDA",
      sourceCounts: { USDA: 1 },
      minIngredientConfidence: 0.82,
      avgIngredientConfidence: 0.82,
    };

    const rows = flatMacroRowsFromVerifyJson(json as Record<string, unknown>);
    expect(rows).toHaveLength(1);
    expect(rows![0]).toMatchObject({
      calories: 200,
      protein: 40,
      source: "USDA",
      confidence: 0.82,
    });
    const ps = perServingFromVerifyJson(json as Record<string, unknown>);
    expect(ps?.calories).toBe(100);
  });

  it("prefers verified[] over stale ingredientRows when both exist", () => {
    const json = {
      ok: true,
      ingredientRows: [{ calories: 0, protein: 0, carbs: 0, fat: 0, source: "bad", confidence: 0 }],
      verified: [
        {
          confidence: 0.9,
          source: "USDA",
          macros: { calories: 50, protein: 5, carbs: 0, fat: 1, fiberG: 0, sugarG: 0, sodiumMg: 0 },
        },
      ],
      totals: { calories: 50, protein: 5, carbs: 0, fat: 1, fiberG: 0, sugarG: 0, sodiumMg: 0 },
      perServing: { calories: 50, protein: 5, carbs: 0, fat: 1, fiberG: 0, sugarG: 0, sodiumMg: 0 },
    };
    const rows = flatMacroRowsFromVerifyJson(json as Record<string, unknown>);
    expect(rows).toHaveLength(1);
    expect(rows![0]!.calories).toBe(50);
    expect(rows![0]!.source).toBe("USDA");
  });

  it("coerces string perServing.calories from JSON", () => {
    const json = {
      ok: true,
      perServing: { calories: "120", protein: "10", carbs: "0", fat: "4", fiberG: "0", sugarG: "0", sodiumMg: "0" },
    };
    const ps = perServingFromVerifyJson(json as Record<string, unknown>);
    expect(ps?.calories).toBe(120);
    expect(ps?.protein).toBe(10);
  });

  it("derives perServing from totals when perServing is missing", () => {
    const json = {
      ok: true,
      verified: [
        {
          confidence: 0.9,
          source: "USDA",
          macros: { calories: 400, protein: 10, carbs: 20, fat: 5, fiberG: 1, sugarG: 0, sodiumMg: 50 },
        },
      ],
      totals: { calories: 400, protein: 10, carbs: 20, fat: 5, fiberG: 1, sugarG: 0, sodiumMg: 50 },
    };
    const ps = perServingFromVerifyJson(json as Record<string, unknown>, { servings: 4 });
    expect(ps?.calories).toBe(100);
    expect(ps?.protein).toBe(2.5);
  });
});

describe("isVerifiedFromVerifyRow — trust label reads the shared accept floor (ENG-1305)", () => {
  it("labels a structured row at/above the accept floor as verified", () => {
    expect(isVerifiedFromVerifyRow(MIN_ACCEPT_CONFIDENCE, "USDA")).toBe(true);
    expect(isVerifiedFromVerifyRow(0.9, "OFF")).toBe(true);
    expect(isVerifiedFromVerifyRow(0.72, "FatSecret")).toBe(true);
  });

  it("never labels a row below the accept floor as verified (0.50–0.55 sliver closed)", () => {
    // Pre-ENG-1305 this bar was a hand-typed 0.5 — rows the pipeline
    // would EXCLUDE from recipe totals (< 0.55) still got the "verified"
    // trust label. Tightening only removes labels: trust-safe.
    expect(isVerifiedFromVerifyRow(0.5, "USDA")).toBe(false);
    expect(isVerifiedFromVerifyRow(0.54, "USDA")).toBe(false);
    expect(isVerifiedFromVerifyRow(MIN_ACCEPT_CONFIDENCE - 0.001, "OFF")).toBe(false);
  });

  it("never labels non-structured sources as verified, regardless of confidence", () => {
    expect(isVerifiedFromVerifyRow(0.99, "Estimated")).toBe(false);
    expect(isVerifiedFromVerifyRow(0.99, "Manual")).toBe(false);
    expect(isVerifiedFromVerifyRow(0.99, "")).toBe(false);
  });

  it("rejects non-finite confidence", () => {
    expect(isVerifiedFromVerifyRow(Number.NaN, "USDA")).toBe(false);
  });
});

describe("verifyJsonNeedsReview — response-level review nudge (ENG-1305)", () => {
  it("no nudge for a clean high-confidence response", () => {
    expect(
      verifyJsonNeedsReview({
        avgIngredientConfidence: 0.9,
        minIngredientConfidence: 0.8,
        belowAcceptFloorCount: 0,
      }),
    ).toBe(false);
  });

  it("nudges when rows were excluded below the accept floor, even with pristine stats", () => {
    // Stats describe only accepted rows since ENG-1305 — the count is how
    // excluded rows keep forcing the review prompt.
    expect(
      verifyJsonNeedsReview({
        avgIngredientConfidence: 0.95,
        minIngredientConfidence: 0.9,
        belowAcceptFloorCount: 1,
      }),
    ).toBe(true);
  });

  it("nudges on low stats (mean below the review bar)", () => {
    expect(
      verifyJsonNeedsReview({
        avgIngredientConfidence: 0.46,
        minIngredientConfidence: 0.46,
        belowAcceptFloorCount: 0,
      }),
    ).toBe(true);
  });

  it("tolerates missing fields and non-object input", () => {
    expect(verifyJsonNeedsReview({})).toBe(false);
    expect(verifyJsonNeedsReview(null)).toBe(false);
    expect(verifyJsonNeedsReview(undefined)).toBe(false);
    expect(verifyJsonNeedsReview({ belowAcceptFloorCount: 2 })).toBe(true);
  });
});
