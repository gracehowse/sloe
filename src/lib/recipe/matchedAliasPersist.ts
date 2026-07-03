/**
 * `matched_alias_key` persistence helper (ENG-1276).
 *
 * The `ingredient_images` grouping key is `canonicalImageKey(name)` — a TEXT
 * spine. Two differently-spelled names that matched the SAME food can still
 * derive different text keys and miss the shared tile. To make a trusted
 * match's identity durable, every `recipe_ingredients` insert path records
 * `matchedAliasKey({name, matchedSource, matchedFoodId, confidence})` on the
 * new `recipe_ingredients.matched_alias_key` column when the match is trusted
 * (confidence ≥ 0.85 and both source + food id present), else `null`.
 *
 * This is the SINGLE place every insert path computes that value, so the
 * gate never drifts across `persistImportedRecipe.ts`, the plan-import
 * pipelines, and `RecipeUpload.tsx`. Purely a wrapper around the already-
 * tested `matchedAliasKey()` from `canonicalImageKey.ts` — it never invents
 * a key, and returns `null` for any weak/absent match (CLAUDE.md: reject
 * low-confidence collapses).
 *
 * Pure + sync + dependency-light (no server-only imports, no `@/` aliases)
 * so it is safe on both web and mobile.
 */

import { matchedAliasKey } from "./canonicalImageKey";

/** The three match fields a `recipe_ingredients` row carries (column names
 *  mirror the table: `source`, `fatsecret_food_id`, `confidence`). */
export interface MatchedAliasRowInput {
  /** Raw `recipe_ingredients.name`. */
  name: string;
  /** `recipe_ingredients.source` (e.g. "FatSecret", "USDA", "OFF", "Edamam"). */
  source?: string | null;
  /** `recipe_ingredients.fatsecret_food_id` — the matched food id (any source). */
  fatsecretFoodId?: string | null;
  /** `recipe_ingredients.confidence` (0–1). */
  confidence?: number | null;
}

/**
 * Compute the value to write to `recipe_ingredients.matched_alias_key` for a
 * row: `"source:food_id"` (lowercased) when the match is trusted
 * (confidence ≥ MATCHED_ALIAS_MIN_CONFIDENCE and both parts present), else
 * `null`. Delegates the gating to `matchedAliasKey()` so the rule lives in
 * exactly one place.
 */
export function matchedAliasKeyForRow(input: MatchedAliasRowInput): string | null {
  return matchedAliasKey({
    name: input.name,
    matchedSource: input.source ?? null,
    matchedFoodId: input.fatsecretFoodId ?? null,
    confidence: input.confidence ?? null,
  });
}
