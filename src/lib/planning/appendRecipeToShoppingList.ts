// Extensionless relative imports so this module is mobile-safe (Metro + the
// mobile tsconfig, which rejects `.ts` import paths). ENG-943 routes BOTH the
// web RecipeDetail and the mobile recipe/[id] "Add to shopping list" action
// through this shared appender, so it lives in the cross-platform module graph.
import type { ShoppingItem } from "../../types/recipe";
import { guessGroceryCategory } from "./category";
import { normalizeShoppingIngredientRow } from "./normalizeShoppingIngredientRow";
import {
  formatAmount,
  gramsMergeKey,
  isGramsRow,
  parseAmount,
  shoppingMergeKey,
  sourceWith,
  tryCountToWeightGrams,
} from "./shoppingMergePrimitives";

/** A raw ingredient line off a recipe (name / amount / unit, pre-normalised). */
export type RecipeIngredientLine = {
  name: string;
  amount: string;
  unit: string;
};

/** Outcome of appending a recipe to an existing list — drives the calm framing. */
export type AppendRecipeToShoppingListResult = {
  /** The merged list (existing rows + this recipe's rows, deduped). */
  items: ShoppingItem[];
  /** Count of distinct ingredient lines this recipe contributed (added + merged). */
  ingredientCount: number;
  /** New rows that did not exist on the list before. */
  addedCount: number;
  /** Existing rows this recipe merged into (quantity summed / source appended). */
  mergedCount: number;
};

/**
 * Append a recipe's ingredient lines onto an existing shopping list, merging
 * duplicates silently (the thing Recime is criticised for NOT doing, per
 * ENG-943). Pure + deterministic — the host wires persistence around it.
 *
 * Aggregation rules:
 *  - Lines are normalised (`normalizeShoppingIngredientRow`) and aisle-tagged
 *    (`guessGroceryCategory`) exactly as the plan generator does.
 *  - Same ingredient identity + same unit → quantities sum, sources concatenate.
 *  - Same ingredient identity, COUNT vs WEIGHT → combined into one grams row
 *    ONLY when both convert at HIGH confidence; otherwise kept as separate rows.
 *  - `multiplier` (servings scale) applies to every numeric amount.
 */
export function appendRecipeToShoppingList(input: {
  existing: readonly ShoppingItem[];
  recipeTitle: string;
  ingredients: readonly RecipeIngredientLine[];
  multiplier?: number;
  /** Stable id factory for brand-new rows (defaults to the merge key). */
  makeId?: (mergeKey: string) => string;
}): AppendRecipeToShoppingListResult {
  const mult =
    typeof input.multiplier === "number" && Number.isFinite(input.multiplier) && input.multiplier > 0
      ? input.multiplier
      : 1;
  const title = input.recipeTitle.trim() || "Recipe";
  const makeId = input.makeId ?? ((key: string) => key);

  // Working copy of the existing list, keyed for O(1) merge lookups.
  const items: ShoppingItem[] = input.existing.map((it) => ({ ...it }));
  const byKey = new Map<string, ShoppingItem>();
  const byGramsKey = new Map<string, ShoppingItem>();
  for (const it of items) {
    byKey.set(shoppingMergeKey(it.name, it.unit), it);
    if (isGramsRow(it.unit)) byGramsKey.set(gramsMergeKey(it.name), it);
  }

  let addedCount = 0;
  let mergedCount = 0;
  let ingredientCount = 0;

  for (const raw of input.ingredients) {
    const normalized = normalizeShoppingIngredientRow(raw);
    if (!normalized.name) continue;
    ingredientCount += 1;

    const category = guessGroceryCategory(normalized.name);
    const key = shoppingMergeKey(normalized.name, normalized.unit);
    const value = parseAmount(normalized.amount);
    const scaled = value != null ? value * mult : null;

    // 1. Exact key (identity + unit) already present → sum + append source.
    const exact = byKey.get(key);
    if (exact) {
      const prev = parseAmount(exact.amount);
      if (prev != null && scaled != null) {
        exact.amount = formatAmount(prev + scaled);
      } else if (scaled != null && prev == null) {
        exact.amount = formatAmount(scaled);
      }
      exact.from = sourceWith(exact.from, title);
      mergedCount += 1;
      continue;
    }

    // 2. Count-to-weight: an existing GRAMS row for the same ingredient, and
    //    this line converts to grams at high confidence → fold into grams.
    const gramsRow = byGramsKey.get(gramsMergeKey(normalized.name));
    if (gramsRow && !isGramsRow(normalized.unit)) {
      const conv = tryCountToWeightGrams(normalized.name, normalized.amount, normalized.unit);
      if (conv) {
        const prev = parseAmount(gramsRow.amount) ?? 0;
        gramsRow.amount = formatAmount(prev + conv.grams * mult);
        gramsRow.from = sourceWith(gramsRow.from, title);
        mergedCount += 1;
        continue;
      }
      // Low confidence → fall through and add as its own row (never guess).
    }

    // 3. Brand-new row.
    const row: ShoppingItem = {
      id: makeId(key),
      name: normalized.name,
      amount: scaled != null ? formatAmount(scaled) : normalized.amount,
      unit: normalized.unit,
      category,
      checked: false,
      from: title,
    };
    items.push(row);
    byKey.set(key, row);
    if (isGramsRow(row.unit)) byGramsKey.set(gramsMergeKey(row.name), row);
    addedCount += 1;
  }

  return { items, ingredientCount, addedCount, mergedCount };
}

/**
 * Calm "building your list" framing for the append result. Honours the
 * estimated-nutrition trust posture (no health claims; lists are ingredients).
 * Used verbatim on web (toast) + mobile (Alert) so the voice matches.
 */
export function buildingYourListMessage(result: AppendRecipeToShoppingListResult): string {
  const { addedCount, mergedCount } = result;
  if (addedCount === 0 && mergedCount === 0) {
    return "Nothing to add — this recipe has no ingredients yet.";
  }
  if (addedCount === 0) {
    // Everything merged into rows already on the list.
    return mergedCount === 1
      ? "Already on your list — we topped up the quantity."
      : `Already on your list — we topped up ${mergedCount} ingredients.`;
  }
  const addedLabel = addedCount === 1 ? "1 ingredient" : `${addedCount} ingredients`;
  if (mergedCount === 0) {
    return `Added ${addedLabel} to your shopping list.`;
  }
  const mergedLabel = mergedCount === 1 ? "1 you already had" : `${mergedCount} you already had`;
  return `Added ${addedLabel} — merged ${mergedLabel}.`;
}
