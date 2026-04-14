/**
 * App-wide default nutrition targets.
 * Used as fallbacks when a user has not yet set their own targets in their profile.
 * Keep this as the SINGLE source of truth — never hardcode target numbers elsewhere.
 */
export const NUTRITION_DEFAULTS = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fat: 65,
  fiber: 28,
  water: 2000,
  steps: 10000,
} as const;
