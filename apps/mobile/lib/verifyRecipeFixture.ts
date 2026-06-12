import type { VerifiableIngredient } from "@/lib/verifyRecipe";

/**
 * Pure predicate: did the verify-screen route params REQUEST fixture mode?
 *
 * Param-presence only — does NOT consult `__DEV__`. The caller composes this
 * with `&& __DEV__` so fixture mode is reachable ONLY in dev builds (audit
 * 2026-06-12 P2 #3 — the fixture rows + the no-write Save guard were shippable
 * in the release binary because the gate keyed on URL params alone). In a
 * release build a stale/forged `?fixture=1` then falls through to the normal
 * missing/stale-id path (the existing not-found behaviour).
 *
 * Kept separate from the `__DEV__` read so it's unit-testable without the RN
 * global (the composition `fixtureModeRequested(params) && __DEV__` is pinned
 * in `verifyRecipeFixture.test.ts`).
 *
 * Recognised shapes (unchanged from the original inline gate so the Maestro
 * deeplink `suppr:///recipe/verify?fixture=1` and any `?id=fixture` variant
 * keep working in dev):
 *   - `fixture=1` / `fixture=true`
 *   - `id=fixture`
 */
export function fixtureModeRequested(params: {
  id?: string;
  fixture?: string;
}): boolean {
  return (
    params.fixture === "1" ||
    params.fixture === "true" ||
    (typeof params.id === "string" && params.id === "fixture")
  );
}

/** Dev / Maestro fixture — matched ingredient rows for recipe verify (ENG-1066 / F-173). */
export const VERIFY_FIXTURE_RECIPE = {
  title: "Agent fixture — Greek salad",
  servings: 2,
} as const;

export const VERIFY_FIXTURE_INGREDIENTS: VerifiableIngredient[] = [
  {
    id: "fixture-feta",
    name: "feta cheese",
    amount: 100,
    unit: "g",
    calories: 264,
    protein: 14,
    carbs: 4,
    fat: 21,
    fiberG: 0,
    sugarG: 4,
    sodiumMg: 1116,
    caffeineMg: 0,
    alcoholG: 0,
    source: "usda",
    confidence: 0.92,
    matchedName: "Cheese, feta",
    isVerified: true,
    isDirty: false,
    macrosPer100g: { calories: 264, protein: 14, carbs: 4, fat: 21, fiberG: 0, sugarG: 4, sodiumMg: 1116 },
    portions: [{ label: "g", gramWeight: 1, amount: 1 }],
    chosenPortion: { label: "g", gramWeight: 1, amount: 1 },
  },
  {
    id: "fixture-cucumber",
    name: "cucumber",
    amount: 1,
    unit: "cup",
    calories: 16,
    protein: 1,
    carbs: 4,
    fat: 0,
    fiberG: 1,
    sugarG: 2,
    sodiumMg: 2,
    caffeineMg: 0,
    alcoholG: 0,
    source: "usda",
    confidence: 0.88,
    matchedName: "Cucumber, with peel, raw",
    isVerified: true,
    isDirty: false,
    macrosPer100g: { calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiberG: 0.5, sugarG: 1.7, sodiumMg: 2 },
    portions: [
      { label: "cup", gramWeight: 104, amount: 1 },
      { label: "g", gramWeight: 1, amount: 1 },
    ],
    chosenPortion: { label: "cup", gramWeight: 104, amount: 1 },
  },
  {
    id: "fixture-olive-oil",
    name: "olive oil",
    amount: 1,
    unit: "tbsp",
    calories: 119,
    protein: 0,
    carbs: 0,
    fat: 14,
    fiberG: 0,
    sugarG: 0,
    sodiumMg: 0,
    caffeineMg: 0,
    alcoholG: 0,
    source: "usda",
    confidence: 0.45,
    matchedName: "Oil, olive, salad or cooking",
    isVerified: false,
    isDirty: false,
    macrosPer100g: { calories: 884, protein: 0, carbs: 0, fat: 100, fiberG: 0, sugarG: 0, sodiumMg: 0 },
    portions: [
      { label: "tbsp", gramWeight: 13.5, amount: 1 },
      { label: "g", gramWeight: 1, amount: 1 },
    ],
    chosenPortion: { label: "tbsp", gramWeight: 13.5, amount: 1 },
  },
];
