import type { ShoppingItem } from "../../types/recipe";
import { normalizeIngredientNameKey } from "./ingredientNameKey";
import {
  formatMergedShoppingAmounts,
  shoppingIngredientHeadline,
  stripHeadlineForMixedQuantity,
} from "./shoppingQuantityMerge";
import { stripShoppingPrepFromName } from "./shoppingScanLabel";

export type FormatShoppingGroupLabelOptions = {
  /**
   * ENG-1669 — in-store scan density: strip cook-prep suffixes from the
   * name so the primary line is buyable identity only.
   */
  forShoppingScan?: boolean;
};

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

export type ShoppingGroupLabelParts = {
  /** Quantity-first amount when present ("200 g", "2 × 400 g"). Null when name-only. */
  quantity: string | null;
  /** Buyable ingredient name (prep-stripped when `forShoppingScan`). */
  name: string;
};

/**
 * Qty + name parts for Mob-style typography (bold qty, regular name).
 * Pass `{ forShoppingScan: true }` (ENG-1669) to drop prep suffixes.
 */
export function formatShoppingGroupParts(
  group: ShoppingDisplayGroup,
  options: FormatShoppingGroupLabelOptions = {},
): ShoppingGroupLabelParts {
  const scan = options.forShoppingScan === true;

  if (group.items.length === 1) {
    const item = group.items[0]!;
    const mixed = formatMixedShoppingAmounts([item]);
    const headline = shoppingIngredientHeadline(item);
    let name = stripHeadlineForMixedQuantity(headline, mixed);
    if (scan) name = stripShoppingPrepFromName(name);
    if (!mixed) {
      const fallback = name || (scan ? stripShoppingPrepFromName(headline) : headline);
      return { quantity: null, name: fallback };
    }
    if (!name) return { quantity: mixed, name: "" };
    if (name.toLowerCase().includes(mixed.toLowerCase())) {
      return { quantity: null, name };
    }
    if (/^[\d/]/.test(mixed) || /^\d+×/.test(mixed)) {
      return { quantity: mixed, name };
    }
    return { quantity: mixed, name };
  }

  const mixed = formatMixedShoppingAmounts(group.items);
  let name = stripHeadlineForMixedQuantity(group.displayName.trim(), mixed);
  if (scan) name = stripShoppingPrepFromName(name);
  if (!mixed) return { quantity: null, name };
  if (!name) return { quantity: mixed, name: "" };
  if (name.toLowerCase().includes(mixed.toLowerCase())) {
    return { quantity: null, name };
  }
  // Quantity-first reads like a real shopping list: "700 g spinach".
  return { quantity: mixed, name };
}

/**
 * One premium shopping row line — no redundant "(qty)" suffixes.
 * Pass `{ forShoppingScan: true }` (ENG-1669 density) to drop prep suffixes.
 */
export function formatShoppingGroupLabel(
  group: ShoppingDisplayGroup,
  options: FormatShoppingGroupLabelOptions = {},
): string {
  const { quantity, name } = formatShoppingGroupParts(group, options);
  if (!quantity) return name;
  if (!name) return quantity;
  // Name · qty only when quantity isn't a leading numeric form.
  if (!/^[\d/]/.test(quantity) && !/^\d+×/.test(quantity)) {
    return `${name} · ${quantity}`;
  }
  return `${quantity} ${name}`.trim();
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
