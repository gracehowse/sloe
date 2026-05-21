import type { ShoppingItem } from "../../types/recipe";
import { dedupeShoppingLabel } from "./shoppingListLifecycle";
import {
  extractLeadingQuantityFromName,
  normalizeShoppingUnit,
} from "./shoppingQuantityMerge";

const SUMMABLE_UNITS = new Set(["g", "kg", "ml", "l", "oz", "lb", "tbsp", "tsp", "cup"]);

function isBareCountAmount(amount: string, unit: string): boolean {
  const a = amount.trim();
  const u = unit.trim();
  if (!a) return true;
  if (u) return false;
  const n = Number.parseFloat(a);
  return Number.isFinite(n) && n <= 1;
}

export type ShoppingIngredientFields = {
  name: string;
  amount: string;
  unit: string;
};

function formatAmountString(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function collapseRepeatedWord(text: string): string {
  return text.replace(/\b(\w+)\s+\1\b/gi, "$1");
}

function stripDuplicateCountPrefix(text: string): string {
  return text.replace(/^(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s+\1\s+/, "$1 ");
}

/**
 * Cleans nutrition-db noise and stray characters before amount/name split.
 * Safe at generation time and when hydrating rows from the DB.
 */
export function sanitizeShoppingIngredientName(name: string): string {
  let n = name.trim();
  if (!n) return n;

  n = n.replace(/\s*%+\s*/g, " ");
  n = n.replace(/\d+\s+1\s+undetermined\s+medium\s*\([^)]*\)\s*/gi, "");
  n = n.replace(/\b1\s+undetermined\s+medium\s*\([^)]*\)\s*/gi, "");
  n = n.replace(/\bundetermined\s+medium\s*\([^)]*\)\s*/gi, "");
  n = n.replace(/\b\d+\s+undetermined\s+/gi, "");

  // USDA parenthetical descriptors: "(includes tops and bulb)", "(yield from 1 lb)"
  n = n.replace(/\s*\(includes\s[^)]*\)/gi, "");
  n = n.replace(/\s*\(yield\s[^)]*\)/gi, "");

  // USDA trailing state descriptors: ", raw", ", fresh", ", uncooked"
  n = n.replace(/,\s*(?:raw|fresh|uncooked)\s*$/i, "");

  // USDA inverted-name format: "Onions, spring or scallions" → "Spring onions"
  // Only fires when "or <alt>" is present (distinguishes from prep instructions like "spinach, chopped")
  const invertedMatch = n.match(/^(\w+),\s+([\w-]+(?:\s[\w-]+)?)\s+or\s+[\w-]+(?:\s[\w-]+)?\s*$/i);
  if (invertedMatch) {
    const [, category, modifier] = invertedMatch;
    n = modifier!.charAt(0).toUpperCase() + modifier!.slice(1) + " " + category!.toLowerCase();
  }

  n = stripDuplicateCountPrefix(n);
  n = collapseRepeatedWord(n);

  return n.replace(/\s+/g, " ").trim();
}

/**
 * Canonical `{ name, amount, unit }` for shopping rows — splits embedded
 * quantities out of `name`, dedupes doubled prefixes, strips USDA boilerplate.
 */
export function normalizeShoppingIngredientRow(row: ShoppingIngredientFields): ShoppingIngredientFields {
  let name = sanitizeShoppingIngredientName(row.name ?? "");
  let amount = (row.amount ?? "").trim();
  let unit = (row.unit ?? "").trim();

  const leading = extractLeadingQuantityFromName(name);
  const shouldExtractLeading =
    leading &&
    (leading.unit === "" || SUMMABLE_UNITS.has(leading.unit)) &&
    (!amount || (leading.unit !== "" && isBareCountAmount(amount, unit)));

  if (shouldExtractLeading && leading) {
    amount = formatAmountString(leading.value);
    unit = leading.unit ? leading.unit : unit;
    name = leading.rest || name;
  }

  const deduped = dedupeShoppingLabel({ amount, unit, name });
  name = sanitizeShoppingIngredientName(deduped.name);
  amount = deduped.amount;
  unit = normalizeShoppingUnit(deduped.unit) || deduped.unit;

  if (unit) {
    const unitLead = new RegExp(`^${unit}\\b\\s*`, "i");
    if (unitLead.test(name)) name = name.replace(unitLead, "").trim();
  }

  return { name, amount, unit };
}

/** Apply canonical fields on a shopping row (safe at render and persist boundaries). */
export function withNormalizedShoppingFields(item: ShoppingItem): ShoppingItem {
  const normalized = normalizeShoppingIngredientRow(item);
  return { ...item, name: normalized.name, amount: normalized.amount, unit: normalized.unit };
}
