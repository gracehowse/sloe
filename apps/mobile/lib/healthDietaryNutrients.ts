/**
 * Apple Health dietary import: permission keys (react-native-health / HealthKit),
 * conversion from HK sample units into `nutrition_micros` JSON, and journal display.
 * Goal: parity with typical third-party apps / other apps → Health exports (macros + full micro panel).
 */

import {
  buildDayNutrientDetailRows,
  formatMealNutritionMultiline,
  humanizeNutrientKey,
  listMicroNutrientsCompleteDisplay,
  listMicroNutrientsForDisplay,
  mealContributedFiberG,
  round1,
  sumDayFiberFromMeals,
  sumMicrosFromLoggedMeals,
  type MealNutritionDisplayInput,
  type MicroNutrientDisplayRow,
} from "@suppr/nutrition-core/microNutrientDisplay";

export {
  buildDayNutrientDetailRows,
  formatMealNutritionMultiline,
  humanizeNutrientKey,
  listMicroNutrientsCompleteDisplay,
  listMicroNutrientsForDisplay,
  mealContributedFiberG,
  round1,
  sumDayFiberFromMeals,
  sumMicrosFromLoggedMeals,
  type MealNutritionDisplayInput,
  type MicroNutrientDisplayRow,
};

/**
 * HK permission strings for `initHealthKit` read mapping.
 * Omit `FatTrans`: `HKQuantityTypeIdentifierDietaryFatTrans` was removed in newer HealthKit
 * SDKs; requesting it breaks authorization on device (Connect shows generic failure).
 */
/**
 * Small set for `initHealthKit` — MFP meal import needs these; requesting all
 * micro types in one native call has crashed the bridge on iOS 26+ (2026-06-05).
 */
export const HEALTH_DIETARY_CORE_PERMISSION_KEYS = [
  "EnergyConsumed",
  "Protein",
  "Carbohydrates",
  "FatTotal",
  "Fiber",
  "Sugar",
  "Sodium",
] as const;

export const HEALTH_DIETARY_IMPORT_PERMISSION_KEYS = [
  ...HEALTH_DIETARY_CORE_PERMISSION_KEYS,
  "FatSaturated",
  "FatMonounsaturated",
  "FatPolyunsaturated",
  "Cholesterol",
  "Caffeine",
  "Calcium",
  "Iron",
  "Magnesium",
  "Phosphorus",
  "Potassium",
  "Zinc",
  "Copper",
  "Selenium",
  "Manganese",
  "Molybdenum",
  "Iodine",
  // Chromium omitted — not in react-native-health Permissions (1.19); requesting it in
  // initHealthKit can crash the native bridge on device (2026-06-05 HS connect).
  "Chloride",
  "Thiamin",
  "Riboflavin",
  "Niacin",
  "PantothenicAcid",
  "VitaminB6",
  "Biotin",
  "Folate",
  "VitaminB12",
  "VitaminC",
  "VitaminD",
  "VitaminE",
  "VitaminK",
  "VitaminA",
] as const;

export type HealthDietaryImportPermissionKey = (typeof HEALTH_DIETARY_IMPORT_PERMISSION_KEYS)[number];

export function unitForDietaryImportKey(key: string): "gram" | "kilocalorie" {
  return key === "EnergyConsumed" ? "kilocalorie" : "gram";
}

function roundInt(n: number): number {
  return Math.max(0, Math.round(n));
}

/**
 * Map correlated HK totals (grams for mass nutrients, kcal for energy — not stored here)
 * into `fiber_g` + `nutrition_micros` store shape.
 */
export function buildFiberAndMicrosFromHealthTotals(totals: Readonly<Record<string, number>>): {
  fiberG: number | null;
  micros: Record<string, number>;
} {
  const g = (k: string): number => totals[k] ?? 0;

  const fiberRaw = g("Fiber");
  const fiberG = fiberRaw > 0 ? round1(fiberRaw) : null;

  const micros: Record<string, number> = {};
  const pushG = (outKey: string, valG: number) => {
    if (valG > 0) micros[outKey] = round1(valG);
  };
  const pushMgFromG = (outKey: string, valG: number) => {
    const mg = valG * 1000;
    if (mg > 0) micros[outKey] = roundInt(mg);
  };
  const pushMcgFromG = (outKey: string, valG: number) => {
    const mcg = valG * 1e6;
    if (mcg > 0) micros[outKey] = roundInt(mcg);
  };

  pushG("sugarG", g("Sugar"));
  pushMgFromG("sodiumMg", g("Sodium"));
  pushG("saturatedFatG", g("FatSaturated"));
  pushMgFromG("cholesterolMg", g("Cholesterol"));

  pushG("monoFatG", g("FatMonounsaturated"));
  pushG("polyFatG", g("FatPolyunsaturated"));
  pushG("transFatG", g("FatTrans"));

  const cafMg = g("Caffeine") * 1000;
  if (cafMg > 0) micros.caffeineMg = roundInt(cafMg);

  pushMgFromG("calciumMg", g("Calcium"));
  pushMgFromG("ironMg", g("Iron"));
  pushMgFromG("magnesiumMg", g("Magnesium"));
  pushMgFromG("phosphorusMg", g("Phosphorus"));
  pushMgFromG("potassiumMg", g("Potassium"));
  pushMgFromG("zincMg", g("Zinc"));
  pushMgFromG("copperMg", g("Copper"));
  pushMcgFromG("seleniumMcg", g("Selenium"));
  pushMgFromG("manganeseMg", g("Manganese"));
  pushMcgFromG("molybdenumMcg", g("Molybdenum"));
  pushMcgFromG("iodineMcg", g("Iodine"));
  pushMgFromG("chlorideMg", g("Chloride"));

  pushMgFromG("thiaminMg", g("Thiamin"));
  pushMgFromG("riboflavinMg", g("Riboflavin"));
  pushMgFromG("niacinMg", g("Niacin"));
  pushMgFromG("pantothenicAcidMg", g("PantothenicAcid"));
  pushMgFromG("vitaminB6Mg", g("VitaminB6"));
  pushMcgFromG("biotinMcg", g("Biotin"));
  pushMcgFromG("folateMcg", g("Folate"));
  pushMcgFromG("vitaminB12Mcg", g("VitaminB12"));
  pushMgFromG("vitaminCMg", g("VitaminC"));
  pushMcgFromG("vitaminDMcg", g("VitaminD"));
  pushMgFromG("vitaminEMg", g("VitaminE"));
  pushMcgFromG("vitaminKMcg", g("VitaminK"));
  pushMcgFromG("vitaminAMcgRae", g("VitaminA"));

  return { fiberG, micros };
}
