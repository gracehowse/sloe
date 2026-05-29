/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/nutrition/verifyIngredients", () => ({
  verifyIngredients: vi.fn(),
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
      verified: [],
    });
    const result = await verifyImportRecipe(parsedRecipe);
    expect(result.confidence).toBe("low");
    expect(result.confidenceTier).toBe("low");
  });
});
