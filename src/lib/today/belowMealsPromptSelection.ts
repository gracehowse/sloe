/**
 * Below-meals prompt cap — Premium P1 (ENG-585), tightened by ENG-1183.
 *
 * Priority: check-in > north-star > snap > nudge. At most one dismissible
 * interruption renders at once so cold-open trust content is never stacked
 * behind onboarding / check-in chrome.
 */

export type BelowMealsPromptId = "checkin" | "northStar" | "snap" | "nudge";

export const BELOW_MEALS_PROMPT_PRIORITY: readonly BelowMealsPromptId[] = [
  "checkin",
  "northStar",
  "snap",
  "nudge",
] as const;

export const BELOW_MEALS_PROMPT_MAX = 1;

export function selectBelowMealsPrompts(
  eligible: Partial<Record<BelowMealsPromptId, boolean>>,
  max: number = BELOW_MEALS_PROMPT_MAX,
): BelowMealsPromptId[] {
  const out: BelowMealsPromptId[] = [];
  for (const id of BELOW_MEALS_PROMPT_PRIORITY) {
    if (eligible[id]) out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

export function isBelowMealsPromptVisible(
  id: BelowMealsPromptId,
  eligible: Partial<Record<BelowMealsPromptId, boolean>>,
  max: number = BELOW_MEALS_PROMPT_MAX,
): boolean {
  return selectBelowMealsPrompts(eligible, max).includes(id);
}
