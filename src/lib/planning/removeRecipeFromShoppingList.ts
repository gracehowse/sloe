// Extensionless relative imports — mobile-safe (Metro + the mobile tsconfig).
// ENG-957 — the INVERSE of ENG-943's `appendRecipeToShoppingList`. When a meal
// is removed or swapped OUT of the plan, its ingredient contribution must come
// back OFF the shopping list, without a full delete-and-replace (which would
// wipe checked rows and a household-mate's manual additions). This decrements
// only what that recipe contributed and drops a row only when it reaches zero
// AND no other recipe still sources it. Provenance is the existing `from`
// (comma-separated recipe titles) field — no schema change (see the ENG-957
// decision note): a row tagged only by the removed recipe is safe to delete; a
// row still sourced by another recipe is decremented and kept.
import type { ShoppingItem } from "../../types/recipe";
import { normalizeShoppingIngredientRow } from "./normalizeShoppingIngredientRow";
import {
  formatAmount,
  gramsMergeKey,
  isGramsRow,
  parseAmount,
  shoppingMergeKey,
  sourceIncludes,
  sourceTokens,
  sourceWithout,
  tryCountToWeightGrams,
} from "./shoppingMergePrimitives";
import type { RecipeIngredientLine } from "./appendRecipeToShoppingList";

/** Outcome of removing a recipe's contribution from a list. */
export type RemoveRecipeFromShoppingListResult = {
  /** The list after the recipe's contribution was decremented/removed. */
  items: ShoppingItem[];
  /** Rows deleted entirely (dropped to ~zero AND no other recipe sourced them). */
  removedCount: number;
  /** Rows whose amount/source shrank but survived (another recipe still uses them). */
  decrementedCount: number;
};

// Below this residual we treat a row as fully consumed by the removal — floating
// point sums (0.1 + 0.2 …) never land on an exact 0.
const ZERO_EPSILON = 1e-6;

/**
 * Remove a recipe's ingredient contribution from an existing shopping list.
 *
 * Symmetry with the appender is the whole point — the same normalisation,
 * merge-key, servings multiplier, and count-to-weight HIGH-confidence gate are
 * reused (shared primitives), so `remove(add(list)) === list` for the rows this
 * recipe touched. Rules:
 *
 *  - A row is a removal candidate only when its `from` source references THIS
 *    recipe (whole-token, case-insensitive) — we never touch a household-mate's
 *    manually-added row or another recipe's row.
 *  - Same identity + unit → subtract this recipe's (scaled) amount.
 *  - Count vs weight, same identity → subtract the HIGH-confidence grams the
 *    same conversion would have added; a low-confidence line never contributed a
 *    guessed gram number on the way in, so it never subtracts one on the way out
 *    (it would have been its own row, matched by the exact-key branch instead).
 *  - After subtracting, if the row still has another recipe in `from`, keep it
 *    (drop only this recipe's token from the source); if this recipe was the
 *    ONLY source AND the amount is now ~zero (or unparseable), delete the row.
 *  - `checked` state is preserved on any surviving row — removal never re-checks
 *    or un-checks. A checked row that drops to zero is still deleted (the user
 *    is no longer buying it), matching the plan's own reconciliation intent.
 */
export function removeRecipeFromShoppingList(input: {
  existing: readonly ShoppingItem[];
  recipeTitle: string;
  ingredients: readonly RecipeIngredientLine[];
  multiplier?: number;
}): RemoveRecipeFromShoppingListResult {
  const mult =
    typeof input.multiplier === "number" &&
    Number.isFinite(input.multiplier) &&
    input.multiplier > 0
      ? input.multiplier
      : 1;
  const title = input.recipeTitle.trim() || "Recipe";

  const items: ShoppingItem[] = input.existing.map((it) => ({ ...it }));
  const byKey = new Map<string, ShoppingItem>();
  const byGramsKey = new Map<string, ShoppingItem>();
  for (const it of items) {
    byKey.set(shoppingMergeKey(it.name, it.unit), it);
    if (isGramsRow(it.unit)) byGramsKey.set(gramsMergeKey(it.name), it);
  }

  // Rows this call decides to delete (id set), and rows it shrinks.
  const toDelete = new Set<string>();
  let decrementedCount = 0;

  for (const raw of input.ingredients) {
    const normalized = normalizeShoppingIngredientRow(raw);
    if (!normalized.name) continue;

    const value = parseAmount(normalized.amount);
    const scaled = value != null ? value * mult : null;

    // 1. Exact key (identity + unit) — the row this line would have summed into.
    const exact = byKey.get(shoppingMergeKey(normalized.name, normalized.unit));
    if (exact && sourceIncludes(exact.from, title) && !toDelete.has(exact.id)) {
      applyDecrement(exact, scaled, title, toDelete, () => {
        decrementedCount += 1;
      });
      continue;
    }

    // 2. Count-to-weight: this line folded into an existing GRAMS row on the way
    //    in — subtract the same HIGH-confidence grams it added.
    const gramsRow = byGramsKey.get(gramsMergeKey(normalized.name));
    if (
      gramsRow &&
      !isGramsRow(normalized.unit) &&
      sourceIncludes(gramsRow.from, title) &&
      !toDelete.has(gramsRow.id)
    ) {
      const conv = tryCountToWeightGrams(normalized.name, normalized.amount, normalized.unit);
      if (conv) {
        applyDecrement(gramsRow, conv.grams * mult, title, toDelete, () => {
          decrementedCount += 1;
        });
        continue;
      }
      // Low confidence → it never folded into grams on the way in (it would have
      // been its own row), so there is nothing to subtract here. Fall through.
    }
    // No matching row (already checked-off + purged, or never added) → no-op.
  }

  const survivors = items.filter((it) => !toDelete.has(it.id));
  return {
    items: survivors,
    removedCount: toDelete.size,
    decrementedCount,
  };
}

/**
 * Subtract `amount` from a row's quantity, then decide keep-vs-delete:
 *  - unparseable amount + this recipe is the only source → delete,
 *  - residual ~zero + this recipe is the only source → delete,
 *  - otherwise shrink the amount (when parseable) and drop this recipe's token
 *    from `from` (keeping any other recipe's source).
 */
function applyDecrement(
  row: ShoppingItem,
  amount: number | null,
  title: string,
  toDelete: Set<string>,
  onDecrement: () => void,
): void {
  const otherSources = sourceTokens(sourceWithout(row.from, title));
  const soleSource = otherSources.length === 0;
  const prev = parseAmount(row.amount);

  if (prev == null || amount == null) {
    // Can't do arithmetic. If this recipe was the only reason the row exists,
    // remove it; otherwise just drop this recipe's token from the source.
    if (soleSource) {
      toDelete.add(row.id);
    } else {
      row.from = sourceWithout(row.from, title);
      onDecrement();
    }
    return;
  }

  const residual = prev - amount;
  if (residual <= ZERO_EPSILON && soleSource) {
    toDelete.add(row.id);
    return;
  }

  row.amount = formatAmount(residual > 0 ? residual : 0);
  row.from = sourceWithout(row.from, title);
  onDecrement();
}
