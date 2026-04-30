/**
 * Mobile re-export of the shared `NUTRITION_DEFAULTS`.
 *
 * 2026-04-30 (#15): the canonical defaults moved to
 * `src/constants/nutritionDefaults.ts` so the web Settings page (and
 * the now-shared `src/lib/account/nukeAccountData.ts`) can import the
 * same values. Mobile callers keep their existing
 * `@/constants/nutritionDefaults` alias and need no change.
 */
export {
  NUTRITION_DEFAULTS,
  type NutritionDefaults,
} from "../../../src/constants/nutritionDefaults";
