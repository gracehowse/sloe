// Extensionless relative imports — mobile-safe (Metro + the mobile tsconfig).
// ENG-957 — the pure engine that keeps the shopping list in sync as the PLAN is
// edited (add / remove / swap a meal), reusing ENG-943's aggregator for the add
// side and the ENG-957 remover for the removal side. Edit-driven re-sync, NOT a
// full delete-and-replace: an add appends+merges (preserving checked rows), a
// remove decrements only the outgoing recipe's contribution, a swap does both
// around one read. Web (MealPlanner via AppDataContext) and mobile (planner.tsx)
// share this — no divergent reimplementation.
import type { ShoppingItem } from "../../types/recipe";
import {
  appendRecipeToShoppingList,
  type RecipeIngredientLine,
} from "./appendRecipeToShoppingList";
import { removeRecipeFromShoppingList } from "./removeRecipeFromShoppingList";

/** One planned recipe's identity + scaled ingredient lines for a sync. */
export type PlanSyncRecipe = {
  /** Recipe title — also the provenance token written into `shopping_items.source`. */
  title: string;
  /** Pre-fetched, pre-normalised ingredient lines for the recipe. */
  ingredients: readonly RecipeIngredientLine[];
  /** Servings/portion multiplier (portion ÷ recipe servings), defaults to 1. */
  multiplier?: number;
};

/**
 * A single plan edit to reconcile against the list:
 *  - `add`    — a meal was added/placed → append its recipe.
 *  - `remove` — a meal was removed/cleared → decrement its recipe.
 *  - `swap`   — a meal was swapped → remove the outgoing, append the incoming.
 */
export type PlanShoppingEdit =
  | { kind: "add"; recipe: PlanSyncRecipe }
  | { kind: "remove"; recipe: PlanSyncRecipe }
  | { kind: "swap"; out: PlanSyncRecipe; in: PlanSyncRecipe };

export type PlanShoppingSyncResult = {
  items: ShoppingItem[];
  addedCount: number;
  mergedCount: number;
  decrementedCount: number;
  removedCount: number;
};

const EMPTY: Omit<PlanShoppingSyncResult, "items"> = {
  addedCount: 0,
  mergedCount: 0,
  decrementedCount: 0,
  removedCount: 0,
};

/**
 * Apply a plan edit to an existing list in memory. Pure + deterministic — the
 * client wraps persistence around it. For a swap, removal runs FIRST so a shared
 * ingredient nets correctly (both recipes use onions → the row is decremented by
 * the outgoing, then topped up by the incoming, not double-counted). New rows get
 * a temp id via `makeId` so the host/DB can assign a real one on insert.
 */
export function applyPlanEditToShoppingList(input: {
  existing: readonly ShoppingItem[];
  edit: PlanShoppingEdit;
  makeId?: (mergeKey: string) => string;
}): PlanShoppingSyncResult {
  const { existing, edit, makeId } = input;

  if (edit.kind === "add") {
    const r = appendRecipeToShoppingList({
      existing,
      recipeTitle: edit.recipe.title,
      ingredients: edit.recipe.ingredients,
      multiplier: edit.recipe.multiplier,
      makeId,
    });
    return { ...EMPTY, items: r.items, addedCount: r.addedCount, mergedCount: r.mergedCount };
  }

  if (edit.kind === "remove") {
    const r = removeRecipeFromShoppingList({
      existing,
      recipeTitle: edit.recipe.title,
      ingredients: edit.recipe.ingredients,
      multiplier: edit.recipe.multiplier,
    });
    return {
      ...EMPTY,
      items: r.items,
      decrementedCount: r.decrementedCount,
      removedCount: r.removedCount,
    };
  }

  // swap: remove outgoing, then append incoming, around one list.
  const removed = removeRecipeFromShoppingList({
    existing,
    recipeTitle: edit.out.title,
    ingredients: edit.out.ingredients,
    multiplier: edit.out.multiplier,
  });
  const added = appendRecipeToShoppingList({
    existing: removed.items,
    recipeTitle: edit.in.title,
    ingredients: edit.in.ingredients,
    multiplier: edit.in.multiplier,
    makeId,
  });
  return {
    items: added.items,
    addedCount: added.addedCount,
    mergedCount: added.mergedCount,
    decrementedCount: removed.decrementedCount,
    removedCount: removed.removedCount,
  };
}

/**
 * Calm one-line summary of a plan-driven sync, for a toast/announcement. Lists
 * are ingredients — no health claims, no estimated-nutrition language. Returns
 * an empty string when nothing changed (the host stays silent rather than
 * announcing a no-op).
 */
export function planShoppingSyncMessage(result: PlanShoppingSyncResult): string {
  const { addedCount, mergedCount, decrementedCount, removedCount } = result;
  const added = addedCount + mergedCount;
  const removed = removedCount;
  if (added === 0 && removed === 0 && decrementedCount === 0) return "";
  if (added > 0 && removed === 0 && decrementedCount === 0) {
    const label = added === 1 ? "1 ingredient" : `${added} ingredients`;
    return `Shopping list updated — ${label} added.`;
  }
  if (added === 0 && (removed > 0 || decrementedCount > 0)) {
    const n = removed + decrementedCount;
    const label = n === 1 ? "1 ingredient" : `${n} ingredients`;
    return `Shopping list updated — ${label} removed.`;
  }
  return "Shopping list updated to match your plan.";
}
