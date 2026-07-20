/**
 * ENG-1274 — estimated grocery cost per recipe (Pro signal).
 *
 * Honest posture:
 *   - static UK reference prices, not live retailer data
 *   - only high-confidence gram conversions (reuses measureToGramsConfidence)
 *   - only priced ingredients with a table match
 *   - returns a per-serving RANGE, not a false-precise single penny
 *   - returns null when coverage is too thin to show anything
 */
import { parseAmount } from "../planning/shoppingMergePrimitives";
import { measureToGrams, measureToGramsConfidence } from "../nutrition/measureToGrams";
import { cleanIngredientDisplayName } from "./cleanIngredientDisplayName";
import { lookupIngredientPrice } from "./ingredientPriceTable";

export type RecipeCostIngredient = {
  name: string;
  amount: string;
  unit: string;
};

export type RecipeCostEstimate = {
  /** Mid-point total recipe cost in GBP (all servings). */
  totalGbp: number;
  /** Per-serving range endpoints in GBP. */
  perServingLowGbp: number;
  perServingHighGbp: number;
  servings: number;
  /** Share of ingredient lines that contributed (0..1). */
  coverageRatio: number;
  /** Lines with both a price match and high-confidence grams. */
  pricedLineCount: number;
  totalLineCount: number;
};

const MIN_COVERAGE_RATIO = 0.5;
const MIN_PRICED_LINES = 2;
const RANGE_LOW_FACTOR = 0.85;
const RANGE_HIGH_FACTOR = 1.25;

function ingredientGrams(ing: RecipeCostIngredient): number | null {
  const amount = parseAmount(ing.amount);
  if (amount == null || amount <= 0) return null;
  const unit = (ing.unit ?? "").trim();
  const confidence = measureToGramsConfidence({
    name: ing.name,
    amount,
    unit,
  });
  if (confidence !== "high") return null;
  const grams = measureToGrams({ name: ing.name, amount, unit });
  return grams > 0 ? grams : null;
}

function lineCostGbp(ing: RecipeCostIngredient): number | null {
  const grams = ingredientGrams(ing);
  if (grams == null) return null;
  const displayName = cleanIngredientDisplayName(ing.name) || ing.name;
  const price = lookupIngredientPrice(displayName);
  if (!price) return null;
  if (price.perEach) {
    const count = parseAmount(ing.amount);
    if (count == null || count <= 0) return null;
    return count * price.gbpPer100g;
  }
  return (grams / 100) * price.gbpPer100g;
}

/**
 * Estimate the grocery cost for a recipe. Returns `null` when there are not
 * enough priced, high-confidence ingredient lines to show an honest figure.
 */
export function estimateRecipeCost(args: {
  ingredients: readonly RecipeCostIngredient[];
  servings: number;
}): RecipeCostEstimate | null {
  const servings = Math.max(1, Math.round(args.servings));
  const lines = args.ingredients.filter((ing) => (ing.name ?? "").trim().length > 0);
  if (lines.length === 0) return null;

  let pricedLineCount = 0;
  let totalGbp = 0;

  for (const ing of lines) {
    const cost = lineCostGbp(ing);
    if (cost == null) continue;
    pricedLineCount += 1;
    totalGbp += cost;
  }

  const coverageRatio = pricedLineCount / lines.length;
  if (pricedLineCount < MIN_PRICED_LINES || coverageRatio < MIN_COVERAGE_RATIO) {
    return null;
  }

  const lowTotal = totalGbp * RANGE_LOW_FACTOR;
  const highTotal = totalGbp * RANGE_HIGH_FACTOR;

  return {
    totalGbp,
    perServingLowGbp: lowTotal / servings,
    perServingHighGbp: highTotal / servings,
    servings,
    coverageRatio,
    pricedLineCount,
    totalLineCount: lines.length,
  };
}

/**
 * Format a per-serving cost label for the recipe-detail meta row.
 * Uses a range when the spread is meaningful; otherwise a single rounded value.
 */
export function formatRecipeCostServingLabel(estimate: RecipeCostEstimate): string {
  const low = estimate.perServingLowGbp;
  const high = estimate.perServingHighGbp;
  const spread = high - low;
  if (spread >= 0.3) {
    return `≈ ${formatGbp(low)}–${formatGbp(high)} / serving`;
  }
  const mid = (low + high) / 2;
  return `≈ ${formatGbp(mid)} / serving`;
}

/** Locked upsell copy for non-Pro viewers. */
export const RECIPE_COST_LOCKED_LABEL = "Est. cost";

export function formatGbp(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  if (rounded < 10) {
    return `£${rounded.toFixed(2)}`;
  }
  return `£${rounded.toFixed(2)}`;
}
