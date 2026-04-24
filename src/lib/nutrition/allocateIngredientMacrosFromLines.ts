/**
 * **Offline fallback only.** When `/api/nutrition/verify-recipe` cannot run
 * (no session, no API base URL, rate limit, etc.), derive per-line macros by:
 *   1) parsing each line → `estimateLineMacros` (staples / local math, no DB),
 *   2) scaling so summed calories match the recipe’s **full-dish** total
 *      (`perServingCalories * servings`),
 *   3) if every line estimates to 0 kcal but the recipe has a calorie total,
 *      split calories evenly across lines (rough fallback).
 *
 * Prefer the verify pipeline (USDA / OFF / FatSecret / Edamam / Suppr foods) on
 * the recipe detail screen and in seed scripts when the API is available —
 * same match-first behaviour users expect from apps like MyFitnessPal.
 *
 * Ingredient rows in Supabase store **whole-recipe** totals per line (same
 * contract as `/api/nutrition/verify-recipe` updates).
 */

import { estimateLineMacros, type MacroBreakdown } from "./estimateIngredientMacros";
import { parseIngredientLine } from "../recipe-ingredients/parseIngredientLine";

export type FilledLineMacros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  confidence: number | null;
  /** Short machine label for `recipe_ingredients.source` / debugging. */
  source: string;
};

function scaleMacroRow(e: MacroBreakdown, factor: number): Omit<FilledLineMacros, "confidence" | "source"> {
  return {
    calories: Math.max(0, Math.round(e.calories * factor)),
    protein: Math.max(0, Math.round(e.protein * factor * 10) / 10),
    carbs: Math.max(0, Math.round(e.carbs * factor * 10) / 10),
    fat: Math.max(0, Math.round(e.fat * factor * 10) / 10),
    fiber_g: Math.max(0, Math.round(e.fiberG * factor * 10) / 10),
    sugar_g: e.sugarG == null ? 0 : Math.max(0, Math.round(e.sugarG * factor * 10) / 10),
    sodium_mg: e.sodiumMg == null ? 0 : Math.max(0, Math.round(e.sodiumMg * factor)),
  };
}

/**
 * @param ingredientLines One string per ingredient (often the full JSON-LD line incl. amount).
 * @param perServingCalories `recipes.calories` (per serving).
 * @param servings `recipes.servings` (≥ 1).
 */
export function allocateIngredientMacrosFromLines(
  ingredientLines: string[],
  perServingCalories: number,
  servings: number,
): FilledLineMacros[] {
  const n = ingredientLines.length;
  if (n === 0) return [];

  const srv = Math.max(1, Math.round(servings));
  const targetFullRecipeCal = Math.max(0, Math.round(perServingCalories * srv));

  const estimates = ingredientLines.map((line) => {
    const p = parseIngredientLine(line);
    return estimateLineMacros({ name: p.name, amount: p.amount, unit: p.unit });
  });

  const sumCal = estimates.reduce((s, e) => s + e.calories, 0);

  if (sumCal > 0 && targetFullRecipeCal > 0) {
    const factor = targetFullRecipeCal / sumCal;
    return estimates.map((e) => ({
      ...scaleMacroRow(e, factor),
      confidence: e.confidence ?? null,
      source: "estimated_scaled",
    }));
  }

  if (targetFullRecipeCal > 0) {
    const perCal = Math.round(targetFullRecipeCal / n);
    return Array.from({ length: n }, () => ({
      calories: perCal,
      protein: Math.round((perCal * 0.15) / 4),
      carbs: Math.round((perCal * 0.55) / 4),
      fat: Math.max(0, Math.round((perCal * 0.3) / 9)),
      fiber_g: 0,
      sugar_g: 0,
      sodium_mg: 0,
      confidence: 0.15,
      source: "split_recipe_total",
    }));
  }

  return estimates.map((e) => ({
    calories: e.calories,
    protein: e.protein,
    carbs: e.carbs,
    fat: e.fat,
    fiber_g: e.fiberG,
    sugar_g: e.sugarG ?? 0,
    sodium_mg: e.sodiumMg ?? 0,
    confidence: e.confidence ?? null,
    source: "estimated",
  }));
}
