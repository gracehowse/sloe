// Extensionless relative imports so this module is mobile-safe (Metro + the
// mobile tsconfig, which rejects `.ts` import paths). ENG-943 routes BOTH the
// web RecipeDetail and the mobile recipe/[id] "Add to shopping list" action
// through this shared appender, so it lives in the cross-platform module graph.
import type { ShoppingItem } from "../../types/recipe";
import {
  measureToGramsConfidence,
  measureToGrams,
} from "../nutrition/measureToGrams";
import { guessGroceryCategory } from "./category";
import { normalizeIngredientNameKey } from "./ingredientNameKey";
import { normalizeShoppingIngredientRow } from "./normalizeShoppingIngredientRow";

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
 * Canonical merge key for a shopping row: normalised ingredient identity + unit.
 * Two rows merge only when BOTH the ingredient name key AND the (normalised)
 * unit match — mirrors `generateShoppingList.ts#shoppingMergeKey` so a recipe
 * appended here groups identically to a recipe pulled in via the plan path.
 */
function shoppingMergeKey(name: string, unit: string): string {
  return `${normalizeIngredientNameKey(name)}|${unit.trim().toLowerCase()}`;
}

/** Grams merge key — identity only (unit dropped; we've converted to grams). */
function gramsMergeKey(name: string): string {
  return `${normalizeIngredientNameKey(name)}|__grams__`;
}

function parseAmount(amount: string): number | null {
  const t = (amount ?? "").trim();
  if (!t) return null;
  const slash = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (slash) {
    const num = Number(slash[1]) / Number(slash[2]);
    return Number.isFinite(num) && num > 0 ? num : null;
  }
  const v = Number.parseFloat(t);
  return Number.isFinite(v) ? v : null;
}

function formatAmount(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** True when an existing row carries a weight (grams) unit. */
function isGramsRow(unit: string): boolean {
  return unit.trim().toLowerCase() === "g";
}

/**
 * Decide whether a recipe line and an existing list row — same ingredient, but
 * one a COUNT and one a WEIGHT — can be safely combined into a single grams row.
 *
 * Count-to-weight normalisation is applied ONLY when BOTH sides convert to grams
 * at HIGH confidence (`measureToGramsConfidence`). If either side is a guessed
 * weight (bare count of an unknown food, defaulted cup density, …) we DO NOT
 * guess — we keep the two rows separate (the safe default). This honours the
 * non-negotiable "never guess a weight if confidence is low".
 */
function tryCountToWeightGrams(
  name: string,
  amount: string,
  unit: string,
): { grams: number } | null {
  const value = parseAmount(amount);
  const safeAmount = value != null && value > 0 ? value : 1;
  const confidence = measureToGramsConfidence({ name, amount: safeAmount, unit });
  if (confidence !== "high") return null;
  const grams = measureToGrams({ name, amount: safeAmount, unit });
  if (!Number.isFinite(grams) || grams <= 0) return null;
  return { grams };
}

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
      if (!sourceIncludes(exact.from, title)) {
        exact.from = exact.from ? `${exact.from}, ${title}` : title;
      }
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
        if (!sourceIncludes(gramsRow.from, title)) {
          gramsRow.from = gramsRow.from ? `${gramsRow.from}, ${title}` : title;
        }
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

/** Case-insensitive, whole-token source membership (avoids "Soup" ⊂ "Soupy"). */
function sourceIncludes(from: string, title: string): boolean {
  if (!from) return false;
  const needle = title.trim().toLowerCase();
  return from
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .includes(needle);
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
