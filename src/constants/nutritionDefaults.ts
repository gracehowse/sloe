/**
 * App-wide default nutrition targets — shared between web + mobile so
 * the Reset and Erase flows on both platforms hit identical defaults.
 *
 * Used as fallbacks when a user has not yet set their own targets in
 * their profile. Keep this as the SINGLE source of truth — never
 * hardcode target numbers elsewhere.
 *
 * Typed as `number` (not `as const` literals) so `useState(NUTRITION_DEFAULTS.steps)`
 * etc. infer `number`, not literal types like `10000`.
 *
 * 2026-04-30 (#15): split out of `apps/mobile/constants/nutritionDefaults.ts`
 * so `src/lib/account/nukeAccountData.ts` can be imported from the web
 * Settings page. The mobile copy now re-exports from this file.
 */
export type NutritionDefaults = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  water: number;
  steps: number;
};

export const NUTRITION_DEFAULTS: NutritionDefaults = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fat: 65,
  fiber: 28,
  water: 2000,
  steps: 10000,
};
