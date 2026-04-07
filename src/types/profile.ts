import type { UserTier } from "./recipe.ts";

export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "cut" | "maintain" | "bulk";

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
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
}

