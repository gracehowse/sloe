import type { ActivityLevel, Goal, MacroTargets, Sex } from "../../types/profile.ts";

const activityMultipliers: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const goalAdjustments: Record<Goal, number> = {
  lose: -0.15,
  health: 0,
  strength: 0.1,
};

export function calculateBmrMifflinStJeor(input: {
  sex: Sex;
  age: number;
  weightKg: number;
  heightCm: number;
}): number {
  const { sex, age, weightKg, heightCm } = input;
  if (sex === "male") {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
}

export function calculateMacroTargets(input: {
  sex: Sex;
  age: number;
  weightKg: number;
  heightCm: number;
  activityLevel: ActivityLevel;
  goal: Goal;
}): MacroTargets {
  const bmr = calculateBmrMifflinStJeor(input);
  const tdee = bmr * activityMultipliers[input.activityLevel];
  const calories = Math.round(tdee * (1 + goalAdjustments[input.goal]));

  // Simple defaults aligned to the existing prototype:
  // - protein: ~2.2g/kg
  // - fat: 25% calories
  // - carbs: remainder
  const protein = Math.max(0, Math.round(input.weightKg * 2.2));
  const fat = Math.max(0, Math.round((calories * 0.25) / 9));
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  // ~14 g fiber per 1000 kcal (common guideline band); clamp for usability.
  const fiber = Math.max(14, Math.min(45, Math.round((14 * calories) / 1000)));
  // ~33 ml/kg/day hydration heuristic (adjust in UI).
  const waterMl = Math.min(4500, Math.max(1500, Math.round(input.weightKg * 33)));

  return { calories, protein, carbs, fat, fiber, waterMl };
}

