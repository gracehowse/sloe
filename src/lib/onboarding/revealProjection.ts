/**
 * ENG-964 — heuristic goal-date projection for onboarding Reveal.
 *
 * Onboarding does not collect a goal weight. We show a tangible ~12-week
 * milestone at the user's chosen pace so the reveal step feels real
 * without inventing a destination weight. Copy always qualifies with
 * "approximately" / "about" per trust-posture rules.
 */

import { formatGoalDateDayMonthYear } from "../targets/targetsView";
import type { Goal } from "./state";

/** Forward horizon for the first milestone — scope-bounded per onboarding.md. */
export const ONBOARDING_PROJECTION_WEEKS = 12;

export interface OnboardingRevealProjection {
  deltaKg: number;
  dateLabel: string;
  sentence: string;
}

export function computeOnboardingRevealProjection(input: {
  goal: Goal | null;
  weightKg: number;
  paceKgPerWeek: number | null;
  weightSkipped: boolean;
}): OnboardingRevealProjection | null {
  const { goal, weightKg, paceKgPerWeek, weightSkipped } = input;
  if (weightSkipped || goal == null || goal === "maintain") return null;
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  const pace = paceKgPerWeek;
  if (pace == null || !Number.isFinite(pace) || pace <= 0) return null;

  const deltaKg = Math.round(pace * ONBOARDING_PROJECTION_WEEKS * 10) / 10;
  if (deltaKg <= 0) return null;

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + ONBOARDING_PROJECTION_WEEKS * 7);
  const dateLabel = formatGoalDateDayMonthYear(targetDate);

  const paceLabel = pace.toFixed(pace < 0.1 ? 2 : 2);

  if (goal === "lose" || goal === "recomp") {
    return {
      deltaKg,
      dateLabel,
      sentence: `At ~${paceLabel} kg/week, you could lose about ${deltaKg} kg by approximately ${dateLabel}.`,
    };
  }

  return {
    deltaKg,
    dateLabel,
    sentence: `At ~${paceLabel} kg/week, you could gain about ${deltaKg} kg by approximately ${dateLabel}.`,
  };
}
