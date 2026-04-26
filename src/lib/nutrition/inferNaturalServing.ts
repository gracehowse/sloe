/**
 * F-91 (2026-04-25) — name-based natural-serving inference for verified
 * USDA generic foods.
 *
 * USDA's `/foods/search` endpoint does NOT ship `foodPortions[]` for
 * Foundation / SR Legacy hits — only the per-100g nutrient envelope.
 * That left search rows for "Eggs, Grade A, Large, egg whole",
 * "Bananas, raw", "Apples, raw, with skin", etc rendering as
 * "143 kcal per 100g" instead of "1 large egg (50g) · 72 kcal".
 *
 * F-88 fixed the picker (post-tap) by fetching `foodPortions[]` from
 * `/food/{id}`. F-91 handles the search-row display by mapping verified
 * USDA descriptions to a known natural serving via pattern match. The
 * mapping is conservative — only fires on names that unambiguously
 * describe a single canonical unit ("Eggs, Grade A, Large, egg whole" →
 * 1 large egg = 50g; "Bananas, raw" → 1 medium banana = 118g).
 *
 * Gram weights match USDA's own foodPortions[] for the corresponding
 * detail endpoints, so picker and search row stay consistent.
 *
 * Caller MUST pass `isVerified: true` (only Foundation / SR Legacy /
 * Survey rows qualify). Branded "EGGS" rows must not be inferred — they
 * carry their own `servingSize` field via `pickUsdaBrandedPrimaryServing`.
 */
import { scalePrimaryServingFromPer100g, type MacrosPer100gLite, type PrimaryServing } from "./primaryServing";

type ServingHint = {
  pattern: RegExp;
  label: string;
  grams: number;
};

/**
 * Pattern → natural serving lookup. Patterns require enough specificity
 * to avoid matching unrelated rows (e.g. "Egg" alone won't match — must
 * include "egg whole" / "egg white" / "egg yolk" so we don't mislabel
 * an ambiguous row).
 *
 * Gram weights from USDA's published foodPortions[] for the canonical
 * row — keep these aligned with the detail endpoint so picker and search
 * row agree.
 */
const NATURAL_SERVING_HINTS: ServingHint[] = [
  // Eggs — USDA Foundation: "Eggs, Grade A, Large, egg whole" (148kcal/100g)
  { pattern: /\beggs?\b.*\begg whole\b/i, label: "1 large egg", grams: 50 },
  { pattern: /\beggs?\b.*\begg white\b/i, label: "1 large egg white", grams: 33 },
  { pattern: /\beggs?\b.*\begg yolk\b/i, label: "1 large egg yolk", grams: 17 },

  // Fruits (USDA SR Legacy "X, raw" / "X, raw, with skin").
  { pattern: /^bananas?\b.*\braw/i, label: "1 medium banana", grams: 118 },
  { pattern: /^apples?\b.*\braw/i, label: "1 medium apple", grams: 182 },
  { pattern: /^oranges?\b.*\braw/i, label: "1 medium orange", grams: 131 },
  { pattern: /^pears?\b.*\braw/i, label: "1 medium pear", grams: 178 },
  { pattern: /^peaches?\b.*\braw/i, label: "1 medium peach", grams: 150 },
  { pattern: /^plums?\b.*\braw/i, label: "1 medium plum", grams: 66 },
  { pattern: /^kiwi.*\braw/i, label: "1 medium kiwi", grams: 69 },
  { pattern: /^avocados?\b.*\braw/i, label: "1 medium avocado", grams: 201 },
  { pattern: /^mangoes?\b.*\braw/i, label: "1 medium mango", grams: 200 },
  { pattern: /^nectarines?\b.*\braw/i, label: "1 medium nectarine", grams: 142 },
  { pattern: /^strawberr.*\braw/i, label: "1 medium strawberry", grams: 12 },
  { pattern: /^lemons?\b.*\braw/i, label: "1 medium lemon", grams: 58 },
  { pattern: /^limes?\b.*\braw/i, label: "1 medium lime", grams: 67 },
  { pattern: /^grapefruit.*\braw/i, label: "1/2 medium grapefruit", grams: 154 },

  // Vegetables (USDA SR Legacy "X, raw").
  { pattern: /^tomatoes?\b.*\braw/i, label: "1 medium tomato", grams: 123 },
  { pattern: /^carrots?\b.*\braw/i, label: "1 medium carrot", grams: 61 },
  { pattern: /^cucumbers?\b.*\braw/i, label: "1 medium cucumber", grams: 201 },
  { pattern: /^bell peppers?\b.*\braw/i, label: "1 medium bell pepper", grams: 119 },
  { pattern: /^peppers?,\s*sweet.*\braw/i, label: "1 medium pepper", grams: 119 },
  { pattern: /^onions?\b.*\braw/i, label: "1 medium onion", grams: 110 },
  { pattern: /^potatoes?\b.*\braw/i, label: "1 medium potato", grams: 213 },
  { pattern: /^sweet potatoes?\b.*\braw/i, label: "1 medium sweet potato", grams: 130 },
];

/**
 * Pattern-match a USDA description against the natural-serving hints.
 * Returns a populated `PrimaryServing` when matched, else null.
 *
 * `per100g` must be the row's per-100g macro envelope (USDA inline
 * `foodNutrients`). The serving's kcal / macros are scaled
 * deterministically via `scalePrimaryServingFromPer100g` so unit tests
 * can lock the arithmetic.
 */
export function inferNaturalServingFromName(
  description: string,
  per100g: MacrosPer100gLite,
  isVerified: boolean,
): PrimaryServing | null {
  if (!isVerified) return null;
  if (!description) return null;
  const trimmed = description.trim();
  if (!trimmed) return null;
  for (const hint of NATURAL_SERVING_HINTS) {
    if (hint.pattern.test(trimmed)) {
      return scalePrimaryServingFromPer100g(per100g, hint.label, hint.grams);
    }
  }
  return null;
}
