import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";

/** Body-stat fields fetched from profiles */
export type BodyStats = {
  weight_kg?: number | null;
  height_cm?: number | null;
  sex?: string | null;
  activity_level?: string | null;
  goal?: string | null;
  dob?: string | null;
  /** Saved during onboarding when DOB is not collected */
  age?: number | null;
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

/** DB + legacy goal strings → kcal adjustment vs TDEE (exported for activity / burn math on Today). */
export function goalCalorieAdjustment(goal: string | null | undefined): number {
  const g = (goal ?? "maintain").trim().toLowerCase();
  if (g === "cut" || g === "lose") return -500;
  if (g === "bulk" || g === "gain" || g === "strength") return 300;
  return GOAL_ADJ[g] ?? 0;
}

/** Approximate maintenance intake (TDEE) implied by saved calorie target and goal, e.g. lose 1,800 → ~2,300 TDEE. */
export function maintenanceIntakeFromTargetCalories(targetCalories: number, goal: string | null | undefined): number {
  if (!Number.isFinite(targetCalories) || targetCalories <= 0) return 0;
  return Math.max(0, Math.round(targetCalories - goalCalorieAdjustment(goal)));
}

/**
 * Calculate macro targets from body stats using Mifflin-St Jeor.
 * Returns null if insufficient data (caller should fall back to NUTRITION_DEFAULTS).
 */
export function calcTargetsFromStats(stats: BodyStats): MacroTargets | null {
  const sexRaw = stats.sex != null ? String(stats.sex).trim() : "";
  const activityRaw = stats.activity_level != null ? String(stats.activity_level).trim() : "";
  if (!sexRaw || !activityRaw) return null;

  const weightKg = typeof stats.weight_kg === "number" ? stats.weight_kg : Number(stats.weight_kg);
  const heightCm = typeof stats.height_cm === "number" ? stats.height_cm : Number(stats.height_cm);
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || weightKg <= 0 || heightCm <= 0) {
    return null;
  }

  let age = 30;
  if (stats.dob) {
    const dobMs = new Date(stats.dob).getTime();
    if (Number.isFinite(dobMs)) {
      age = Math.max(14, Math.min(100, Math.floor((Date.now() - dobMs) / 31557600000)));
    }
  } else if (stats.age != null) {
    const a = typeof stats.age === "number" ? stats.age : Number(stats.age);
    if (Number.isFinite(a) && a > 0) age = Math.round(Math.min(100, Math.max(14, a)));
  }

  const bmr =
    sexRaw === "male"
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  const tdee = bmr * (ACTIVITY_MULT[activityRaw] ?? 1.55);
  const cals = Math.round(tdee + goalCalorieAdjustment(stats.goal));

  return {
    calories: cals,
    protein: Math.round((cals * 0.3) / 4),
    carbs: Math.round((cals * 0.4) / 4),
    fat: Math.round((cals * 0.3) / 9),
    fiber: NUTRITION_DEFAULTS.fiber,
  };
}

/** Coerce PostgREST numeric / string JSON to a finite number, else null. */
function nn(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

export type ResolvedTargets = MacroTargets & {
  usingDefaults: boolean;
  /** explicit = saved calorie target in DB; computed = Mifflin from body; fallback = app defaults */
  resolution: "explicit" | "computed" | "fallback";
};

/**
 * Resolve macro targets: use DB values if set, else compute from body stats,
 * else fall back to NUTRITION_DEFAULTS.
 */
export function resolveTargets(
  dbTargets: { target_calories?: number | null; target_protein?: number | null; target_carbs?: number | null; target_fat?: number | null; target_fiber_g?: number | null },
  bodyStats: BodyStats,
): ResolvedTargets {
  const cal = nn(dbTargets.target_calories);
  if (cal != null && cal > 0) {
    const p = nn(dbTargets.target_protein);
    const c = nn(dbTargets.target_carbs);
    const f = nn(dbTargets.target_fat);
    const fib = nn(dbTargets.target_fiber_g);
    return {
      calories: Math.round(cal),
      protein: p != null && p > 0 ? Math.round(p) : NUTRITION_DEFAULTS.protein,
      carbs: c != null && c > 0 ? Math.round(c) : NUTRITION_DEFAULTS.carbs,
      fat: f != null && f > 0 ? Math.round(f) : NUTRITION_DEFAULTS.fat,
      fiber: fib != null && fib > 0 ? Math.round(fib) : NUTRITION_DEFAULTS.fiber,
      usingDefaults: false,
      resolution: "explicit",
    };
  }

  const computed = calcTargetsFromStats(bodyStats);
  if (computed) return { ...computed, usingDefaults: false, resolution: "computed" };

  return {
    calories: NUTRITION_DEFAULTS.calories,
    protein: NUTRITION_DEFAULTS.protein,
    carbs: NUTRITION_DEFAULTS.carbs,
    fat: NUTRITION_DEFAULTS.fat,
    fiber: NUTRITION_DEFAULTS.fiber,
    usingDefaults: true,
    resolution: "fallback",
  };
}
