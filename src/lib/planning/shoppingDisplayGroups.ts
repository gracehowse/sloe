import type { ShoppingItem } from "../../types/recipe";
import { normalizeIngredientNameKey } from "./ingredientNameKey";
import {
  formatMergedShoppingAmounts,
  shoppingIngredientHeadline,
  stripHeadlineForMixedQuantity,
} from "./shoppingQuantityMerge";

export type ShoppingDisplayGroup = {
  /** Stable id for React keys (underlying item ids). */
  key: string;
  /** Shortest distinct name in the group for the headline. */
  displayName: string;
  items: ShoppingItem[];
};

function pickDisplayName(names: string[]): string {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return "";
  return unique.sort((a, b) => a.length - b.length)[0]!;
}

/** Shortest ingredient headline after stripping duplicate amount/unit prefixes. */
function pickGroupDisplayName(items: ShoppingItem[]): string {
  return pickDisplayName(items.map((item) => shoppingIngredientHeadline(item)));
}

/** When `from` references exactly one recipe title (no comma), returns that title. */
export function singleRecipeTitleFromFromField(from: string): string | null {
  const parts = from.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length === 1 ? parts[0]! : null;
}

/** Merges comma-separated recipe titles from several lines into one deduped list. */
export function mergeShoppingFromFields(items: ShoppingItem[]): string {
  const titles = new Set<string>();
  for (const it of items) {
    for (const p of it.from.split(",").map((s) => s.trim()).filter(Boolean)) {
      titles.add(p);
    }
  }
  return [...titles].join(", ");
}

/**
 * Human-readable quantities when the same ingredient appears with different units
 * (e.g. "200 g + 2 breast"). Compatible units sum (600 g + 100 g → 700 g).
 */
export function formatMixedShoppingAmounts(items: ShoppingItem[]): string {
  return formatMergedShoppingAmounts(items);
}

/**
 * One premium shopping row line — no redundant "(qty)" suffixes.
 */
export function formatShoppingGroupLabel(group: ShoppingDisplayGroup): string {
  if (group.items.length === 1) {
    const item = group.items[0]!;
    const mixed = formatMixedShoppingAmounts([item]);
    const headline = shoppingIngredientHeadline(item);
    const name = stripHeadlineForMixedQuantity(headline, mixed);
    if (!mixed) return name || headline;
    if (!name) return mixed;
    if (name.toLowerCase().includes(mixed.toLowerCase())) return name;
    if (/^[\d/]/.test(mixed) || /^\d+×/.test(mixed)) return `${mixed} ${name}`.trim();
    return `${name} · ${mixed}`;
  }

  const mixed = formatMixedShoppingAmounts(group.items);
  const name = stripHeadlineForMixedQuantity(group.displayName.trim(), mixed);
  if (!mixed) return name;
  if (!name) return mixed;
  if (name.toLowerCase().includes(mixed.toLowerCase())) return name;
  // Quantity-first reads like a real shopping list: "700 g spinach".
  if (/^[\d/]/.test(mixed) || /^\d+×/.test(mixed)) return `${mixed} ${name}`.trim();
  return `${name} · ${mixed}`;
}

/** Stable merge key — strips leading qty/units so "600 g spinach" and "100g spinach" group. */
export function shoppingGroupIngredientKey(item: ShoppingItem): string {
  const headline = shoppingIngredientHeadline(item);
  return normalizeIngredientNameKey(headline || item.name);
}

/** Groups shopping rows that share a normalized ingredient name (within one category). */
export function groupShoppingItemsByIngredientName(items: ShoppingItem[]): ShoppingDisplayGroup[] {
  const map = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const k = shoppingGroupIngredientKey(item);
    const arr = map.get(k);
    if (arr) arr.push(item);
    else map.set(k, [item]);
  }
  return [...map.values()].map((groupItems) => ({
    key: [...new Set(groupItems.map((i) => i.id))].sort().join("|"),
    displayName: pickGroupDisplayName(groupItems),
    items: groupItems,
  }));
}

export function isShoppingGroupFullyChecked(group: ShoppingDisplayGroup): boolean {
  return group.items.length > 0 && group.items.every((i) => i.checked);
}

export function isShoppingGroupIndeterminate(group: ShoppingDisplayGroup): boolean {
  const n = group.items.filter((i) => i.checked).length;
  return n > 0 && n < group.items.length;
}
