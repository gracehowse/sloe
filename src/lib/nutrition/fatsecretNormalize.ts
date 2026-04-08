import type { FatSecretServing } from "@/lib/fatsecret/client";

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

export function servingMassGrams(s: FatSecretServing): number | null {
  const amt = Number.parseFloat(String(s.metric_serving_amount ?? ""));
  if (!Number.isFinite(amt) || amt <= 0) return null;
  const unit = String(s.metric_serving_unit ?? "").toLowerCase();
  if (unit === "g" || unit === "gram" || unit === "grams") return amt;
  if (unit === "ml") return amt; // assume water density unless overridden at caller
  return null;
}

