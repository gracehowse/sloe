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
   * row and the daily `extra_alcohol_g_by_day` / `extra_caffeine_by_day`
   * stamp short-circuited at zero. The Today caffeine/alcohol charts
   * read from those daily totals, so wine + coffee logs vanished
   * silently. Adding these fields closes the gap end-to-end:
   * `fdcFoodMacrosPer100g` extracts → API route returns →
   * `getFoodMacros` reads → `handleFoodSearchSelect` scales →
   * `bumpStimulantsForLoggedMeal` writes.
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

