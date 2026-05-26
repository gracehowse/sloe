import { verifyIngredients } from "../../nutrition/verifyIngredients";
import { ingredientRowsFromRecipe } from "./compilePlanImport";
import type {
  PlanImportConfidence,
  PlanImportParsedRecipe,
  PlanImportVerifiedRecipe,
} from "./types";

function confidenceFromTier(tier: string): PlanImportConfidence {
  if (tier === "high") return "high";
  if (tier === "medium") return "medium";
  return "low";
}

/** Verify one parsed import recipe against Suppr foods (shared by plan + cookbook import). */
export async function verifyImportRecipe(
  recipe: PlanImportParsedRecipe,
): Promise<PlanImportVerifiedRecipe> {
  const rows = ingredientRowsFromRecipe(recipe);
  if (rows.length === 0) {
    const author = recipe.authorNutrition;
    return {
      ...recipe,
      supprNutrition: {
        calories: Math.round(author?.calories ?? 0),
        protein: author?.protein ?? 0,
        carbs: author?.carbs ?? 0,
        fat: author?.fat ?? 0,
        fiberG: author?.fiberG ?? 0,
      },
      confidence: "low",
      confidenceTier: "low",
      ingredientCount: 0,
    };
  }
  const result = await verifyIngredients({
    ingredients: rows,
    servings: recipe.serves,
    provider: "auto",
  });
  const tier =
    result.avgIngredientConfidence >= 0.75
      ? "high"
      : result.avgIngredientConfidence >= 0.5
        ? "medium"
        : "low";
  const ingredientMacros = result.verified.map((v) => ({
    name: v.input.name,
    amount: v.input.amount,
    unit: v.input.unit,
    calories: Math.round(v.macros?.calories ?? 0),
    protein: Math.round((v.macros?.protein ?? 0) * 10) / 10,
    carbs: Math.round((v.macros?.carbs ?? 0) * 10) / 10,
    fat: Math.round((v.macros?.fat ?? 0) * 10) / 10,
    fiberG: Math.round((v.macros?.fiberG ?? 0) * 10) / 10,
    source: v.source,
    confidence: v.confidence,
  }));
  return {
    ...recipe,
    supprNutrition: {
      calories: Math.round(result.perServing.calories),
      protein: Math.round(result.perServing.protein * 10) / 10,
      carbs: Math.round(result.perServing.carbs * 10) / 10,
      fat: Math.round(result.perServing.fat * 10) / 10,
      fiberG: Math.round((result.perServing.fiberG ?? 0) * 10) / 10,
    },
    confidence: confidenceFromTier(tier),
    confidenceTier: confidenceFromTier(tier),
    ingredientCount: rows.length,
    ingredientMacros,
  };
}
