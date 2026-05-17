/**
 * Mobile re-export of the shared recipe-trust helpers.
 * Mirrors `src/lib/nutrition/recipeTrust.ts`.
 */
export {
  mapToTrustVariant,
  aggregateRecipeTrust,
  recipeLevelTrust,
  classifyRecipeGluten,
  type RecipeTrustInput,
  type RecipeGlutenResult,
} from "@suppr/shared/nutrition/recipeTrust";

export {
  classifyIngredientGluten,
  type GlutenStatus,
  type GlutenConfidence,
  type GlutenClassification,
} from "@suppr/shared/nutrition/glutenClassifier";
