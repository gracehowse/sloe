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

// FDA 2016 Daily Values — FatSecret returns calcium/iron/vitamins as a
// percentage of these (%DV), not absolute units. Verified live 2026-05-26
// across generic + branded + fortified foods (see fatSecretServingMicrosPer100g).
const DV_CALCIUM_MG = 1300;
const DV_IRON_MG = 18;
const DV_VITAMIN_A_MCG = 900; // mcg RAE
const DV_VITAMIN_C_MG = 90;
const DV_VITAMIN_D_MCG = 20;

/** Convert a FatSecret %DV field (e.g. calcium="55") to absolute units. */
function dvToAbsolute(percentRaw: string | undefined, dvReference: number): number {
  const pct = num(percentRaw);
  return pct > 0 ? (pct / 100) * dvReference : 0;
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
 * gap. 2026-05-26: calcium/iron/vitamins A/C/D now emitted too — they
 * arrive as %DV (FatSecret's %RDI), converted to absolute via the FDA
 * Daily Values (verified live across 6 foods; see the inline note +
 * docs/decisions/2026-05-26-fatsecret-percent-dv-micros.md).
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

  // Cholesterol + sodium + potassium — mg (Premier).
  emit("cholesterolMg", num(s.cholesterol), 0);
  emit("potassiumMg", num(s.potassium), 0);

  // Calcium / iron / vitamins (A / C / D) — FatSecret returns these as
  // %DV (percent of FDA Daily Value), NOT mg, for the described serving.
  // Convert to absolute units with the FDA 2016 Daily Values before the
  // (per-serving → per-100g) scale that `emit` applies.
  //
  // 2026-05-26: re-verified live against 6 foods (cheddar, orange, spinach,
  // Big Mac, Total cereal, fortified puffed rice) — every value is cleanly
  // %DV and converts to within a few % of USDA reality (cheddar Ca 55%→715mg
  // vs 720; spinach Fe 15%→2.7mg vs 2.7; Big Mac Ca 9%→117mg vs ~115; Total
  // Fe 100%→18mg = exactly the DV). The earlier "inconsistent units" note was
  // a mis-estimate of the Big Mac's real calcium (~115mg, not ~280mg). See
  // docs/decisions/2026-05-26-fatsecret-percent-dv-micros.md.
  emit("calciumMg", dvToAbsolute(s.calcium, DV_CALCIUM_MG), 0);
  emit("ironMg", dvToAbsolute(s.iron, DV_IRON_MG), 1);
  emit("vitaminAMcgRae", dvToAbsolute(s.vitamin_a, DV_VITAMIN_A_MCG), 0);
  emit("vitaminCMg", dvToAbsolute(s.vitamin_c, DV_VITAMIN_C_MG), 1);
  emit("vitaminDMcg", dvToAbsolute(s.vitamin_d, DV_VITAMIN_D_MCG), 1);

  return out;
}

/**
 * Return the per-serving (absolute, NOT per-100g) micronutrient
 * panel from a FatSecret serving. Used when the food has no metric
 * grounding (`metric_serving_amount` absent, e.g. McDonald's Big
 * Mac). The values are committed × quantity at log time, no gram
 * scaling.
 *
 * Same unit-safety rules as the per-100g extractor: only emit
 * fields whose units are reliably absolute (g for fat breakdown +
 * fiber + sugar, mg for cholesterol + sodium + potassium). Skip
 * calcium / iron / vitamins for unit ambiguity (see comment in the
 * per-100g extractor above).
 */
export function fatSecretServingMicrosAbsolute(
  s: FatSecretServing,
): Record<string, number> {
  const out: Record<string, number> = {};
  function emit(key: string, raw: number, decimals: number): void {
    if (!Number.isFinite(raw) || raw <= 0) return;
    const f = 10 ** decimals;
    const rounded = Math.round(raw * f) / f;
    if (rounded > 0) out[key] = rounded;
  }
  emit("fiberG", num(s.fiber), 1);
  emit("sugarG", num(s.sugar), 1);
  emit("sodiumMg", num(s.sodium), 0);
  emit("saturatedFatG", num(s.saturated_fat), 1);
  emit("monoFatG", num(s.monounsaturated_fat), 1);
  emit("polyFatG", num(s.polyunsaturated_fat), 1);
  emit("transFatG", num(s.trans_fat), 1);
  emit("cholesterolMg", num(s.cholesterol), 0);
  emit("potassiumMg", num(s.potassium), 0);
  // %DV → absolute (no gram scaling here — these are per-serving absolute).
  emit("calciumMg", dvToAbsolute(s.calcium, DV_CALCIUM_MG), 0);
  emit("ironMg", dvToAbsolute(s.iron, DV_IRON_MG), 1);
  emit("vitaminAMcgRae", dvToAbsolute(s.vitamin_a, DV_VITAMIN_A_MCG), 0);
  emit("vitaminCMg", dvToAbsolute(s.vitamin_c, DV_VITAMIN_C_MG), 1);
  emit("vitaminDMcg", dvToAbsolute(s.vitamin_d, DV_VITAMIN_D_MCG), 1);
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

