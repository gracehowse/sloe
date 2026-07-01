/**
 * coachAsk — bounded "Ask the coach" chip answers for the full Coach screen.
 *
 * Each chip maps to a grounded prompt over the user's day facts. The model
 * may only phrase guidance using numbers we supply; output is validated and
 * falls back to deterministic template copy per chip.
 *
 * Cross-platform: pure — no React, no I/O.
 */

import type { CoachDayFacts } from "./coachDayNarrative";

export const COACH_ASK_CHIPS = [
  { id: "high_protein_snack", label: "What's a high-protein snack?" },
  { id: "eating_out", label: "I'm eating out tonight" },
  { id: "plan_tomorrow", label: "Plan tomorrow for me" },
] as const;

export type CoachAskChipId = (typeof COACH_ASK_CHIPS)[number]["id"];

export interface CoachAskFacts extends CoachDayFacts {
  chipId: CoachAskChipId;
  topCandidateTitle: string | null;
  topCandidateCalories: number | null;
  topCandidateProtein: number | null;
}

export interface BuildCoachAskFactsInput extends CoachDayFacts {
  chipId: CoachAskChipId;
  topCandidateTitle?: string | null;
  topCandidateCalories?: number | null;
  topCandidateProtein?: number | null;
}

export function buildCoachAskFacts(input: BuildCoachAskFactsInput): CoachAskFacts {
  return {
    ...input,
    chipId: input.chipId,
    topCandidateTitle: input.topCandidateTitle?.trim() || null,
    topCandidateCalories:
      input.topCandidateCalories != null && Number.isFinite(input.topCandidateCalories)
        ? Math.round(input.topCandidateCalories)
        : null,
    topCandidateProtein:
      input.topCandidateProtein != null && Number.isFinite(input.topCandidateProtein)
        ? Math.round(input.topCandidateProtein)
        : null,
  };
}

const CHIP_PROMPTS: Record<CoachAskChipId, string> = {
  high_protein_snack:
    "The user asked for a high-protein snack idea grounded in what they have left today.",
  eating_out:
    "The user is eating out tonight. Give calm, practical guidance on ordering without inventing menu items — focus on protein and portion using their remaining budget.",
  plan_tomorrow:
    "The user wants a light plan for tomorrow morning. Suggest one concrete next step using their targets — do not invent a full meal plan.",
};

export const COACH_ASK_SYSTEM_PROMPT = [
  "You are the meal coach inside Sloe, a warm, body-neutral nutrition app.",
  "You answer a single tapped question using ONLY the facts provided.",
  "",
  "Write 2 to 4 sentences, plain English, second person, warm and practical.",
  "",
  "Hard rules — breaking any makes the answer unusable:",
  "  - NEVER state a number that is not in the facts provided. Do no arithmetic.",
  "  - NEVER invent specific restaurant dishes or branded foods.",
  "  - NEVER make a health, medical, or weight-loss claim.",
  "  - No emoji. No exclamation marks. No diet-culture language.",
  "",
  "Respond with a single JSON object, no markdown fences:",
  '  { "answer": "your answer here" }',
].join("\n");

export function buildCoachAskUserMessage(facts: CoachAskFacts): string {
  const payload = {
    question: CHIP_PROMPTS[facts.chipId],
    chipLabel: COACH_ASK_CHIPS.find((c) => c.id === facts.chipId)?.label ?? facts.chipId,
    day: {
      dateLabel: facts.dateLabel,
      caloriesRemaining: facts.caloriesRemaining,
      proteinRemaining: facts.proteinRemaining,
      calorieTarget: facts.calorieTarget,
      proteinTarget: facts.proteinTarget,
      mealsLoggedCount: facts.mealsLoggedCount,
      nextMealSlot: facts.nextMealSlot,
    },
    topSuggestion: facts.topCandidateTitle
      ? {
          title: facts.topCandidateTitle,
          calories: facts.topCandidateCalories,
          protein: facts.topCandidateProtein,
        }
      : null,
  };
  return [
    "Answer the user's coach question grounded only in these facts.",
    "",
    JSON.stringify(payload),
  ].join("\n");
}

const MAX_ANSWER_LEN = 480 as const;
const MIN_ANSWER_LEN = 24 as const;

const BANNED_PATTERNS: readonly RegExp[] = [
  /lose\s+weight/i,
  /weight\s+loss/i,
  /burn\s+fat/i,
  /\bdetox\b/i,
  /\bhealthy\b/i,
  /you\s+must\b/i,
  /you\s+should\b/i,
];

function numbersAreGrounded(text: string, facts: CoachAskFacts): boolean {
  const allowed = new Set<number>();
  const add = (n: number | null) => {
    if (n != null && Number.isFinite(n)) allowed.add(Math.abs(Math.round(n)));
  };
  add(facts.caloriesRemaining);
  add(facts.proteinRemaining);
  add(facts.calorieTarget);
  add(facts.proteinTarget);
  add(facts.caloriesLogged);
  add(facts.proteinLogged);
  add(facts.topCandidateCalories);
  add(facts.topCandidateProtein);

  const matches = text.replace(/,/g, "").match(/\d+(?:\.\d+)?/g) ?? [];
  for (const m of matches) {
    const n = Math.abs(Math.round(Number(m)));
    if (!Number.isFinite(n)) return false;
    if (n < 10) continue;
    if (!allowed.has(n)) return false;
  }
  return true;
}

export function parseCoachAskAnswer(rawText: string, facts: CoachAskFacts): string | null {
  let obj: unknown;
  try {
    const cleaned = rawText.replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
    obj = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const answer = (obj as { answer?: unknown }).answer;
  if (typeof answer !== "string") return null;
  const trimmed = answer.trim();
  if (trimmed.length < MIN_ANSWER_LEN) return null;
  if (trimmed.length > MAX_ANSWER_LEN) return null;
  if (BANNED_PATTERNS.some((re) => re.test(trimmed))) return null;
  if (!numbersAreGrounded(trimmed, facts)) return null;
  return trimmed;
}

export function buildTemplateCoachAskAnswer(facts: CoachAskFacts): string {
  switch (facts.chipId) {
    case "high_protein_snack":
      if (facts.proteinRemaining > 20) {
        return `You still have about ${facts.proteinRemaining}g of protein open today. Greek yogurt, cottage cheese, or a simple egg-based snack from your saved recipes would close a chunk of that without using much of your remaining ${facts.caloriesRemaining > 0 ? `${facts.caloriesRemaining.toLocaleString()} kcal` : "budget"}.`;
      }
      return "Your protein is nearly on target — a small yogurt or a boiled egg is enough to top up without pushing calories.";

    case "eating_out":
      if (facts.caloriesRemaining > 0) {
        return `You have roughly ${facts.caloriesRemaining.toLocaleString()} kcal left today. Lead with a protein-heavy main, keep sides simple, and log what you actually ate when you're back — estimates beat skipping.`;
      }
      return "Today's calories are already accounted for. If you are still eating out, pick something satisfying and log it honestly — the coach works from what you record, not what you planned.";

    case "plan_tomorrow":
      return `Tomorrow starts fresh on your ${facts.calorieTarget.toLocaleString()} kcal target. Logging breakfast early — even something small — gives the coach a real read before ${facts.nextMealSlot ?? "lunch"}.`;

    default: {
      const _exhaustive: never = facts.chipId;
      return _exhaustive;
    }
  }
}

export interface CoachAskResult {
  answer: string;
  source: "ai" | "template";
}
