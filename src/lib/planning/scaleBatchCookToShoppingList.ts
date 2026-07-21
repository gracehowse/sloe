// Extensionless relative imports — mobile-safe (Metro + the mobile tsconfig,
// which rejects `.ts` import paths).
//
// ENG-1600 — shared persistence for batch-cook's "scale to shopping" action.
// Both web (`MealPlanner.tsx` `scaleBatchCookToShopping`) and mobile
// (`batch-cook.tsx` `scaleToShopping`) previously wrote the scaled
// ingredients through `upsertShoppingListJsonItems`, which persists to the
// legacy `shopping_lists`/`shopping_lists_legacy` JSON-blob table — a table
// no live Shopping screen reads once the relational `shopping_items` table
// exists (see `docs/journeys/shopping-list.md` "Known bug" section for the
// full trace). Items added via batch-cook silently never appeared on mobile
// and vanished on web reload.
//
// This routes both platforms through the SAME `appendRecipeToShoppingListClient`
// (ENG-943) the single-recipe "Add to shopping list" action already uses, so
// batch-cook's scaled ingredients land in `shopping_items` and persist like
// every other shopping-list write — merge + write semantics identical by
// construction, same pattern as ENG-943 and ENG-1527's shared modules.
import {
  appendRecipeToShoppingListClient,
  type AppendRecipeClientResult,
} from "./appendRecipeToShoppingListClient";
import type { RecipeIngredientLine } from "./appendRecipeToShoppingList";
import { batchShoppingMultiplier } from "./batchCook";
import { filterShoppingItemsByPantry } from "./pantryStaples";
import type { ShoppingScope } from "../household/shoppingScope";

/** Minimal client shape — re-uses whatever `appendRecipeToShoppingListClient` accepts. */
type ScaleBatchCookClient = Parameters<typeof appendRecipeToShoppingListClient>[0]["client"];

export type ScaleBatchCookToShoppingResult =
  | AppendRecipeClientResult
  | { ok: false; error: string };

/**
 * Scale a batch-cook recipe's ingredient lines to `portions` and persist the
 * delta into `shopping_items` for the given scope (solo or household).
 *
 * - Ingredients matching a pantry staple (`pantryStaples`, word-boundary
 *   match) are excluded before persisting — the batch-cook flow has always
 *   suppressed staples from the scaled list; this preserves that behaviour.
 * - The remaining lines are scaled by `batchShoppingMultiplier(portions,
 *   recipeServings)` and merged via `appendRecipeToShoppingListClient` — the
 *   same silent-dedup + count-to-weight-at-high-confidence-only aggregation
 *   Step 3's single-recipe add uses, persisting only the delta (INSERT new
 *   rows / UPDATE changed quantities, preserving `checked` on existing rows).
 */
export async function scaleBatchCookToShoppingList(input: {
  client: ScaleBatchCookClient;
  scope: ShoppingScope;
  recipeTitle: string;
  recipeServings: number;
  portions: number;
  ingredients: readonly RecipeIngredientLine[];
  pantryStaples: readonly string[];
}): Promise<ScaleBatchCookToShoppingResult> {
  const lines = filterShoppingItemsByPantry(input.ingredients, input.pantryStaples);
  if (lines.length === 0) {
    return {
      ok: false,
      error: "Every ingredient in this recipe is already a pantry staple.",
    };
  }

  const multiplier = batchShoppingMultiplier(input.portions, input.recipeServings);

  return appendRecipeToShoppingListClient({
    client: input.client,
    scope: input.scope,
    recipeTitle: input.recipeTitle,
    ingredients: lines,
    multiplier,
  });
}
