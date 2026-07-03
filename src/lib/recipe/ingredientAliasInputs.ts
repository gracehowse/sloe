/**
 * ENG-1276 — build the alias inputs the ingredient-tile fetch + enqueue need
 * from a recipe's ingredient rows. Shared by web (`RecipeDetail.tsx`) and
 * mobile (`recipe/[id].tsx`) so the pairing rule stays identical and the
 * screen files stay thin (screen-budget ratchet).
 *
 * Each ingredient contributes a pairing ONLY when it carries a trusted
 * `matchedAliasKey` (persisted `recipe_ingredients.matched_alias_key`,
 * non-null only when confidence ≥ 0.85). Deduped by canonical tile key.
 *
 * Returns:
 *   - `aliasKeyByCanonicalKey` → the map `fetchIngredientImages` consults for
 *     text-key misses (`{ aliasKeyByCanonicalKey }`).
 *   - `aliasPayload` → the `{ name, aliasKey }[]` the enqueue forwards so the
 *     endpoint records the alias once a tile is ready.
 *
 * Pure + sync + dependency-light (safe on web + mobile via `@suppr/shared`).
 */

import { canonicalImageKey } from "./canonicalImageKey";

export interface IngredientAliasSource {
  name: string;
  /** The persisted trusted alias key ("source:food_id"), or null/absent. */
  matchedAliasKey?: string | null;
}

export interface IngredientAliasInputs {
  aliasKeyByCanonicalKey: Map<string, string>;
  aliasPayload: Array<{ name: string; aliasKey: string }>;
}

export function buildIngredientAliasInputs(
  ingredients: ReadonlyArray<IngredientAliasSource>,
): IngredientAliasInputs {
  const aliasKeyByCanonicalKey = new Map<string, string>();
  const aliasPayload: Array<{ name: string; aliasKey: string }> = [];
  for (const ing of ingredients) {
    const aliasKey = ing.matchedAliasKey;
    if (typeof aliasKey !== "string" || aliasKey.length === 0) continue;
    const key = canonicalImageKey(ing.name);
    if (!key || aliasKeyByCanonicalKey.has(key)) continue;
    aliasKeyByCanonicalKey.set(key, aliasKey);
    aliasPayload.push({ name: ing.name, aliasKey });
  }
  return { aliasKeyByCanonicalKey, aliasPayload };
}

/** Stable signature over `(name, matchedAliasKey)` pairs — an effect dep so a
 *  newly hydrated trusted match re-runs the tile fetch. */
export function ingredientAliasSignature(
  ingredients: ReadonlyArray<IngredientAliasSource>,
): string {
  return ingredients.map((i) => `${i.name}|${i.matchedAliasKey ?? ""}`).join("~");
}
