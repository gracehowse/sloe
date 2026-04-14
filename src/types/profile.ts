import type { UserTier } from "./recipe.ts";

export type Sex = "male" | "female" | "unspecified";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
/** Must match the DB check constraint: `goal in ('cut','maintain','bulk')`. */
export type Goal = "cut" | "maintain" | "bulk";

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Daily fiber target (grams). */
  fiber: number;
  /** Daily water goal (milliliters). */
  waterMl: number;
}

/**
 * Defaults for hydration and legacy snapshots that only stored P/C/F.
 * MUST stay in sync with apps/mobile/constants/nutritionDefaults.ts
 */
export const DEFAULT_MACRO_TARGETS: MacroTargets = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fat: 65,
  fiber: 28,
  waterMl: 2000,
};

/** Default daily steps goal. MUST stay in sync with mobile NUTRITION_DEFAULTS.steps */
export const DEFAULT_STEPS_GOAL = 10000;

export function normalizeMacroTargets(partial: Partial<MacroTargets> | null | undefined): MacroTargets {
  const d = DEFAULT_MACRO_TARGETS;
  return {
    calories: Math.max(0, Math.round(partial?.calories ?? d.calories)),
    protein: Math.max(0, Math.round(partial?.protein ?? d.protein)),
    carbs: Math.max(0, Math.round(partial?.carbs ?? d.carbs)),
    fat: Math.max(0, Math.round(partial?.fat ?? d.fat)),
    fiber: Math.max(0, Math.round(partial?.fiber ?? d.fiber)),
    waterMl: Math.max(0, Math.round(partial?.waterMl ?? d.waterMl)),
  };
}

export interface UserProfile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  userTier: UserTier;
  dietary: string[];
  measurementSystem: "metric" | "imperial";
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  sex: Sex | null;
  activityLevel: ActivityLevel | null;
  goal: Goal | null;
  targets: MacroTargets | null;
  /** When true, user wants calorie goal adjusted from Apple Health / activity when integrated. */
  preferActivityAdjustedCalories: boolean;
}

