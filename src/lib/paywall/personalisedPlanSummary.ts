/**
 * ENG-966 — paywall lead with the plan the user built in onboarding.
 *
 * Shared copy builder so mobile paywall (and future web pricing) can
 * surface the user's real calorie target instead of generic marketing
 * when we know onboarding just computed their numbers.
 */

export type ProfileDbGoal = "cut" | "maintain" | "bulk" | string | null;

export type PersonalisedPlanPaywallSummary = {
  /** Card eyebrow — matches onboarding Reveal. */
  eyebrow: string;
  /** Big kcal numeral for the recap card. */
  calories: number;
  caloriesLabel: string;
  /** Short goal clause, e.g. "Lose weight". */
  goalLabel: string | null;
  /** Optional protein target when persisted. */
  proteinG: number | null;
  /** Hero title override when leading with the plan. */
  heroTitle: string;
  /** Hero subtitle when leading with the plan. */
  heroSubtitle: string;
};

export const PAYWALL_PERSONALISED_PLAN_TEST_ID = "paywall-personalised-plan";

export function formatProfileGoalLabel(goal: ProfileDbGoal): string | null {
  switch (goal) {
    case "cut":
      return "Lose weight";
    case "maintain":
      return "Eat healthier";
    case "bulk":
      return "Build muscle";
    default:
      return null;
  }
}

export function shouldLeadPaywallWithPersonalisedPlan(input: {
  targetCalories: number | null | undefined;
  targetCaloriesSource: string | null | undefined;
  paywallFrom?: string;
}): boolean {
  const kcal = input.targetCalories;
  if (kcal == null || !Number.isFinite(kcal) || kcal <= 0) return false;
  if (input.paywallFrom === "onboarding") return true;
  return input.targetCaloriesSource === "onboarding";
}

export function buildPersonalisedPlanPaywallSummary(input: {
  targetCalories: number;
  targetProtein?: number | null;
  goal?: ProfileDbGoal;
}): PersonalisedPlanPaywallSummary {
  const goalLabel = formatProfileGoalLabel(input.goal ?? null);
  const proteinG =
    input.targetProtein != null &&
    Number.isFinite(input.targetProtein) &&
    input.targetProtein > 0
      ? Math.round(input.targetProtein)
      : null;

  const goalClause = goalLabel ? ` for ${goalLabel.toLowerCase()}` : "";

  return {
    eyebrow: "Your daily target",
    calories: Math.round(input.targetCalories),
    caloriesLabel: "kcal / day",
    goalLabel,
    proteinG,
    heroTitle: "Your plan is ready",
    heroSubtitle: `Pro keeps meal plans and AI logging built around your ${Math.round(input.targetCalories).toLocaleString()} kcal target${goalClause}.`,
  };
}
