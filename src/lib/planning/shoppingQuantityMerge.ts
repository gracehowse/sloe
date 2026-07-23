import type { ShoppingItem } from "../../types/recipe";
import { formatShopSensibleQuantity } from "./shoppingScanLabel";
import { dedupeShoppingLabel } from "./shoppingListLifecycle";

export type ParsedShoppingQuantity = {
  value: number;
  /** Normalized unit key; empty string = count / each. */
  unit: string;
};

/** Map unit aliases to a canonical key for summing. */
export function normalizeShoppingUnit(unit: string): string {
  const u = unit.trim().toLowerCase();
  if (!u || u === "each" || u === "count" || u === "x") return "";
  if (u === "g" || u === "gram" || u === "grams" || u === "gr") return "g";
  if (u === "kg" || u === "kilogram" || u === "kilograms") return "kg";
  if (u === "ml" || u === "milliliter" || u === "milliliters" || u === "millilitre" || u === "millilitres")
    return "ml";
  if (u === "l" || u === "liter" || u === "liters" || u === "litre" || u === "litres") return "l";
  if (u === "oz" || u === "ounce" || u === "ounces") return "oz";
  if (u === "lb" || u === "lbs" || u === "pound" || u === "pounds") return "lb";
  if (u === "tbsp" || u === "tablespoon" || u === "tablespoons") return "tbsp";
  if (u === "tsp" || u === "teaspoon" || u === "teaspoons") return "tsp";
  if (u === "cup" || u === "cups") return "cup";
  return u;
}

function parseAmountNumeric(amount: string): number | null {
  const t = amount.trim();
  if (!t) return null;
  if (t.includes("-")) {
    const [a, b] = t.split("-").map((x) => Number.parseFloat(x.trim()));
    if (Number.isFinite(a) && Number.isFinite(b)) return (a + b) / 2;
  }
  const slash = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (slash) {
    const num = Number(slash[1]) / Number(slash[2]);
    return Number.isFinite(num) && num > 0 ? num : null;
  }
  const v = Number.parseFloat(t);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** @deprecated Prefer formatShopSensibleQuantity — kept for strip/token equality checks. */
function formatAmountNumber(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}

const SUMMABLE_UNIT_KEYS = new Set(["g", "kg", "ml", "l", "oz", "lb", "tbsp", "tsp", "cup"]);

function isSummableUnitKey(unit: string): boolean {
  return SUMMABLE_UNIT_KEYS.has(unit);
}

/** Parse leading `200 g` / `100g` / `1 medium onion` from the name when amount fields are empty. */
export function extractLeadingQuantityFromName(
  name: string,
): (ParsedShoppingQuantity & { rest: string }) | null {
  const trimmed = name.trim();
  const glued = trimmed.match(/^([\d./]+)(g|kg|ml|l|oz|lb|tbsp|tsp)\s*(.*)$/i);
  if (glued) {
    const value = parseAmountNumeric(glued[1]!);
    if (value == null) return null;
    const unit = normalizeShoppingUnit(glued[2]!);
    return { value, unit, rest: (glued[3] ?? "").trim() };
  }

  const m = trimmed.match(/^([\d./]+)\s*(.*)$/);
  if (!m) return null;
  const value = parseAmountNumeric(m[1]!);
  if (value == null) return null;
  const rest = (m[2] ?? "").trim();
  if (!rest) return { value, unit: "", rest: "" };

  const spacedUnit = rest.match(/^([a-zA-Z]+)\s+(.+)$/);
  if (spacedUnit) {
    const unit = normalizeShoppingUnit(spacedUnit[1]!);
    if (isSummableUnitKey(unit)) {
      return { value, unit, rest: spacedUnit[2]!.trim() };
    }
  }

  return { value, unit: "", rest };
}

function stripDuplicateCountInHeadline(text: string): string {
  return text.replace(/^(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s+\1\s+/, "$1 ");
}

/** Ingredient headline with amount/unit prefixes removed from the name field. */
export function shoppingIngredientHeadline(item: ShoppingItem): string {
  const d = dedupeShoppingLabel({
    amount: item.amount,
    unit: item.unit,
    name: item.name,
  });
  const baseName = collapseRepeatedWord(stripDuplicateCountInHeadline((d.name || item.name).trim()));
  const leading = extractLeadingQuantityFromName(baseName);
  if (leading?.rest) return leading.rest;
  return baseName;
}

/**
 * Parse a shopping row into a summable quantity after label dedupe.
 * Returns null when the amount is non-numeric (caller falls back to raw token).
 */
export function parseShoppingItemQuantity(item: ShoppingItem): ParsedShoppingQuantity | null {
  const d = dedupeShoppingLabel({
    amount: item.amount,
    unit: item.unit,
    name: item.name,
  });
  const value = parseAmountNumeric(d.amount);
  if (value != null) {
    return { value, unit: normalizeShoppingUnit(d.unit) };
  }
  return extractLeadingQuantityFromName(d.name);
}

function formatSummedQuantity(value: number, unit: string): string {
  // ENG-1669 — shop-sensible display (266.66 g → 267 g); never fake precision.
  return formatShopSensibleQuantity(value, unit) || formatAmountNumber(value);
}

/**
 * Premium mixed-quantity line: sum compatible units (e.g. 600 g + 100 g → 700 g),
 * keep incompatible units joined with " + ".
 */
export function formatMergedShoppingAmounts(items: ShoppingItem[]): string {
  const sumByUnit = new Map<string, number>();
  const fallbackTokens: string[] = [];

  for (const item of items) {
    const parsed = parseShoppingItemQuantity(item);
    if (parsed) {
      const key = parsed.unit || "__count__";
      sumByUnit.set(key, (sumByUnit.get(key) ?? 0) + parsed.value);
      continue;
    }
    const d = dedupeShoppingLabel({
      amount: item.amount,
      unit: item.unit,
      name: item.name,
    });
    const qty = [d.amount, d.unit].filter(Boolean).join(" ").trim();
    fallbackTokens.push(qty || d.name);
  }

  const parts: string[] = [];
  const unitOrder = ["kg", "g", "lb", "oz", "l", "ml", "cup", "tbsp", "tsp", "__count__"];
  const sortedKeys = [...sumByUnit.keys()].sort((a, b) => {
    const ai = unitOrder.indexOf(a);
    const bi = unitOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  for (const key of sortedKeys) {
    const total = sumByUnit.get(key)!;
    parts.push(formatSummedQuantity(total, key === "__count__" ? "" : key));
  }

  if (fallbackTokens.length > 0) {
    const counts = new Map<string, number>();
    for (const token of fallbackTokens) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
    for (const [token, n] of counts.entries()) {
      parts.push(n > 1 ? `${n}× ${token}` : token);
    }
  }

  return parts.join(" + ");
}

/**
 * Remove a quantity prefix from the headline when `mixed` already carries it
 * (e.g. mixed `6 jar` + name `jar chickpeas` → `chickpeas`).
 */
export function stripHeadlineForMixedQuantity(headline: string, mixed: string): string {
  const h = headline.trim();
  const m = mixed.trim();
  if (!h || !m) return h;

  if (/^[\d./]+$/.test(m)) {
    const escaped = m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const dupCount = new RegExp(`^${escaped}\\s+${escaped}\\s+`, "");
    if (dupCount.test(h)) return h.replace(dupCount, "").trim();
    const dupOnce = new RegExp(`^${escaped}\\s+`, "");
    if (dupOnce.test(h)) return h.replace(dupOnce, "").trim();
    const mixedVal = Number.parseFloat(m);
    const headLead = h.match(/^(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s+/);
    if (headLead && Number.isFinite(mixedVal) && Number.parseFloat(headLead[1]!) < mixedVal) {
      return h.slice(headLead[0].length).trim();
    }
  }

  const leading = extractLeadingQuantityFromName(h);
  if (leading) {
    const token = formatSummedQuantity(leading.value, leading.unit);
    if (m === token || m.startsWith(`${token} +`) || m.endsWith(` + ${token}`) || m.includes(` + ${token} +`)) {
      return leading.rest || h;
    }
    // Mixed total already covers this unit (e.g. `1.5 tbsp` + `1/2 tbsp olive oil`).
    if (leading.unit && m.includes(leading.unit)) {
      return leading.rest || h;
    }
  }

  const mixedUnit = m.match(/^([\d./]+)\s+([a-zA-Z]+)$/);
  if (mixedUnit) {
    const unit = mixedUnit[2]!;
    const unitLead = new RegExp(`^${unit}\\b\\s*`, "i");
    if (unitLead.test(h)) return h.replace(unitLead, "").trim();
  }

  return collapseRepeatedWord(h);
}

/** "jar jar chickpeas" → "jar chickpeas" after unit dedupe. */
function collapseRepeatedWord(text: string): string {
  return text.replace(/\b(\w+)\s+\1\b/gi, "$1");
}
