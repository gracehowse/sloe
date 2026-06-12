import { scaleMicrosForGrams } from "../openFoodFacts/parseOffMicros";
import { isPerServingPortion } from "./foodSearchCore";
import {
  listMicroNutrientsForDisplay,
  type MicroNutrientDisplayRow,
} from "./microNutrientDisplay";

/** Scaled hero macros for the food-search preview card (per chosen portion × quantity). */
export type FoodSearchPreviewScaledMacros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
};

export type FoodSearchPreviewPortion = {
  gramWeight: number;
  servingFraction?: number;
};

export type FoodSearchPreviewNutritionInput = {
  scaledMacros: FoodSearchPreviewScaledMacros | null;
  microsPer100g?: Record<string, number>;
  microsPerServing?: Record<string, number>;
  hasMacrosPerServing: boolean;
  chosenPortion: FoodSearchPreviewPortion;
  quantity: number;
};

const CORE_MICRO_KEYS = new Set(["fiberG", "sugarG", "sodiumMg"]);

function scaleMicrosPerServing(
  microsPerServing: Record<string, number>,
  quantity: number,
  servingFraction: number,
): Record<string, number> {
  const q = quantity * servingFraction;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(microsPerServing)) {
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) continue;
    const scaled = v * q;
    if (!Number.isFinite(scaled) || scaled <= 0) continue;
    const decimals = k.endsWith("G") ? 1 : 0;
    const factor = 10 ** decimals;
    out[k] = Math.round(scaled * factor) / factor;
  }
  return out;
}

/** Scale vendor micros (OFF per-100g, FatSecret per-serving) to the preview portion. */
export function scaledPreviewMicros(
  input: FoodSearchPreviewNutritionInput,
): Record<string, number> {
  const { microsPer100g, microsPerServing, hasMacrosPerServing, chosenPortion, quantity } =
    input;
  if (
    isPerServingPortion({
      gramWeight: chosenPortion.gramWeight,
      hasMacrosPerServing,
    })
  ) {
    return scaleMicrosPerServing(
      microsPerServing ?? {},
      quantity,
      chosenPortion.servingFraction ?? 1,
    );
  }
  if (!microsPer100g) return {};
  const grams = chosenPortion.gramWeight * quantity;
  return scaleMicrosForGrams(microsPer100g, grams);
}

/**
 * Extra micronutrient rows for the search preview (sat fat, cholesterol,
 * potassium, vitamins, …). Fibre / sugar / sodium stay on the hero macro
 * rows so we do not duplicate them here.
 */
export function foodSearchPreviewExtraMicroRows(
  input: FoodSearchPreviewNutritionInput,
): MicroNutrientDisplayRow[] {
  if (!input.scaledMacros) return [];
  const scaled = scaledPreviewMicros(input);
  return listMicroNutrientsForDisplay(scaled).filter((r) => !CORE_MICRO_KEYS.has(r.key));
}
