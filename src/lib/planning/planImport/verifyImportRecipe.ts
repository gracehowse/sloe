import { acceptedLineCount, verifyIngredients } from "../../nutrition/verifyIngredients";
import { recipeConfidenceTierWithExclusions } from "../../nutrition/verifyConfidencePolicy";
import { ingredientRowsFromRecipe } from "./compilePlanImport";
import type {
  PlanImportParsedRecipe,
  PlanImportVerifiedRecipe,
} from "./types";

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
      excludedLineCount: 0,
    };
  }
  const result = await verifyIngredients({
    ingredients: rows,
    servings: recipe.serves,
    provider: "auto",
  });
  // ENG-1422 — cap the displayed tier on excluded lines so a more incomplete
  // recipe can't read at a higher confidence than a fully-matched one.
  //
  // "Excluded" here must mean every row NOT summed into `totals`/`perServing`
  // — that's two row classes, not one: below-accept-floor rows (macros !=
  // null, confidence too low) AND no-match rows (macros === null, e.g. an
  // unparseable line or an estimator that couldn't resolve a weight — see
  // verifyIngredients.ts's `belowAcceptFloor` assignment comment). Using
  // `result.belowAcceptFloorCount` alone undercounts: a recipe whose lines are
  // mostly no-match (not merely low-confidence) would report zero excluded
  // lines and cap nothing, reproducing the exact inverted-trust-signal bug
  // this cap exists to close. `acceptedLineCount` already excludes both
  // classes from "accepted" (see its own doc comment), so the true excluded
  // count is simply the complement against the full verified row set.
  const excludedLineCount = result.verified.length - acceptedLineCount(result);
  const tier = recipeConfidenceTierWithExclusions(
    result.avgIngredientConfidence,
    excludedLineCount,
    acceptedLineCount(result),
  );
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
    confidence: tier,
    confidenceTier: tier,
    ingredientCount: rows.length,
    excludedLineCount,
    ingredientMacros,
  };
}
