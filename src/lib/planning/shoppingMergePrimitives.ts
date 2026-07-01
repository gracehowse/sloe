// Extensionless relative imports — mobile-safe (Metro + the mobile tsconfig,
// which rejects `.ts` import paths). ENG-957 extracts the low-level shopping-row
// merge primitives that ENG-943's `appendRecipeToShoppingList` kept private, so
// the plan→list re-sync (add AND remove) shares one implementation rather than
// reimplementing the merge-key / amount-parse / count-to-weight rules. Both the
// appender and the new remover import from here — one contract, no drift.
import {
  measureToGramsConfidence,
  measureToGrams,
} from "../nutrition/measureToGrams";
import { normalizeIngredientNameKey } from "./ingredientNameKey";

/**
 * Canonical merge key for a shopping row: normalised ingredient identity + unit.
 * Two rows merge only when BOTH the ingredient name key AND the (normalised)
 * unit match — mirrors `generateShoppingList.ts#shoppingMergeKey` so a recipe
 * appended/removed here groups identically to a recipe pulled in via the plan.
 */
export function shoppingMergeKey(name: string, unit: string): string {
  return `${normalizeIngredientNameKey(name)}|${unit.trim().toLowerCase()}`;
}

/** Grams merge key — identity only (unit dropped; we've converted to grams). */
export function gramsMergeKey(name: string): string {
  return `${normalizeIngredientNameKey(name)}|__grams__`;
}

/** True when a row carries a weight (grams) unit. */
export function isGramsRow(unit: string): boolean {
  return unit.trim().toLowerCase() === "g";
}

/** Parse a shopping/ingredient amount ("1 1/2", "0.5", "3/4") → positive number or null. */
export function parseAmount(amount: string): number | null {
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

/** Format a numeric amount back to a stable 2-dp string. */
export function formatAmount(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * Decide whether a recipe line and an existing list row — same ingredient, but
 * one a COUNT and one a WEIGHT — can be safely combined into a single grams row.
 *
 * Count-to-weight normalisation is applied ONLY when the line converts to grams
 * at HIGH confidence (`measureToGramsConfidence`). If it is a guessed weight
 * (bare count of an unknown food, defaulted cup density, …) we DO NOT guess —
 * the caller keeps the two rows separate (the safe default). This honours the
 * non-negotiable "never guess a weight if confidence is low".
 */
export function tryCountToWeightGrams(
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

/** Case-insensitive, whole-token source membership (avoids "Soup" ⊂ "Soupy"). */
export function sourceIncludes(from: string, title: string): boolean {
  if (!from) return false;
  const needle = title.trim().toLowerCase();
  return from
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .includes(needle);
}

/** Whole-token source list (trimmed, empties dropped) preserving original casing. */
export function sourceTokens(from: string): string[] {
  if (!from) return [];
  return from
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Remove one recipe title (whole-token, case-insensitive) from a `source`
 * string, preserving the order and casing of the remaining titles. Returns the
 * rebuilt source (may be empty if the title was the only contributor).
 */
export function sourceWithout(from: string, title: string): string {
  const needle = title.trim().toLowerCase();
  return sourceTokens(from)
    .filter((t) => t.toLowerCase() !== needle)
    .join(", ");
}

/** Append a recipe title to a `source` string if not already present. */
export function sourceWith(from: string, title: string): string {
  if (sourceIncludes(from, title)) return from;
  return from ? `${from}, ${title}` : title;
}
