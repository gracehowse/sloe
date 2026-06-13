import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { calculateBudget, type PlanPace } from "@suppr/shared/nutrition/tdee";
import { clampTargetToSafetyFloor, coerceSex } from "@suppr/shared/onboarding/targets";

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
  /**
   * `profiles.plan_pace` — controls the daily calorie deficit / surplus
   * applied vs maintenance TDEE. Defaults to `"steady"` when missing,
   * matching the web `calculateBudget` default. TestFlight build 7
   * (P0-3, 2026-04-18): mobile previously ignored pace and applied a
   * flat ±500 / 0 / +300, producing different calorie targets to web on
   * the same account. Keep this field in any `profiles` SELECT that
   * feeds `calcTargetsFromStats` / `resolveTargets`.
   */
  plan_pace?: string | null;
};

function normalisePace(raw: string | null | undefined): PlanPace {
  const p = (raw ?? "steady").trim().toLowerCase();
  if (p === "relaxed" || p === "steady" || p === "accelerated" || p === "vigorous") return p;
  return "steady";
}

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

/**
 * DB + legacy goal strings → kcal adjustment vs TDEE.
 *
 * Pace-aware: `relaxed` / `steady` / `accelerated` / `vigorous` apply
 * deficits of 275 / 550 / 825 / 1100 kcal (same table as web
 * `src/lib/nutrition/tdee.ts:PACE_DAILY_DEFICIT`). Bulk / gain goals
 * apply half the deficit as a surplus, mirroring web `calculateBudget`.
 *
 * Without a pace argument, defaults to `"steady"` (550/-550) — the same
 * default used by web. TestFlight build 7 (P0-3, 2026-04-18): mobile
 * previously applied a flat ±500 / 0 / +300 ignoring pace, which gave a
 * different calorie target to web on the same account.
 */
export function goalCalorieAdjustment(
  goal: string | null | undefined,
  pace?: string | null,
): number {
  // Preserve the legacy mobile-only "null/empty goal defaults to maintain"
  // semantics — web's `calculateBudget` treats unknown strings as a deficit
  // (safe default for the budget calculator), but on mobile we have surfaces
  // that ask "by how much should I shift today's burn vs target?" where a
  // missing goal must be a no-op, not a -550 kcal surprise.
  if (goal == null) return 0;
  const g = goal.trim().toLowerCase();
  if (!g) return 0;
  // Use a base TDEE of 0 so calculateBudget returns just the adjustment.
  // calculateBudget(0, pace, "lose") returns -PACE_DAILY_DEFICIT[pace];
  // calculateBudget(0, pace, "bulk") returns +PACE_DAILY_DEFICIT[pace] * 0.5;
  // calculateBudget(0, pace, "maintain") returns 0.
  return calculateBudget(0, normalisePace(pace), g);
}

/** Approximate maintenance intake (TDEE) implied by saved calorie target and goal, e.g. lose 1,800 → ~2,300 TDEE. */
export function maintenanceIntakeFromTargetCalories(
  targetCalories: number,
  goal: string | null | undefined,
  pace?: string | null,
): number {
  if (!Number.isFinite(targetCalories) || targetCalories <= 0) return 0;
  return Math.max(0, Math.round(targetCalories - goalCalorieAdjustment(goal, pace)));
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

  // 2026-05-12 — handle "unspecified" sex with the midpoint estimate
  // (matches web `calculateBMR` in src/lib/nutrition/tdee.ts and the
  // sibling `calculateTDEE` helper below). Previous branch collapsed
  // any non-"male" sex (including "unspecified" / null normalised) into
  // the female formula, underestimating BMR by ~78 kcal/day for
  // non-binary or undeclared users.
  const baseBmr = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr =
    sexRaw === "male"
      ? baseBmr + 5
      : sexRaw === "female"
        ? baseBmr - 161
        : Math.round((baseBmr + 5 + (baseBmr - 161)) / 2);

  // Default to sedentary (1.2) when missing — see TestFlight
  // `AIIm60nKi_sTu3-4YjR-WR4` (2026-04-18). Previously "moderate" (1.55)
  // silently over-inflated TDEE by ~14% for users who never picked a level.
  const tdee = bmr * (ACTIVITY_MULT[activityRaw] ?? ACTIVITY_MULT.sedentary);
  // Pace-aware adjustment: matches web `calculateBudget`. P0-3 (2026-04-18).
  const cals = Math.round(tdee + goalCalorieAdjustment(stats.goal, stats.plan_pace));

  return {
    calories: cals,
    protein: Math.round((cals * 0.3) / 4),
    carbs: Math.round((cals * 0.4) / 4),
    fat: Math.round((cals * 0.3) / 9),
    fiber: NUTRITION_DEFAULTS.fiber,
  };
}

/**
 * Calculate TDEE using Mifflin-St Jeor (mirrors web src/lib/nutrition/tdee.ts).
 */
export function calculateTDEE(
  sex: string,
  weightKg: number,
  heightCm: number,
  age: number,
  activityLevel: string,
): number {
  const w = Math.max(30, Math.min(weightKg, 350));
  const h = Math.max(100, Math.min(heightCm, 250));
  const a = Math.max(13, Math.min(age, 100));
  const base = 10 * w + 6.25 * h - 5 * a;
  let bmr: number;
  if (sex === "male") bmr = base + 5;
  else if (sex === "female") bmr = base - 161;
  else bmr = Math.round((base + 5 + (base - 161)) / 2);
  return Math.round(bmr * (ACTIVITY_MULT[activityLevel] ?? ACTIVITY_MULT.sedentary));
}

/**
 * Returns adaptive TDEE if available with sufficient confidence, else
 * the static Mifflin-St Jeor estimate. Single source of truth for TDEE.
 *
 * F-145 (2026-05-10) — staleness check parity with `src/lib/nutrition/tdee.ts`.
 * When the caller passes `adaptive_tdee_updated_at`, we reject adaptive
 * values older than 14 days and fall back to the formula. Without this
 * check, a stale adaptive value (user stopped logging weeks ago) would
 * silently keep displaying as the user's "real" TDEE on Progress.
 * Callers without `_updated_at` get the original behaviour (back-compat).
 */
const ADAPTIVE_STALE_DAYS_MS = 14 * 86_400_000;

export function getEffectiveTDEE(
  profile: {
    adaptive_tdee?: number | null;
    adaptive_tdee_confidence?: string | null;
    /** ISO timestamp of last adaptive recompute. When provided AND
     *  the value is older than 14d, the adaptive number is rejected
     *  as stale and the formula is used instead. Optional for
     *  back-compat with callers that haven't been upgraded yet. */
    adaptive_tdee_updated_at?: string | null;
    sex: string;
    weight_kg: number;
    height_cm: number;
    age: number;
    activity_level: string;
  },
  options: { now?: Date } = {},
): { tdee: number; isAdaptive: boolean } {
  if (
    profile.adaptive_tdee != null &&
    profile.adaptive_tdee > 0 &&
    (profile.adaptive_tdee_confidence === "medium" || profile.adaptive_tdee_confidence === "high")
  ) {
    if (profile.adaptive_tdee_updated_at) {
      const updated = new Date(profile.adaptive_tdee_updated_at);
      if (Number.isFinite(updated.getTime())) {
        const now = options.now ?? new Date();
        if (now.getTime() - updated.getTime() > ADAPTIVE_STALE_DAYS_MS) {
          return {
            tdee: calculateTDEE(
              profile.sex,
              profile.weight_kg,
              profile.height_cm,
              profile.age,
              profile.activity_level,
            ),
            isAdaptive: false,
          };
        }
      }
    }
    return { tdee: profile.adaptive_tdee, isAdaptive: true };
  }
  return {
    tdee: calculateTDEE(
      profile.sex,
      profile.weight_kg,
      profile.height_cm,
      profile.age,
      profile.activity_level,
    ),
    isAdaptive: false,
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
      // ENG-793 floor-leak fix: a stored sub-floor target (e.g. 901) must not
      // reach the Today ring. Clamp the explicit stored value UP to the
      // sex-aware safety floor at READ time (the computed/default branches below
      // already sit above the floor). Monotonic + macros untouched.
      calories: clampTargetToSafetyFloor(Math.round(cal), coerceSex(bodyStats.sex)),
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
