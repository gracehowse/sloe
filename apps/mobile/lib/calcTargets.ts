import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";

/** Body-stat fields fetched from profiles */
export type BodyStats = {
  weight_kg?: number | null;
  height_cm?: number | null;
  sex?: string | null;
  activity_level?: string | null;
  goal?: string | null;
  dob?: string | null;
};

export type MacroTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

const ACTIVITY_MULT: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_ADJ: Record<string, number> = {
  lose: -500,
  maintain: 0,
  gain: 300,
};

/**
 * Calculate macro targets from body stats using Mifflin-St Jeor.
 * Returns null if insufficient data (caller should fall back to NUTRITION_DEFAULTS).
 */
export function calcTargetsFromStats(stats: BodyStats): MacroTargets | null {
  const { weight_kg, height_cm, sex, activity_level } = stats;
  if (!weight_kg || !height_cm || !sex || !activity_level) return null;

  const age = stats.dob
    ? Math.floor((Date.now() - new Date(stats.dob).getTime()) / 31557600000)
    : 30;

  const bmr =
    sex === "male"
      ? 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
      : 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;

  const tdee = bmr * (ACTIVITY_MULT[activity_level] ?? 1.55);
  const cals = Math.round(tdee + (GOAL_ADJ[stats.goal ?? "maintain"] ?? 0));

  return {
    calories: cals,
    protein: Math.round((cals * 0.3) / 4),
    carbs: Math.round((cals * 0.4) / 4),
    fat: Math.round((cals * 0.3) / 9),
    fiber: NUTRITION_DEFAULTS.fiber,
  };
}

/**
 * Resolve macro targets: use DB values if set, else compute from body stats,
 * else fall back to NUTRITION_DEFAULTS.
 */
export function resolveTargets(
  dbTargets: { target_calories?: number | null; target_protein?: number | null; target_carbs?: number | null; target_fat?: number | null; target_fiber_g?: number | null },
  bodyStats: BodyStats,
): MacroTargets & { usingDefaults: boolean } {
  if (dbTargets.target_calories != null) {
    return {
      calories: dbTargets.target_calories,
      protein: dbTargets.target_protein ?? NUTRITION_DEFAULTS.protein,
      carbs: dbTargets.target_carbs ?? NUTRITION_DEFAULTS.carbs,
      fat: dbTargets.target_fat ?? NUTRITION_DEFAULTS.fat,
      fiber: dbTargets.target_fiber_g ?? NUTRITION_DEFAULTS.fiber,
      usingDefaults: false,
    };
  }

  const computed = calcTargetsFromStats(bodyStats);
  if (computed) return { ...computed, usingDefaults: false };

  return {
    calories: NUTRITION_DEFAULTS.calories,
    protein: NUTRITION_DEFAULTS.protein,
    carbs: NUTRITION_DEFAULTS.carbs,
    fat: NUTRITION_DEFAULTS.fat,
    fiber: NUTRITION_DEFAULTS.fiber,
    usingDefaults: true,
  };
}
