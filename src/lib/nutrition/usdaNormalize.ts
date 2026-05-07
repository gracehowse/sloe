import type { FdcFood, FdcNutrient } from "@/lib/usda/fdcClient";

export type VerifiedMacros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  /**
   * Caffeine + alcohol per 100 g — extracted from USDA's
   * `Caffeine` (nutrient id 1057 / number 262) and `Alcohol, ethyl`
   * (id 1018 / number 221) entries when present. Returned as
   * `null` when the USDA record doesn't publish that nutrient
   * (project rule: no invented nutrition values).
   *
   * Audit 2026-05-05 (Grace): the previous shape had no field for
   * either, so a USDA-sourced wine / coffee / cosmopolitan logged
   * via the food search produced a `nutrition_micros.alcoholG = null`
   * row, so wine + coffee logs vanished from the chip totals. Adding
   * these fields closes the gap end-to-end:
   * `fdcFoodMacrosPer100g` extracts → API route returns →
   * `getFoodMacros` reads → `handleFoodSearchSelect` scales → meal
   * row's `nutrition_micros.{caffeineMg,alcoholG}` carries it through.
   * Per-meal micros is the canonical SoT (F-74 / F-103, 2026-05-07);
   * the Today chip totals sum it at render.
   */
  caffeineMgPer100g: number | null;
  alcoholGPer100g: number | null;
};

function safeNumber(x: unknown): number {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  const v = Number.parseFloat(String(x ?? ""));
  return Number.isFinite(v) ? v : 0;
}

function nutrientLabel(n: FdcNutrient): { name: string; unit: string; amount: number } {
  const name = String(n.nutrient?.name ?? n.nutrientName ?? "").trim();
  const unit = String(n.nutrient?.unitName ?? n.unitName ?? "").trim();
  const amount = safeNumber(n.amount);
  return { name, unit, amount };
}

function findAmount(food: FdcFood, matcher: (name: string) => boolean): { amount: number; unit: string } | null {
  const list = food.foodNutrients ?? [];
  for (const n of list) {
    const { name, unit, amount } = nutrientLabel(n);
    if (!name) continue;
    if (matcher(name.toLowerCase())) {
      return { amount, unit };
    }
  }
  return null;
}

/**
 * Same as `findAmount` but matches by USDA nutrient *number* (the
 * stable id, e.g. `"301"` for Calcium). USDA names are inconsistent
 * across SR Legacy / Foundation / Branded (e.g. "Iron, Fe" vs "Iron"),
 * but the nutrient number is canonical, so the micro extractor pins
 * by number first and only falls back to name when no number-match is
 * found.
 */
function findAmountByNumber(
  food: FdcFood,
  num: string,
  nameFallback?: (name: string) => boolean,
): { amount: number; unit: string } | null {
  const list = food.foodNutrients ?? [];
  for (const n of list) {
    const candidate = String(n.nutrient?.number ?? "").trim();
    if (candidate === num) {
      const { unit, amount } = nutrientLabel(n);
      return { amount, unit };
    }
  }
  if (nameFallback) return findAmount(food, nameFallback);
  return null;
}

function toMcg(amount: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u === "µg" || u === "ug" || u === "mcg") return amount;
  if (u === "mg") return amount * 1000;
  if (u === "g") return amount * 1_000_000;
  return amount;
}

function toGrams(amount: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u === "g") return amount;
  if (u === "mg") return amount / 1000;
  if (u === "µg" || u === "ug") return amount / 1_000_000;
  return amount;
}

function toMg(amount: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u === "mg") return amount;
  if (u === "g") return amount * 1000;
  return amount;
}

export function fdcFoodMacrosPer100g(food: FdcFood): VerifiedMacros {
  const energy = findAmount(food, (n) => n === "energy" || n.includes("energy"));
  const protein = findAmount(food, (n) => n === "protein");
  const fat = findAmount(food, (n) => n.includes("total lipid") || n === "fat");
  const carbs = findAmount(food, (n) => n.includes("carbohydrate") || n === "carbohydrates");
  const fiber = findAmount(food, (n) => n.includes("fiber"));
  const sugar = findAmount(food, (n) => n.includes("sugars, total") || n === "sugars") ??
    findAmount(food, (n) => n.includes("sugars"));
  const sodium = findAmount(food, (n) => n === "sodium, na" || n === "sodium");
  // Caffeine — USDA names this exactly "Caffeine"; never conflate with
  // "caffeic acid" or other compounds.
  const caffeine = findAmount(food, (n) => n === "caffeine");
  // Alcohol — USDA's canonical name is "Alcohol, ethyl". Some Branded
  // / SR Legacy rows lower-case it as "alcohol, ethyl"; both match.
  const alcohol = findAmount(food, (n) => n === "alcohol, ethyl" || n === "alcohol");

  // Energy is usually kcal in FDC ("KCAL"). If it's kJ, convert.
  let kcal = energy ? energy.amount : 0;
  const eu = energy?.unit?.toLowerCase() ?? "";
  if (eu === "kj") kcal = kcal / 4.184;

  return {
    calories: Math.max(0, kcal),
    protein: Math.max(0, toGrams(protein?.amount ?? 0, protein?.unit ?? "g")),
    carbs: Math.max(0, toGrams(carbs?.amount ?? 0, carbs?.unit ?? "g")),
    fat: Math.max(0, toGrams(fat?.amount ?? 0, fat?.unit ?? "g")),
    fiberG: Math.max(0, toGrams(fiber?.amount ?? 0, fiber?.unit ?? "g")),
    sugarG: Math.max(0, toGrams(sugar?.amount ?? 0, sugar?.unit ?? "g")),
    sodiumMg: Math.max(0, toMg(sodium?.amount ?? 0, sodium?.unit ?? "mg")),
    // `null` when the USDA record didn't publish the nutrient (project
    // rule: no invented values). Positive amount → return as-is; zero
    // amount → still null since USDA returns 0 for "not measured" on
    // some rows and we'd rather null than fabricate "0 caffeine in
    // your espresso".
    caffeineMgPer100g:
      caffeine && caffeine.amount > 0
        ? Math.max(0, toMg(caffeine.amount, caffeine.unit ?? "mg"))
        : null,
    alcoholGPer100g:
      alcohol && alcohol.amount > 0
        ? Math.max(0, toGrams(alcohol.amount, alcohol.unit ?? "g"))
        : null,
  };
}

/**
 * Extract the per-100g micronutrient panel from a USDA FDC food into
 * the canonical `nutrition_micros` shape (same key set as
 * `parseOffMicrosPer100g` and `MICRO_LINES`).
 *
 * Why per-100g? USDA FDC always returns nutrients on a per-100g basis
 * (canonical FDC convention). The downstream `scaleMicrosForGrams`
 * helper scales this map by `grams / 100` at log time.
 *
 * Lookup is by USDA nutrient *number* first (stable across data types),
 * with name-match fallbacks for the rare row that ships only the name.
 * Zero / non-finite values are dropped — never invent.
 *
 * 2026-05-06: TestFlight feedback — every USDA-sourced meal showed
 * "USDA FoodData Central did not publish vitamin or mineral data".
 * Diagnosis: only the macro extractor (`fdcFoodMacrosPer100g`) was
 * being called; the micro panel was discarded. This extractor + the
 * route/client/UI plumbing closes that gap.
 */
export function fdcFoodMicrosPer100g(food: FdcFood): Record<string, number> {
  const out: Record<string, number> = {};

  function emit(key: string, raw: number | null | undefined, decimals: number): void {
    if (raw == null || !Number.isFinite(raw) || raw <= 0) return;
    const factor = 10 ** decimals;
    const rounded = Math.round(raw * factor) / factor;
    if (rounded > 0) out[key] = rounded;
  }

  // Convenience wrappers — read the curated nutrient and convert to
  // the canonical unit before emit.
  function readG(key: string, num: string, names: string[], decimals = 1): void {
    const r = findAmountByNumber(food, num, (n) => names.some((x) => n.includes(x)));
    if (!r) return;
    emit(key, toGrams(r.amount, r.unit ?? "g"), decimals);
  }
  function readMg(key: string, num: string, names: string[], decimals = 1): void {
    const r = findAmountByNumber(food, num, (n) => names.some((x) => n.includes(x)));
    if (!r) return;
    emit(key, toMg(r.amount, r.unit ?? "mg"), decimals);
  }
  function readMcg(key: string, num: string, names: string[], decimals = 0): void {
    const r = findAmountByNumber(food, num, (n) => names.some((x) => n.includes(x)));
    if (!r) return;
    emit(key, toMcg(r.amount, r.unit ?? "µg"), decimals);
  }

  // Macros that double as micros (already in macros block too — emit
  // here so OFF/Edamam/USDA paths produce a uniform map).
  readG("fiberG", "291", ["fiber"], 1);
  readG("sugarG", "269", ["sugars, total", "sugars"], 1);
  readMg("sodiumMg", "307", ["sodium, na", "sodium"], 0);

  // Fat breakdown.
  readG("saturatedFatG", "606", ["fatty acids, total saturated", "saturated"], 1);
  readG("monoFatG", "645", ["fatty acids, total monounsaturated", "monounsaturated"], 1);
  readG("polyFatG", "646", ["fatty acids, total polyunsaturated", "polyunsaturated"], 1);
  readG("transFatG", "605", ["fatty acids, total trans", "trans"], 1);

  // Cholesterol.
  readMg("cholesterolMg", "601", ["cholesterol"], 0);

  // Major minerals.
  readMg("calciumMg", "301", ["calcium"], 0);
  readMg("ironMg", "303", ["iron"], 1);
  readMg("magnesiumMg", "304", ["magnesium"], 0);
  readMg("phosphorusMg", "305", ["phosphorus"], 0);
  readMg("potassiumMg", "306", ["potassium"], 0);
  readMg("zincMg", "309", ["zinc"], 1);
  readMg("copperMg", "312", ["copper"], 2);
  readMg("manganeseMg", "315", ["manganese"], 2);

  // Trace minerals (mcg).
  readMcg("seleniumMcg", "317", ["selenium"], 0);
  readMcg("iodineMcg", "314", ["iodine"], 0);

  // B vitamins.
  readMg("thiaminMg", "404", ["thiamin"], 2);
  readMg("riboflavinMg", "405", ["riboflavin"], 2);
  readMg("niacinMg", "406", ["niacin"], 1);
  readMg("pantothenicAcidMg", "410", ["pantothenic"], 2);
  readMg("vitaminB6Mg", "415", ["vitamin b-6", "vitamin b6"], 2);
  readMcg("biotinMcg", "416", ["biotin"], 0);
  readMcg("folateMcg", "435", ["folate, dfe"], 0);
  // Folate fallback: use raw "folate, total" (id 417) when DFE missing.
  if (!out.folateMcg) readMcg("folateMcg", "417", ["folate, total"], 0);
  readMcg("vitaminB12Mcg", "418", ["vitamin b-12", "vitamin b12"], 1);

  // Other vitamins.
  readMg("vitaminCMg", "401", ["vitamin c"], 1);
  readMcg("vitaminDMcg", "328", ["vitamin d (d2 + d3)", "vitamin d"], 1);
  readMg("vitaminEMg", "323", ["vitamin e (alpha-tocopherol)", "vitamin e"], 1);
  readMcg("vitaminKMcg", "430", ["vitamin k (phylloquinone)", "vitamin k"], 1);
  readMcg("vitaminAMcgRae", "320", ["vitamin a, rae"], 0);

  return out;
}

