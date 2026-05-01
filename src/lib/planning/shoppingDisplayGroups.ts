import type { ShoppingItem } from "../../types/recipe";
import { normalizeIngredientNameKey } from "./ingredientNameKey";

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
 * (e.g. "200 g + 2 breast"). Does not sum incompatible units.
 */
export function formatMixedShoppingAmounts(items: ShoppingItem[]): string {
  return items
    .map((i) => `${i.amount} ${i.unit}`.trim().replace(/\s+/g, " "))
    .join(" + ");
}

/** Groups shopping rows that share a normalized ingredient name (within one category). */
export function groupShoppingItemsByIngredientName(items: ShoppingItem[]): ShoppingDisplayGroup[] {
  const map = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const k = normalizeIngredientNameKey(item.name);
    const arr = map.get(k);
    if (arr) arr.push(item);
    else map.set(k, [item]);
  }
  return [...map.values()].map((groupItems) => ({
    key: [...new Set(groupItems.map((i) => i.id))].sort().join("|"),
    displayName: pickDisplayName(groupItems.map((i) => i.name)),
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
