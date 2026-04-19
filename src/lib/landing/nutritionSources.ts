/**
 * Nutrition verification sources, in the exact order
 * `verifyIngredients.ts` traverses them (after the internal `Suppr`
 * user-foods lookup and before the local estimation fallback — both of
 * which are implementation details, not user-facing sources).
 *
 * Lives in its own leaf file (no `@/…` imports, no Next-only deps) so
 * the React Native app can import it directly under its own `tsconfig`
 * `paths` — see `apps/mobile/app/nutrition-sources.tsx`. `content.ts`
 * re-exports this constant so web callers can keep a single import.
 */
export const NUTRITION_SOURCES = [
  "USDA FoodData Central",
  "Edamam",
  "Open Food Facts",
  "FatSecret",
] as const;
