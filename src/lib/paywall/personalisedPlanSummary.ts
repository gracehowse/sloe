/**
 * ENG-966 — paywall lead with the plan the user built in onboarding.
 *
 * Shared copy builder so mobile paywall (and future web pricing) can
 * surface the user's real calorie target instead of generic marketing
 * when we know onboarding just computed their numbers.
 */

import { formatGoalLabel, goalClauseGerund } from "../nutrition/goalVocabulary";

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

/** ENG-1507 — delegates to the shared goal vocabulary (one normaliser,
 *  one label set; unknown → null, never a silent "Lose weight"). */
export function formatProfileGoalLabel(goal: ProfileDbGoal): string | null {
  return formatGoalLabel(goal);
}

export function shouldLeadPaywallWithPersonalisedPlan(input: {
  targetCalories: number | null | undefined;
  targetCaloriesSource: string | null | undefined;
  paywallFrom?: string;
}): boolean {
  const kcal = input.targetCalories;
  if (kcal == null || !Number.isFinite(kcal) || kcal <= 0) return false;
  // ENG-1507 — `paywallFrom === "onboarding"` is deliberately NOT
  // sufficient on its own. The mobile trial path used to open this paywall
  // BEFORE persistOnboarding ran, and the from=onboarding short-circuit
  // then rendered the PREVIOUS run's profiles row as "your plan" ("for
  // lose weight" against a just-selected build-muscle goal). The plan card
  // now only ever leads with a row onboarding actually wrote.
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

  // ENG-1507 — gerund clause ("for losing weight"), not the lower-cased
  // noun label ("for lose weight") the audit flagged as broken grammar.
  const gerund = goalClauseGerund(input.goal ?? null);
  const goalClause = gerund ? ` for ${gerund}` : "";

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
