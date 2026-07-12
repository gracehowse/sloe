/**
 * ENG-1502 (extraction pass, screen-budget ratchet ENG-621/717) —
 * `buildGenericMatchRow`, lifted byte-for-byte out of the web
 * `FoodSearchPanel.tsx`. Builds the curated Suppr generic-food /
 * generic-beverage row for a query ("coffee", "banana", …) so the search
 * list can answer common single foods instantly with verified data.
 * The returned shape is a structural subset of the panel's `SearchResult`
 * (same pattern as `customFoodToHit` in `foodSearchCore.ts`).
 *
 * Mobile mirror: the generic-row construction inside
 * `unifiedFoodSearch` (mobile lib) — kept separate because the mobile
 * builder participates in that lib's own merge pipeline.
 */
import { matchGenericBeverage } from "./genericBeverages";
import { matchGenericFood } from "./genericFoods";
import { genericFoodMicrosPer100g } from "./genericFoodMicros";
import type { PrimaryServing } from "./primaryServing";

export type GenericMatchRow = {
  key: string;
  name: string;
  subtitle?: string;
  _source: "GenericBeverage" | "GenericFood";
  /** Curated Suppr rows are verified data (feeds the ENG-1502 trust bit). */
  verified: true;
  macrosPer100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiberG: number;
    sugarG: number;
    sodiumMg: number;
    caffeineMgPer100g?: number | null;
    alcoholGPer100g?: number | null;
  };
  microsPer100g?: Record<string, number>;
  calsPer100g: number;
  primaryServing: PrimaryServing;
};

export function buildGenericMatchRow(query: string): GenericMatchRow | null {
  const q = query.trim();
  if (!q) return null;
  const beverage = matchGenericBeverage(q);
  if (beverage) {
    const servingG = beverage.servingMl;
    return {
      key: `generic-beverage:${beverage.id}`,
      name: beverage.name,
      subtitle: beverage.subtitle,
      _source: "GenericBeverage",
      verified: true,
      macrosPer100g: {
        calories: beverage.per100ml.calories,
        protein: beverage.per100ml.protein,
        carbs: beverage.per100ml.carbs,
        fat: beverage.per100ml.fat,
        fiberG: 0,
        sugarG: 0,
        sodiumMg: 0,
        caffeineMgPer100g: beverage.caffeineMgPer100ml,
        alcoholGPer100g: beverage.alcoholGPer100ml ?? 0,
      },
      calsPer100g: beverage.per100ml.calories,
      primaryServing: {
        label: `${beverage.servingMl} ml`,
        grams: servingG,
        kcal: Math.round((beverage.per100ml.calories * servingG) / 100),
        protein: Math.round((beverage.per100ml.protein * servingG) / 100 * 10) / 10,
        carbs: Math.round((beverage.per100ml.carbs * servingG) / 100 * 10) / 10,
        fat: Math.round((beverage.per100ml.fat * servingG) / 100 * 10) / 10,
      },
    };
  }
  const food = matchGenericFood(q);
  if (food) {
    // ENG-738 — attach the baked per-100g USDA micronutrient panel for
    // this generic food so the meal-detail "Vitamins, minerals & more"
    // card populates after it's logged. Mirrors the OFF row, which also
    // carries `microsPer100g` at construction. `undefined` for an unbaked
    // id (the conditional spread keeps the key absent rather than null).
    const genericMicros = genericFoodMicrosPer100g(food.id);
    return {
      key: `generic-food:${food.id}`,
      name: food.name,
      subtitle: food.subtitle,
      _source: "GenericFood",
      verified: true,
      macrosPer100g: {
        calories: food.per100g.calories,
        protein: food.per100g.protein,
        carbs: food.per100g.carbs,
        fat: food.per100g.fat,
        fiberG: food.per100g.fiberG,
        sugarG: food.per100g.sugarG,
        sodiumMg: food.per100g.sodiumMg,
        caffeineMgPer100g: 0,
        alcoholGPer100g: 0,
      },
      ...(genericMicros ? { microsPer100g: genericMicros } : {}),
      calsPer100g: food.per100g.calories,
      primaryServing: {
        label: food.servingLabel,
        grams: food.servingG,
        kcal: Math.round((food.per100g.calories * food.servingG) / 100),
        protein: Math.round((food.per100g.protein * food.servingG) / 100 * 10) / 10,
        carbs: Math.round((food.per100g.carbs * food.servingG) / 100 * 10) / 10,
        fat: Math.round((food.per100g.fat * food.servingG) / 100 * 10) / 10,
      },
    };
  }
  return null;
}
