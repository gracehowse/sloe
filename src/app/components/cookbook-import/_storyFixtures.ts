import type { PlanImportVerifiedRecipe } from "@/lib/planning/planImport/types";

export function storyCookbookRecipe(
  key: string,
  title: string,
  overrides: Partial<PlanImportVerifiedRecipe> = {},
): PlanImportVerifiedRecipe {
  return {
    key,
    title,
    serves: 4,
    ingredients: ["2 tbsp olive oil", "400 g salmon fillet", "1 lemon"],
    supprNutrition: { calories: 420, protein: 38, carbs: 6, fat: 26, fiberG: 1 },
    authorNutrition: { calories: 390, protein: 36, carbs: 8, fat: 22, fiberG: 1 },
    confidence: "high",
    confidenceTier: "high",
    ingredientCount: 3,
    ...overrides,
  };
}

export const STORY_COOKBOOK_RECIPES: PlanImportVerifiedRecipe[] = [
  storyCookbookRecipe("r1", "Miso-glazed salmon"),
  storyCookbookRecipe("r2", "Charred broccoli with tahini", {
    supprNutrition: { calories: 180, protein: 8, carbs: 14, fat: 12, fiberG: 6 },
    authorNutrition: { calories: 165, protein: 7, carbs: 12, fat: 11, fiberG: 5 },
    confidence: "medium",
    confidenceTier: "medium",
  }),
  storyCookbookRecipe("r3", "Chickpea shakshuka", {
    supprNutrition: { calories: 310, protein: 16, carbs: 38, fat: 10, fiberG: 9 },
    confidence: "high",
  }),
];
