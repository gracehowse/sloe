/**
 * TDEE (Total Daily Energy Expenditure) calculator.
 * Uses Mifflin-St Jeor equation — considered the most accurate for general population.
 */

export type Sex = "male" | "female" | "unspecified";

export type ActivityLevel =
  | "sedentary" // Little/no exercise, desk job
  | "light" // Light exercise 1-3 days/week
  | "moderate" // Moderate exercise 3-5 days/week
  | "active" // Hard exercise 6-7 days/week
  | "very_active"; // Very hard exercise, physical job

export type PlanPace = "relaxed" | "steady" | "accelerated" | "vigorous";

export type NutritionStrategy = "balanced" | "high_protein" | "high_satisfaction" | "low_carb";

/**
 * Mifflin-St Jeor activity multipliers. Exported so explainer copy
 * (`buildTdeeExplainerCopy`, onboarding preview row) can quote the
 * exact number rather than re-declaring it next to the table.
 */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Short labels used in the activity-level preview row + the popover. */
export const ACTIVITY_SHORT_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary",
  light: "Light",
  moderate: "Moderate",
  active: "Active",
  very_active: "Very active",
};

/** Weekly kg loss for each pace. Exported so the canonical
 *  `deriveTargets` core (goalPaceRetune.ts) can map a legacy
 *  `plan_pace` preset → continuous kg/week and feed the same
 *  continuous-pace math onboarding uses — retiring the preset
 *  `PACE_DAILY_DEFICIT` buckets from the recompute path. The four
 *  values mirror `mapPaceToPreset` in onboarding/persist.ts; if you
 *  change one, change both. */
export const PACE_WEEKLY_KG: Record<PlanPace, number> = {
  relaxed: 0.25,
  steady: 0.5,
  accelerated: 0.75,
  vigorous: 1.0,
};

/** Daily calorie deficit per pace (7700 kcal ≈ 1kg fat) */
const PACE_DAILY_DEFICIT: Record<PlanPace, number> = {
  relaxed: 275, // ~0.25 kg/week
  steady: 550, // ~0.5 kg/week
  accelerated: 825, // ~0.75 kg/week
  vigorous: 1100, // ~1 kg/week
};

/**
 * Mifflin-St Jeor BMR (Basal Metabolic Rate)
 * Male:   10 × weight(kg) + 6.25 × height(cm) − 5 × age − 161 + 166 = ... simplified:
 * Male:   10w + 6.25h − 5a + 5
 * Female: 10w + 6.25h − 5a − 161
 */
export function calculateBMR(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const w = Math.max(30, Math.min(weightKg, 350)); // 30–350 kg
  const h = Math.max(100, Math.min(heightCm, 250)); // 100–250 cm
  const a = Math.max(13, Math.min(age, 100)); // 13–100 years
  const base = 10 * w + 6.25 * h - 5 * a;
  if (sex === "male") return base + 5;
  if (sex === "female") return base - 161;
  // "unspecified" — midpoint of male and female estimates
  return Math.round((base + 5 + (base - 161)) / 2);
}

/** TDEE = BMR × activity multiplier */
export function calculateTDEE(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  age: number,
  activity: ActivityLevel,
): number {
  const bmr = calculateBMR(sex, weightKg, heightCm, age);
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activity]);
}

/** Calculate daily calorie budget for a given plan pace. No clamping — returns the real number.
 *  Accepts both DB values (cut/maintain/bulk) and onboarding UI labels (lose/health/strength). */
export function calculateBudget(tdee: number, pace: PlanPace, goalType: string): number {
  if (goalType === "bulk" || goalType === "strength" || goalType === "gain") {
    return Math.round(tdee + PACE_DAILY_DEFICIT[pace] * 0.5);
  }
  if (goalType === "maintain" || goalType === "health") {
    return tdee;
  }
  // "cut", "lose", or any unrecognized goal → deficit (safe default)
  return Math.round(tdee - PACE_DAILY_DEFICIT[pace]);
}

/** Safety level for a calorie budget */
export function budgetSafety(budget: number, sex: Sex): "safe" | "caution" | "warning" {
  // NHS/medical guidance: minimum ~1200 for women, ~1500 for men
  const hardFloor = sex === "male" ? 1500 : sex === "female" ? 1200 : 1350;
  const cautionFloor = sex === "male" ? 1800 : sex === "female" ? 1400 : 1600;
  if (budget < hardFloor) return "warning";
  if (budget < cautionFloor) return "caution";
  return "safe";
}

/** Estimate weeks to reach goal weight */
export function weeksToGoal(currentKg: number, goalKg: number, pace: PlanPace): number {
  const diff = Math.abs(currentKg - goalKg);
  const weeklyRate = PACE_WEEKLY_KG[pace];
  return Math.ceil(diff / weeklyRate);
}

/** Goal date from weeks */
export function goalDate(weeks: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

/** Calculate macro targets based on calorie budget + strategy */
export function calculateMacros(
  calories: number,
  strategy: NutritionStrategy,
  weightKg: number,
): { protein: number; carbs: number; fat: number; fiber: number } {
  if (!Number.isFinite(calories) || calories <= 0) {
    return { protein: 0, carbs: 0, fat: 0, fiber: 15 };
  }
  let proteinPct: number;
  let fatPct: number;
  let fiberG: number;

  // Protein is calculated as g/kg body weight (ISSN position stand), then
  // converted to a calorie percentage. This ensures the gram amount stays
  // meaningful regardless of calorie budget (a 1200-cal cut still gets
  // adequate protein, not just 25% of a small number).
  switch (strategy) {
    case "high_protein":
      // 2.2 g/kg — upper end of ISSN 1.6–2.2 range for muscle building
      proteinPct = Math.min(0.45, (weightKg * 2.2 * 4) / calories);
      fatPct = 0.25;
      fiberG = Math.round(calories / 70);
      break;
    case "high_satisfaction":
      // 1.8 g/kg — satiety-focused (Leidy 2015), higher fiber
      proteinPct = Math.min(0.4, (weightKg * 1.8 * 4) / calories);
      fatPct = 0.3;
      fiberG = Math.round(calories / 45); // ~27g per 1200 cal
      break;
    case "low_carb":
      // 1.8 g/kg protein, 45% fat — reduces carbs to ~25% (Volek/Phinney)
      proteinPct = Math.min(0.35, (weightKg * 1.8 * 4) / calories);
      fatPct = 0.45;
      fiberG = Math.round(calories / 80);
      break;
    default: // balanced
      // 1.6 g/kg — ISSN minimum for active individuals
      proteinPct = Math.min(0.35, (weightKg * 1.6 * 4) / calories);
      fatPct = 0.25;
      fiberG = Math.round(calories / 55);
  }

  const protein = Math.round((calories * proteinPct) / 4);
  const fat = Math.round((calories * fatPct) / 9);
  // Derive carbs from remaining calories so macros always reconcile to budget
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  return { protein, carbs, fat, fiber: Math.max(15, fiberG) };
}

/** All plan options with calculated values */
export function planOptions(tdee: number, currentKg: number, goalKg: number, goalType: string, sex: Sex) {
  const paces: PlanPace[] = ["relaxed", "steady", "accelerated", "vigorous"];
  return paces.map((pace) => {
    const budget = calculateBudget(tdee, pace, goalType);
    const weeks = goalType === "cut" || goalType === "lose" ? weeksToGoal(currentKg, goalKg, pace) : 0;
    const safety = budgetSafety(budget, sex);
    return {
      pace,
      budget,
      weeklyKg: PACE_WEEKLY_KG[pace],
      weeks,
      goalDate: weeks > 0 ? goalDate(weeks) : null,
      safety,
    };
  });
}

/** Unit conversion helpers */
export function kgToLb(kg: number): number {
  return kg * 2.20462;
}
export function lbToKg(lb: number): number {
  return lb / 2.20462;
}
export function kgToStLb(kg: number): { st: number; lb: number } {
  const totalLb = kgToLb(kg);
  const st = Math.floor(totalLb / 14);
  const lb = Math.round((totalLb - st * 14) * 10) / 10;
  return { st, lb };
}
export function stLbToKg(st: number, lb: number): number {
  return lbToKg(st * 14 + lb);
}
export function cmToFtIn(cm: number): { ft: number; inches: number } {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inches = Math.round((totalIn - ft * 12) * 10) / 10;
  return { ft, inches };
}
export function ftInToCm(ft: number, inches: number): number {
  return (ft * 12 + inches) * 2.54;
}

export const ACTIVITY_LABELS: Record<ActivityLevel, { title: string; desc: string }> = {
  sedentary: { title: "Sedentary", desc: "Little or no exercise, desk job" },
  light: { title: "Lightly active", desc: "Light exercise 1-3 days/week" },
  moderate: { title: "Moderately active", desc: "Moderate exercise 3-5 days/week" },
  active: { title: "Active", desc: "Hard exercise 6-7 days/week" },
  very_active: { title: "Very active", desc: "Very hard exercise or physical job" },
};

export const PACE_LABELS: Record<PlanPace, { title: string; desc: string }> = {
  relaxed: { title: "Relaxed", desc: "Sustainable weight loss, our most lenient plan" },
  steady: { title: "Steady", desc: "Comfortable yet effective progress each week" },
  accelerated: { title: "Accelerated", desc: "Ambitious but manageable results" },
  vigorous: { title: "Vigorous", desc: "Our most intensive plan for fast results" },
};

export const STRATEGY_LABELS: Record<NutritionStrategy, { title: string; desc: string }> = {
  balanced: { title: "Balanced", desc: "1.6 g/kg protein — well-rounded nutrition" },
  high_protein: { title: "High Protein", desc: "2.2 g/kg protein — build or maintain muscle" },
  high_satisfaction: { title: "High Satisfaction", desc: "1.8 g/kg protein + higher fibre for satiety" },
  low_carb: { title: "Low Carb", desc: "1.8 g/kg protein, 45% fat — reduce carbs" },
};

/**
 * Onboarding preview — given the entered profile basics, return the
 * maintenance kcal for every activity level so the user can see how
 * their selection moves the number. Returns `null` if any input is
 * missing/invalid; the caller should render a quieter helper line in
 * that case.
 *
 * Shipped 2026-04-18 alongside the activity-bonus Maintenance tile to
 * close TestFlight feedback `AAtW7dYcCBPyBdsMU6UqiQQ` /
 * `AFdtq8z_FmWRCispqF04Lsk` ("can't tell where TDEE comes from").
 */
export function activityLevelPreviewKcal(
  sex: Sex,
  weightKg: number | null | undefined,
  heightCm: number | null | undefined,
  age: number | null | undefined,
): Record<ActivityLevel, number> | null {
  if (
    !Number.isFinite(weightKg) || !weightKg ||
    !Number.isFinite(heightCm) || !heightCm ||
    !Number.isFinite(age) || !age
  ) {
    return null;
  }
  const w = weightKg as number;
  const h = heightCm as number;
  const a = age as number;
  return {
    sedentary: calculateTDEE(sex, w, h, a, "sedentary"),
    light: calculateTDEE(sex, w, h, a, "light"),
    moderate: calculateTDEE(sex, w, h, a, "moderate"),
    active: calculateTDEE(sex, w, h, a, "active"),
    very_active: calculateTDEE(sex, w, h, a, "very_active"),
  };
}

/**
 * Canonical popover copy for the Today activity-bonus card. Wording is
 * locked across platforms — both `today-activity-bonus-card.tsx` (web)
 * and `TodayActivityBonusCard.tsx` (mobile) read from this helper so a
 * silent drift in either direction fails the parity test in
 * `tests/unit/tdeeExplainer.test.ts`.
 *
 * Shape (one paragraph, three sentences):
 *   Maintenance ≈ {tdee} kcal · BMR {bmr} × {activityLabel} {mult}.
 *   Total burn = Resting {basal} + Active {active}.
 *   Bonus = burn above maintenance.
 */
export function buildTdeeExplainerCopy(input: {
  maintenanceTdeeKcal: number;
  bmrKcal: number;
  activityLevel: ActivityLevel;
  basalKcal: number;
  activeKcal: number;
}): string {
  const { maintenanceTdeeKcal, bmrKcal, activityLevel, basalKcal, activeKcal } = input;
  const label = ACTIVITY_SHORT_LABELS[activityLevel];
  const mult = ACTIVITY_MULTIPLIERS[activityLevel];
  return [
    `Maintenance \u2248 ${Math.round(maintenanceTdeeKcal).toLocaleString()} kcal \u00B7 BMR ${Math.round(
      bmrKcal,
    ).toLocaleString()} \u00D7 ${label} ${mult}.`,
    `Total burn = Resting ${Math.round(basalKcal).toLocaleString()} + Active ${Math.round(
      activeKcal,
    ).toLocaleString()}.`,
    `Bonus = burn above maintenance.`,
  ].join(" ");
}

/**
 * Returns adaptive TDEE if available with sufficient confidence, else the
 * static Mifflin-St Jeor estimate. Use this as the single source of truth
 * for calorie budgets across web and mobile.
 *
 * F-145 (2026-05-10) — staleness check: when the caller passes
 * `adaptive_tdee_updated_at`, we reject adaptive values older than
 * `ADAPTIVE_STALE_DAYS` (14d) and fall back to the formula. This
 * matches the contract `resolveMaintenance` already enforces in
 * `src/lib/nutrition/resolveMaintenance.ts`. Without this check, a
 * stale adaptive value (user stopped logging weeks ago) would
 * silently keep displaying as the user's "real" TDEE on every
 * surface that calls this helper. Callers without `_updated_at` get
 * the original behaviour (back-compat).
 */
const ADAPTIVE_STALE_DAYS_MS = 14 * 86_400_000;

export function getEffectiveTDEE(
  profile: {
    adaptive_tdee?: number | null;
    adaptive_tdee_confidence?: string | null;
    /** ISO timestamp of last adaptive recompute. When provided AND the
     *  value is older than 14d, the adaptive number is rejected as
     *  stale and the formula is used instead. Optional for back-compat
     *  with callers that haven't been upgraded yet. */
    adaptive_tdee_updated_at?: string | null;
    sex: Sex;
    weight_kg: number;
    height_cm: number;
    age: number;
    activity_level: ActivityLevel;
  },
  options: { now?: Date } = {},
): { tdee: number; isAdaptive: boolean } {
  if (
    profile.adaptive_tdee != null &&
    profile.adaptive_tdee > 0 &&
    (profile.adaptive_tdee_confidence === "medium" || profile.adaptive_tdee_confidence === "high")
  ) {
    // F-145 staleness gate: only enforced when caller provides
    // `_updated_at`. Older callers fall through unchanged.
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
