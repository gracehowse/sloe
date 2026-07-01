/**
 * coachDayNarrative — grounded "Today's read" for the full Coach screen.
 *
 * The model receives ONLY computed facts about the user's current day
 * (logged totals, targets, remaining macros, meals logged). It writes a
 * warm 2–3 sentence reflection in present tense. When AI is unavailable
 * or fails validation, `buildTemplateCoachDayNarrative` returns a
 * deterministic paragraph from the same facts.
 *
 * Cross-platform: pure — no React, no I/O.
 */

export interface CoachDayFacts {
  /** Human date label, e.g. "Wednesday, 2 July". */
  dateLabel: string;
  caloriesLogged: number;
  calorieTarget: number;
  caloriesRemaining: number;
  proteinLogged: number;
  proteinTarget: number;
  proteinRemaining: number;
  mealsLoggedCount: number;
  /** Next unlogged meal slot, e.g. "Dinner" — null when all slots filled. */
  nextMealSlot: string | null;
}

export interface BuildCoachDayFactsInput {
  dateLabel: string;
  caloriesLogged: number;
  calorieTarget: number;
  proteinLogged: number;
  proteinTarget: number;
  mealsLoggedCount: number;
  nextMealSlot?: string | null;
}

export function buildCoachDayFacts(input: BuildCoachDayFactsInput): CoachDayFacts {
  const calorieTarget = Math.max(0, Math.round(input.calorieTarget));
  const proteinTarget = Math.max(0, Math.round(input.proteinTarget));
  const caloriesLogged = Math.max(0, Math.round(input.caloriesLogged));
  const proteinLogged = Math.max(0, Math.round(input.proteinLogged));
  const mealsLoggedCount = Math.max(0, Math.floor(input.mealsLoggedCount));

  return {
    dateLabel: input.dateLabel.trim(),
    caloriesLogged,
    calorieTarget,
    caloriesRemaining: calorieTarget - caloriesLogged,
    proteinLogged,
    proteinTarget,
    proteinRemaining: proteinTarget - proteinLogged,
    mealsLoggedCount,
    nextMealSlot: input.nextMealSlot?.trim() || null,
  };
}

export const COACH_DAY_SYSTEM_PROMPT = [
  "You are the meal coach inside Sloe, a warm, body-neutral nutrition app.",
  "You write a short reflection on the user's day so far from facts the app",
  "has already computed. Write in the present tense.",
  "",
  "Write 2 to 3 sentences, plain English, second person, warm and supportive.",
  "Tie the facts together; do not just list them.",
  "",
  "Hard rules — breaking any makes the answer unusable:",
  "  - NEVER state a number that is not in the facts provided. Do no arithmetic.",
  "  - NEVER make a health, medical, or weight-loss claim.",
  "  - No emoji. No exclamation marks. No diet-culture or shaming language.",
  "  - Do not invent behaviour the facts do not show.",
  "",
  "Respond with a single JSON object, no markdown fences:",
  '  { "narrative": "your 2-3 sentences here" }',
].join("\n");

export function buildCoachDayUserMessage(facts: CoachDayFacts): string {
  const payload = {
    dateLabel: facts.dateLabel,
    caloriesLogged: facts.caloriesLogged,
    calorieTarget: facts.calorieTarget,
    caloriesRemaining: facts.caloriesRemaining,
    proteinLogged: facts.proteinLogged,
    proteinTarget: facts.proteinTarget,
    proteinRemaining: facts.proteinRemaining,
    mealsLoggedCount: facts.mealsLoggedCount,
    nextMealSlot: facts.nextMealSlot,
  };
  return [
    "Here are the computed facts for the user's day so far.",
    "Write the 2-3 sentence reflection grounded only in these.",
    "",
    JSON.stringify(payload),
  ].join("\n");
}

const MAX_NARRATIVE_LEN = 420 as const;
const MIN_NARRATIVE_LEN = 20 as const;

const BANNED_PATTERNS: readonly RegExp[] = [
  /lose\s+weight/i,
  /weight\s+loss/i,
  /burn\s+fat/i,
  /\bdetox\b/i,
  /\bcleanse\b/i,
  /\bhealthy\b/i,
  /\bunhealthy\b/i,
  /\bguilt\b/i,
  /\bcheat\b/i,
  /you\s+should\b/i,
];

function numbersAreGrounded(text: string, facts: CoachDayFacts): boolean {
  const allowed = new Set<number>();
  const add = (n: number) => {
    if (Number.isFinite(n)) allowed.add(Math.abs(Math.round(n)));
  };
  add(facts.caloriesLogged);
  add(facts.calorieTarget);
  add(facts.caloriesRemaining);
  add(facts.proteinLogged);
  add(facts.proteinTarget);
  add(facts.proteinRemaining);
  add(facts.mealsLoggedCount);

  const matches = text.replace(/,/g, "").match(/\d+(?:\.\d+)?/g) ?? [];
  for (const m of matches) {
    const n = Math.abs(Math.round(Number(m)));
    if (!Number.isFinite(n)) return false;
    if (n < 10) continue;
    if (!allowed.has(n)) return false;
  }
  return true;
}

export function parseCoachDayNarrative(
  rawText: string,
  facts: CoachDayFacts,
): string | null {
  let obj: unknown;
  try {
    const cleaned = rawText.replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
    obj = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const narrative = (obj as { narrative?: unknown }).narrative;
  if (typeof narrative !== "string") return null;
  const trimmed = narrative.trim();
  if (trimmed.length < MIN_NARRATIVE_LEN) return null;
  if (trimmed.length > MAX_NARRATIVE_LEN) return null;
  if (BANNED_PATTERNS.some((re) => re.test(trimmed))) return null;
  if (!numbersAreGrounded(trimmed, facts)) return null;
  return trimmed;
}

export function buildTemplateCoachDayNarrative(facts: CoachDayFacts): string {
  if (facts.mealsLoggedCount <= 0) {
    return "Nothing logged yet today — one meal is enough to give the coach something real to work with.";
  }

  const parts: string[] = [];

  if (facts.caloriesRemaining > 40) {
    parts.push(
      `You have about ${facts.caloriesRemaining.toLocaleString()} kcal left today with ${facts.proteinRemaining > 0 ? `${facts.proteinRemaining}g of protein` : "your protein target"} still open.`,
    );
  } else if (facts.caloriesRemaining < -40) {
    parts.push(
      `You're about ${Math.abs(facts.caloriesRemaining).toLocaleString()} kcal over today's target — the day is already in the books.`,
    );
  } else {
    parts.push(
      `You're sitting close to today's ${facts.calorieTarget.toLocaleString()} kcal target with ${facts.mealsLoggedCount} meal${facts.mealsLoggedCount === 1 ? "" : "s"} logged.`,
    );
  }

  if (facts.proteinRemaining > 15 && facts.nextMealSlot) {
    parts.push(
      `A protein-forward ${facts.nextMealSlot.toLowerCase()} would close most of the gap without crowding the rest of the day.`,
    );
  } else if (facts.nextMealSlot) {
    parts.push(`${facts.nextMealSlot} is still open if you want to keep logging.`);
  } else {
    parts.push("The day's slots are filled — see how the ranked suggestions below fit what is left.");
  }

  return parts.slice(0, 3).join(" ");
}

export interface CoachDayNarrativeResult {
  narrative: string;
  source: "ai" | "template";
}
