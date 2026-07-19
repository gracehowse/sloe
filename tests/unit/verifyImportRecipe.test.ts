/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/nutrition/verifyIngredients", () => ({
  verifyIngredients: vi.fn(),
  // Real pure impl — the tier cap counts accepted rows off the mock `verified`.
  acceptedLineCount: (result: { verified: Array<{ macros?: unknown; belowAcceptFloor?: boolean }> }) =>
    result.verified.filter((v) => v.macros != null && !v.belowAcceptFloor).length,
}));

import { verifyIngredients } from "@/lib/nutrition/verifyIngredients";
import { verifyImportRecipe } from "@/lib/planning/planImport/verifyImportRecipe";
import type { PlanImportParsedRecipe } from "@/lib/planning/planImport/types";

const mockVerifyIngredients = verifyIngredients as ReturnType<typeof vi.fn>;

const parsedRecipe: PlanImportParsedRecipe = {
  key: "bowl",
  title: "Power Bowl",
  serves: 2,
  ingredients: ["100 g rice", "150 g chicken breast"],
  method: "Mix and serve.",
  authorNutrition: { calories: 420, protein: 32, carbs: 40, fat: 12, fiberG: 4 },
};

describe("verifyImportRecipe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to author nutrition with low confidence when there are no ingredients", async () => {
    const result = await verifyImportRecipe({
      ...parsedRecipe,
      ingredients: [],
    });
    expect(mockVerifyIngredients).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      confidence: "low",
      confidenceTier: "low",
      ingredientCount: 0,
      excludedLineCount: 0,
      supprNutrition: {
        calories: 420,
        protein: 32,
        carbs: 40,
        fat: 12,
        fiberG: 4,
      },
    });
  });

  it("maps high confidence when average ingredient confidence is at least 0.75", async () => {
    mockVerifyIngredients.mockResolvedValue({
      avgIngredientConfidence: 0.82,
      perServing: { calories: 401.2, protein: 30.44, carbs: 38.1, fat: 11.2, fiberG: 3.4 },
      verified: [
        {
          input: { name: "rice", amount: "100", unit: "g" },
          macros: { calories: 130, protein: 3, carbs: 28, fat: 0, fiberG: 1 },
          source: "usda",
          confidence: 0.9,
        },
      ],
    });
    const result = await verifyImportRecipe(parsedRecipe);
    expect(mockVerifyIngredients).toHaveBeenCalledWith({
      ingredients: expect.arrayContaining([
        expect.objectContaining({ name: expect.any(String) }),
      ]),
      servings: 2,
      provider: "auto",
    });
    expect(result.confidence).toBe("high");
    expect(result.confidenceTier).toBe("high");
    expect(result.ingredientCount).toBe(2);
    expect(result.supprNutrition).toEqual({
      calories: 401,
      protein: 30.4,
      carbs: 38.1,
      fat: 11.2,
      fiberG: 3.4,
    });
    expect(result.ingredientMacros?.[0]).toMatchObject({
      name: "rice",
      calories: 130,
      source: "usda",
      confidence: 0.9,
    });
  });

  it("maps medium confidence between 0.5 and 0.75", async () => {
    mockVerifyIngredients.mockResolvedValue({
      avgIngredientConfidence: 0.62,
      perServing: { calories: 300, protein: 20, carbs: 25, fat: 10, fiberG: 2 },
      verified: [],
    });
    const result = await verifyImportRecipe(parsedRecipe);
    expect(result.confidence).toBe("medium");
    expect(result.confidenceTier).toBe("medium");
  });

  it("maps low confidence below 0.5", async () => {
    mockVerifyIngredients.mockResolvedValue({
      avgIngredientConfidence: 0.31,
      perServing: { calories: 250, protein: 15, carbs: 20, fat: 9, fiberG: 1 },
      belowAcceptFloorCount: 0,
      verified: [],
    });
    const result = await verifyImportRecipe(parsedRecipe);
    expect(result.confidence).toBe("low");
    expect(result.confidenceTier).toBe("low");
    expect(result.excludedLineCount).toBe(0);
  });

  it("ENG-1422 — caps a high accepted-average to medium when lines were excluded, and reports the count", async () => {
    // 3 accepted rows at high confidence + 2 rows dropped below the accept floor.
    // Raw tier off the accepted-only average (0.9) would be "high"; the cap must
    // pull it to "medium" and surface excludedLineCount = 2.
    mockVerifyIngredients.mockResolvedValue({
      avgIngredientConfidence: 0.9,
      perServing: { calories: 400, protein: 30, carbs: 38, fat: 11, fiberG: 3 },
      belowAcceptFloorCount: 2,
      verified: [
        { input: { name: "rice", amount: "100", unit: "g" }, macros: { calories: 130 }, source: "USDA", confidence: 0.9 },
        { input: { name: "chicken", amount: "150", unit: "g" }, macros: { calories: 250 }, source: "USDA", confidence: 0.9 },
        { input: { name: "spinach", amount: "50", unit: "g" }, macros: { calories: 12 }, source: "USDA", confidence: 0.9 },
        { input: { name: "mystery sauce", amount: "1", unit: "" }, macros: { calories: 40 }, source: "OFF", confidence: 0.4, belowAcceptFloor: true },
        { input: { name: "garnish", amount: "1", unit: "" }, macros: { calories: 5 }, source: "OFF", confidence: 0.42, belowAcceptFloor: true },
      ],
    });
    const result = await verifyImportRecipe(parsedRecipe);
    expect(result.confidence).toBe("medium");
    expect(result.confidenceTier).toBe("medium");
    expect(result.excludedLineCount).toBe(2);
  });

  it("ENG-1422 — counts no-match rows (null macros) as excluded, not just below-floor rows", async () => {
    // 2 accepted rows + 2 no-match rows (macros: null — an unparseable line or
    // an estimator that couldn't resolve a weight). belowAcceptFloorCount is 0
    // because neither excluded row has a confidence score to fall below the
    // floor with — but they're still absent from `totals`, so the cap must
    // still see them as excluded. Regression test for the bug where
    // excludedLineCount was read straight off belowAcceptFloorCount and missed
    // this row class entirely, letting a half-unmatched recipe report zero
    // exclusions and keep its uncapped "high" tier.
    mockVerifyIngredients.mockResolvedValue({
      avgIngredientConfidence: 0.95,
      perServing: { calories: 230, protein: 15, carbs: 20, fat: 5, fiberG: 1 },
      belowAcceptFloorCount: 0,
      verified: [
        { input: { name: "rice", amount: "100", unit: "g" }, macros: { calories: 130 }, source: "USDA", confidence: 0.95 },
        { input: { name: "chicken", amount: "150", unit: "g" }, macros: { calories: 100 }, source: "USDA", confidence: 0.95 },
        { input: { name: "??? sauce", amount: "", unit: "" }, macros: null, source: "Unverified", confidence: 0 },
        { input: { name: "garnish, to taste", amount: "", unit: "" }, macros: null, source: "Unverified", confidence: 0 },
      ],
    });
    const result = await verifyImportRecipe(parsedRecipe);
    expect(result.excludedLineCount).toBe(2);
    // Half the recipe unmatched → capped to "low" despite a 0.95 accepted average.
    expect(result.confidence).toBe("low");
    expect(result.confidenceTier).toBe("low");
  });

  it("ENG-1422 — drops to low when half or more of the recipe was excluded", async () => {
    // 2 accepted + 3 excluded → majority unmatched → low despite a pristine average.
    mockVerifyIngredients.mockResolvedValue({
      avgIngredientConfidence: 0.95,
      perServing: { calories: 300, protein: 20, carbs: 25, fat: 10, fiberG: 2 },
      belowAcceptFloorCount: 3,
      verified: [
        { input: { name: "a", amount: "1", unit: "g" }, macros: { calories: 100 }, source: "USDA", confidence: 0.95 },
        { input: { name: "b", amount: "1", unit: "g" }, macros: { calories: 100 }, source: "USDA", confidence: 0.95 },
        { input: { name: "c", amount: "1", unit: "" }, macros: { calories: 10 }, source: "OFF", confidence: 0.4, belowAcceptFloor: true },
        { input: { name: "d", amount: "1", unit: "" }, macros: { calories: 10 }, source: "OFF", confidence: 0.4, belowAcceptFloor: true },
        { input: { name: "e", amount: "1", unit: "" }, macros: { calories: 10 }, source: "OFF", confidence: 0.4, belowAcceptFloor: true },
      ],
    });
    const result = await verifyImportRecipe(parsedRecipe);
    expect(result.confidence).toBe("low");
    expect(result.confidenceTier).toBe("low");
    expect(result.excludedLineCount).toBe(3);
  });
});
