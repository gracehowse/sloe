import type { FatSecretServing } from "@/lib/fatsecret/client";
import { measureToGrams } from "./measureToGrams";

export type VerifiedMacros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
};

function num(x: string | undefined): number {
  if (!x) return 0;
  const v = Number.parseFloat(String(x));
  return Number.isFinite(v) ? v : 0;
}

export function normalizeServingToMacros(s: FatSecretServing): VerifiedMacros {
  return {
    calories: Math.max(0, Math.round(num(s.calories))),
    protein: Math.max(0, num(s.protein)),
    carbs: Math.max(0, num(s.carbohydrate)),
    fat: Math.max(0, num(s.fat)),
    fiberG: Math.max(0, num(s.fiber)),
    sugarG: Math.max(0, num(s.sugar)),
    sodiumMg: Math.max(0, num(s.sodium)),
  };
}

export function pickBestServing(serving: FatSecretServing | FatSecretServing[]): FatSecretServing {
  const list = Array.isArray(serving) ? serving : [serving];
  // Prefer metric servings when present (usually includes grams/ml).
  const metric = list.find((s) => Number.parseFloat(String(s.metric_serving_amount ?? "")) > 0);
  return metric ?? list[0] ?? {};
}

/**
 * Extract gram weight from a FatSecret serving.
 * Tries metric fields first, then parses the serving_description
 * (e.g. "1 cup", "2 oz") using measureToGrams as fallback.
 */
export function servingMassGrams(s: FatSecretServing): number | null {
  const amt = Number.parseFloat(String(s.metric_serving_amount ?? ""));
  if (Number.isFinite(amt) && amt > 0) {
    const unit = String(s.metric_serving_unit ?? "").toLowerCase();
    if (unit === "g" || unit === "gram" || unit === "grams") return amt;
    if (unit === "ml") return amt;
  }
  // Fallback: parse serving_description like "1 cup" or "2 oz"
  const desc = String(s.serving_description ?? "").trim();
  if (!desc) return null;
  const m = desc.match(/^([\d.]+)\s*(.+)$/);
  if (m) {
    const n = Number.parseFloat(m[1]);
    const u = m[2].trim().toLowerCase();
    if (Number.isFinite(n) && n > 0 && u) {
      // Use measureToGrams for common units (cup, oz, tbsp, etc.)
      const grams = measureToGrams({ name: "", amount: n, unit: u });
      // Only use if it's a recognised unit (not the 80g catch-all)
      if (grams !== n * 80) return grams;
    }
  }
  return null;
}

