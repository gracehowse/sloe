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
 * Extract the per-100g micronutrient panel from a picked FatSecret
 * serving. Premier-tier responses ship the wider panel
 * (saturated/poly/mono/trans fat, cholesterol, potassium, calcium,
 * iron); Basic responses don't, so most fields will be absent.
 *
 * Returns an empty object if `gramsPerServing` is non-positive (no
 * metric grounding to scale by), or if every Premier field is absent.
 *
 * 2026-05-06: TestFlight feedback — FatSecret-sourced meals showed
 * "FatSecret did not publish vitamin or mineral data" because the
 * food route never plumbed micros through. This extractor closes that
 * gap. Vitamins (A/C/D) are intentionally skipped — FatSecret returns
 * them in inconsistent units across response shapes, so we'd risk
 * fabricated mcg-vs-IU values.
 */
export function fatSecretServingMicrosPer100g(
  s: FatSecretServing,
  gramsPerServing: number,
): Record<string, number> {
  if (!gramsPerServing || gramsPerServing <= 0) return {};
  const factor = 100 / gramsPerServing;
  const out: Record<string, number> = {};

  function emit(key: string, perServing: number, decimals: number): void {
    if (!Number.isFinite(perServing) || perServing <= 0) return;
    const per100 = perServing * factor;
    if (!Number.isFinite(per100) || per100 <= 0) return;
    const f = 10 ** decimals;
    const rounded = Math.round(per100 * f) / f;
    if (rounded > 0) out[key] = rounded;
  }

  // Macros that double as micros — keeps the map shape uniform with
  // OFF/USDA so the meal-detail panel renders fiber/sugar/sodium
  // rows from FatSecret too.
  emit("fiberG", num(s.fiber), 1);
  emit("sugarG", num(s.sugar), 1);
  emit("sodiumMg", num(s.sodium), 0);

  // Fat breakdown — grams (Premier).
  emit("saturatedFatG", num(s.saturated_fat), 1);
  emit("monoFatG", num(s.monounsaturated_fat), 1);
  emit("polyFatG", num(s.polyunsaturated_fat), 1);
  emit("transFatG", num(s.trans_fat), 1);

  // Cholesterol + minerals — mg (Premier).
  emit("cholesterolMg", num(s.cholesterol), 0);
  emit("potassiumMg", num(s.potassium), 0);
  emit("calciumMg", num(s.calcium), 0);
  emit("ironMg", num(s.iron), 1);

  // Vitamins (A / C / D) — intentionally NOT emitted. FatSecret
  // returns these in inconsistent units (sometimes %DV, sometimes
  // raw IU/mcg/mg) and the canonical micro keys expect specific
  // units (mcg RAE for A, mg for C, mcg for D). Emitting without
  // unit certainty would produce wrong numbers.

  return out;
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

