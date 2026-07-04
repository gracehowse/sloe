/**
 * Manual recipe-create matched-alias helpers (ENG-1346).
 *
 * The manual create/edit surfaces (`create-recipe.tsx`, `recipe/verify.tsx`
 * via `AddIngredientSheet` + `verifyRecipe.addUserIngredient`) all carry a
 * matched food id + confidence through to their `recipe_ingredients` insert so
 * a trusted match can seed `matched_alias_key` (ENG-1276). This module is the
 * ONE place that (a) resolves which id field a food-search pick populated and
 * (b) shapes the three matched-alias insert columns — so the gate never drifts
 * across the manual paths the way it was consolidated for the import paths in
 * `matchedAliasPersist.ts`.
 *
 * Pure + sync + dependency-light (delegates gating to `matchedAliasKeyForRow`,
 * which wraps the already-tested `matchedAliasKey()` — it never invents a key
 * and returns `null` for any weak/absent match). No server-only imports, no
 * `@/` aliases, so it is safe on both web and mobile.
 */

import { matchedAliasKeyForRow } from "./matchedAliasPersist";

/** The id-bearing fields a food-search pick may populate (any one source). */
export interface MatchedFoodIdSource {
  fatSecretFoodId?: string | null;
  fdcId?: number | null;
  barcode?: string | null;
  customFoodId?: string | null;
}

/**
 * Resolve the matched food id a search pick carried, in source-priority order
 * (FatSecret → USDA fdcId → OFF barcode → custom food), coercing fdcId to a
 * string. Returns `null` when no source populated an id.
 */
export function resolveMatchedFoodId(src: MatchedFoodIdSource): string | null {
  return (
    src.fatSecretFoodId ??
    (src.fdcId != null ? String(src.fdcId) : null) ??
    src.barcode ??
    src.customFoodId ??
    null
  );
}

/** The three matched-alias columns every manual insert row carries. */
export interface MatchedAliasInsertFields {
  fatsecret_food_id: string | null;
  confidence: number | null;
  matched_alias_key: string | null;
}

/**
 * Shape the matched-alias insert columns for a `recipe_ingredients` row.
 * `matched_alias_key` is seeded only for a trusted match (confidence ≥ 0.85
 * with source + id present) — `matchedAliasKeyForRow` enforces that gate.
 */
export function matchedAliasInsertFields(input: {
  name: string;
  source?: string | null;
  fatSecretFoodId?: string | null;
  confidence?: number | null;
}): MatchedAliasInsertFields {
  return {
    fatsecret_food_id: input.fatSecretFoodId ?? null,
    confidence: input.confidence ?? null,
    matched_alias_key: matchedAliasKeyForRow({
      name: input.name,
      source: input.source,
      fatsecretFoodId: input.fatSecretFoodId,
      confidence: input.confidence,
    }),
  };
}

/** A local create-recipe ingredient row, narrowed to the fields the insert reads. */
export interface ManualIngredientLike {
  name: string;
  amount: string;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  source: string;
  fatSecretFoodId?: string | null;
  confidence?: number | null;
}

/** A `recipe_ingredients` insert row built from a manual create-recipe ingredient. */
export interface ManualIngredientRow extends MatchedAliasInsertFields {
  recipe_id: string;
  name: string;
  amount: number | null;
  unit: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber_g: number;
  is_verified: true;
  source: string;
}

/**
 * Build the `recipe_ingredients` insert rows for a manual create-recipe save,
 * seeding each row's matched-alias columns via `matchedAliasInsertFields`.
 */
export function buildManualIngredientRows(
  ingredients: ManualIngredientLike[],
  recipeId: string,
): ManualIngredientRow[] {
  return ingredients.map((ing) => ({
    recipe_id: recipeId,
    name: ing.name,
    amount: parseFloat(ing.amount) || null,
    unit: ing.unit || null,
    calories: Math.round(ing.calories),
    protein: Math.round(ing.protein),
    carbs: Math.round(ing.carbs),
    fat: Math.round(ing.fat),
    fiber_g: ing.fiberG,
    is_verified: true,
    source: ing.source,
    ...matchedAliasInsertFields({
      name: ing.name,
      source: ing.source,
      fatSecretFoodId: ing.fatSecretFoodId,
      confidence: ing.confidence,
    }),
  }));
}
