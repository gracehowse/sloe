/**
 * TDEE (Total Daily Energy Expenditure) calculator.
 * Uses Mifflin-St Jeor equation — considered the most accurate for general population.
 */

export type Sex = "male" | "female";

export type ActivityLevel =
  | "sedentary"      // Little/no exercise, desk job
  | "light"          // Light exercise 1-3 days/week
  | "moderate"       // Moderate exercise 3-5 days/week
  | "active"         // Hard exercise 6-7 days/week
  | "very_active";   // Very hard exercise, physical job

export type PlanPace = "relaxed" | "steady" | "accelerated" | "vigorous";

export type NutritionStrategy = "balanced" | "high_protein" | "high_satisfaction" | "low_carb";

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Weekly kg loss for each pace */
const PACE_WEEKLY_KG: Record<PlanPace, number> = {
  relaxed: 0.25,
  steady: 0.5,
  accelerated: 0.75,
  vigorous: 1.0,
};

/** Daily calorie deficit per pace (7700 kcal ≈ 1kg fat) */
const PACE_DAILY_DEFICIT: Record<PlanPace, number> = {
  relaxed: 275,    // ~0.25 kg/week
  steady: 550,     // ~0.5 kg/week
  accelerated: 825, // ~0.75 kg/week
  vigorous: 1100,  // ~1 kg/week
};

/**
 * Mifflin-St Jeor BMR (Basal Metabolic Rate)
 * Male:   10 × weight(kg) + 6.25 × height(cm) − 5 × age − 161 + 166 = ... simplified:
 * Male:   10w + 6.25h − 5a + 5
 * Female: 10w + 6.25h − 5a − 161
 */
export function calculateBMR(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const w = Math.max(30, Math.min(weightKg, 350));   // 30–350 kg
  const h = Math.max(100, Math.min(heightCm, 250));  // 100–250 cm
  const a = Math.max(13, Math.min(age, 100));         // 13–100 years
  const base = 10 * w + 6.25 * h - 5 * a;
  return sex === "male" ? base + 5 : base - 161;
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
  const hardFloor = sex === "male" ? 1500 : 1200;
  const cautionFloor = sex === "male" ? 1800 : 1400;
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
      proteinPct = Math.min(0.40, (weightKg * 1.8 * 4) / calories);
      fatPct = 0.30;
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
    const weeks = (goalType === "cut" || goalType === "lose") ? weeksToGoal(currentKg, goalKg, pace) : 0;
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
export function kgToLb(kg: number): number { return kg * 2.20462; }
export function lbToKg(lb: number): number { return lb / 2.20462; }
export function kgToStLb(kg: number): { st: number; lb: number } {
  const totalLb = kgToLb(kg);
  const st = Math.floor(totalLb / 14);
  const lb = Math.round((totalLb - st * 14) * 10) / 10;
  return { st, lb };
}
export function stLbToKg(st: number, lb: number): number { return lbToKg(st * 14 + lb); }
export function cmToFtIn(cm: number): { ft: number; inches: number } {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inches = Math.round((totalIn - ft * 12) * 10) / 10;
  return { ft, inches };
}
export function ftInToCm(ft: number, inches: number): number { return (ft * 12 + inches) * 2.54; }

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

export const STRATEGY_LABELS: Record<NutritionStrategy, { title: string; desc: string; emoji: string }> = {
  balanced: { title: "Balanced", desc: "1.6 g/kg protein — well-rounded nutrition", emoji: "⚖️" },
  high_protein: { title: "High Protein", desc: "2.2 g/kg protein — build or maintain muscle", emoji: "💪" },
  high_satisfaction: { title: "High Satisfaction", desc: "1.8 g/kg protein + higher fibre for satiety", emoji: "⭐" },
  low_carb: { title: "Low Carb", desc: "1.8 g/kg protein, 45% fat — reduce carbs", emoji: "🥑" },
};
