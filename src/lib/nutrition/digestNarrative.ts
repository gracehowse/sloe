/**
 * digestNarrative — the grounded narrative layer over the weekly digest.
 *
 * `digestStory.ts` produces the factual sentence list ("4 of 7 days
 * logged. You averaged 1,940 kcal vs 2,100 target — 160 under."). This
 * module adds a warm 2-3 sentence COACH narrative on top, in plain
 * English, that ties those facts together — and, when the adaptive-TDEE
 * estimate moved this week, tells that story too ("your maintenance
 * estimate rose this week because you held weight while eating more than
 * we expected").
 *
 * ── Strict grounding contract ────────────────────────────────────────
 *
 * The model receives ONLY computed facts (assembled by `buildNarrativeFacts`
 * from the already-computed digest payload + maintenance move). The
 * instruction forbids new numbers and new claims. Output is
 * schema-validated and length/voice-gated. When the AI is unavailable or
 * fails validation, a deterministic TEMPLATE narrative is produced from
 * the same facts — the surface never goes empty and never shows a number
 * we didn't compute.
 *
 * Brand voice (project-context + digestStory voice rules):
 *   - warm-coaching, body-neutral, supportive adult tone
 *   - no medical / health / weight-loss claims, no prescriptions
 *   - no emoji, no exclamation marks, no diet-culture shaming
 *   - past tense for the closed week ("last week you …")
 *
 * Cross-platform: shared. Pure — no React, no I/O, no Date access. The
 * server route (`app/api/nutrition/digest-narrative`) does the AI call;
 * this module owns the facts, the prompt, the validation, and the
 * deterministic fallback.
 */

/**
 * Adaptive-TDEE move for the week. Supplied only when the estimate
 * actually changed (and confidence is high enough to talk about) — when
 * absent, the narrative simply doesn't mention maintenance. We never
 * invent a reason; the `reason` enum maps to a fixed, honest phrase.
 */
export interface MaintenanceMove {
  /** Direction the maintenance estimate moved this week. */
  direction: "rose" | "fell";
  /** Previous estimate (kcal), pre-rounded by the host. */
  previousKcal: number;
  /** New estimate (kcal), pre-rounded by the host. */
  newKcal: number;
  /**
   * Why it moved — a closed enum so the copy can never drift into an
   * invented physiological claim. The host derives this from the energy-
   * balance inputs it already has.
   */
  reason:
    | "ate_more_held_weight" // ate more than expected but weight held → TDEE up
    | "ate_less_lost_slower" // ate less but lost slower than expected → TDEE down
    | "more_data"; // simply more logged days sharpened the estimate
}

/** Computed facts handed to the model. Every field is a number/label the
 *  host already computed — the model adds NO arithmetic. */
export interface DigestNarrativeFacts {
  /** Human week label, e.g. "May 5 – May 11". */
  weekLabel: string;
  daysLogged: number;
  avgCalories: number | null;
  targetCalories: number | null;
  /** Signed avg − target (kcal). Positive = over. Null when no target. */
  calorieDelta: number | null;
  proteinOnTargetDays: number | null;
  closestDayLabel: string | null;
  /** Present only when maintenance moved this week. */
  maintenanceMove: MaintenanceMove | null;
}

export interface BuildNarrativeFactsInput {
  weekLabel: string;
  daysLogged: number;
  avgCalories: number;
  targetCalories: number;
  proteinOnTargetDays: number;
  closestDayLabel: string | null;
  maintenanceMove?: MaintenanceMove | null;
}

/**
 * Assemble the grounded fact struct from the host's already-computed
 * digest numbers. Nulls out fields that would be a lie (no target, no
 * logged days) so neither the prompt nor the template can reference
 * them.
 */
export function buildNarrativeFacts(
  input: BuildNarrativeFactsInput,
): DigestNarrativeFacts {
  const daysLogged =
    Number.isFinite(input.daysLogged) && input.daysLogged > 0
      ? Math.floor(input.daysLogged)
      : 0;

  const hasTarget =
    Number.isFinite(input.targetCalories) && input.targetCalories > 0;
  const hasAvg = Number.isFinite(input.avgCalories) && input.avgCalories > 0;

  const avgCalories = daysLogged > 0 && hasAvg ? Math.round(input.avgCalories) : null;
  const targetCalories = hasTarget ? Math.round(input.targetCalories) : null;
  const calorieDelta =
    avgCalories != null && targetCalories != null
      ? avgCalories - targetCalories
      : null;

  const proteinOnTargetDays =
    daysLogged > 0 && Number.isFinite(input.proteinOnTargetDays)
      ? Math.max(0, Math.min(daysLogged, Math.floor(input.proteinOnTargetDays)))
      : null;

  return {
    weekLabel: input.weekLabel,
    daysLogged,
    avgCalories,
    targetCalories,
    calorieDelta,
    proteinOnTargetDays,
    closestDayLabel: input.closestDayLabel,
    maintenanceMove: input.maintenanceMove ?? null,
  };
}

/* ───────────────────────── Prompt contract ───────────────────────── */

/**
 * STABLE system prefix — identical every call (prompt-cache friendly).
 * The whole grounding + voice contract lives here; the variable tail
 * (the facts JSON) goes in the user message.
 */
export const DIGEST_NARRATIVE_SYSTEM_PROMPT = [
  "You are the weekly coach inside Suppr, a warm, body-neutral nutrition app.",
  "You write a short reflection on the user's past week from facts the app has",
  "already computed. The week is closed — write in the past tense.",
  "",
  "Write 2 to 3 sentences, plain English, second person, warm and supportive.",
  "Tie the facts together into a small story; do not just list them. If a",
  "maintenance-estimate move is provided, weave that story in naturally.",
  "",
  "Hard rules — breaking any makes the answer unusable:",
  "  - NEVER state a number that is not in the facts provided. Do no arithmetic.",
  "  - NEVER make a health, medical, or weight-loss claim. No 'you'll lose",
  "    weight', no 'this is healthy', no prescriptions or 'you should'.",
  "  - No emoji. No exclamation marks. No diet-culture or shaming language.",
  "  - Do not invent behaviour the facts do not show.",
  "",
  "Respond with a single JSON object, no markdown fences:",
  '  { "narrative": "your 2-3 sentences here" }',
].join("\n");

/** Map a maintenance-move reason enum to an honest, fixed phrase the
 *  model (and the template fallback) can use. Keeps the physiological
 *  framing out of the model's hands entirely. */
export function maintenanceReasonPhrase(reason: MaintenanceMove["reason"]): string {
  switch (reason) {
    case "ate_more_held_weight":
      return "you held your weight while eating a little more than expected";
    case "ate_less_lost_slower":
      return "your weight changed more slowly than your intake alone predicted";
    case "more_data":
      return "another week of logging sharpened the estimate";
  }
}

/** Build the variable user message — the facts as compact JSON plus a
 *  pre-resolved maintenance phrase so the model never derives the reason
 *  itself. */
export function buildNarrativeUserMessage(facts: DigestNarrativeFacts): string {
  const payload = {
    weekLabel: facts.weekLabel,
    daysLogged: facts.daysLogged,
    avgCalories: facts.avgCalories,
    targetCalories: facts.targetCalories,
    calorieDelta: facts.calorieDelta,
    proteinOnTargetDays: facts.proteinOnTargetDays,
    closestDay: facts.closestDayLabel,
    maintenance: facts.maintenanceMove
      ? {
          direction: facts.maintenanceMove.direction,
          previousKcal: facts.maintenanceMove.previousKcal,
          newKcal: facts.maintenanceMove.newKcal,
          reasonPhrase: maintenanceReasonPhrase(facts.maintenanceMove.reason),
        }
      : null,
  };
  return [
    "Here are the computed facts for the user's past week.",
    "Write the 2-3 sentence reflection grounded only in these.",
    "",
    JSON.stringify(payload),
  ].join("\n");
}

/* ──────────────────────── Output validation ──────────────────────── */

/** Max accepted narrative length — 3 warm sentences fit well under this;
 *  longer = the model padded. */
const MAX_NARRATIVE_LEN = 400 as const;
const MIN_NARRATIVE_LEN = 20 as const;

const BANNED_NARRATIVE_PATTERNS: readonly RegExp[] = [
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

/**
 * Parse + validate the model's narrative text. Returns the cleaned
 * narrative string, or `null` when unparseable / empty / too long /
 * voice-violating / containing a digit we can't verify came from facts.
 *
 * Number grounding: we reject any narrative containing a multi-digit
 * number that is NOT one of the allowed figures from the facts. This is
 * the hard guard against the model inventing a calorie/macro number. We
 * allow small standalone counts (single digit + the literal "7", "of 7")
 * because those are the days-logged framing, plus every figure we passed
 * in (target, avg, deltas, maintenance kcal).
 */
export function parseNarrative(
  rawText: string,
  facts: DigestNarrativeFacts,
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
  if (BANNED_NARRATIVE_PATTERNS.some((re) => re.test(trimmed))) return null;
  if (!numbersAreGrounded(trimmed, facts)) return null;
  return trimmed;
}

/** Allowed numeric tokens: every figure we handed the model + the
 *  days-logged framing. Any other multi-character number in the output
 *  is treated as invented and the narrative is rejected. */
function numbersAreGrounded(text: string, facts: DigestNarrativeFacts): boolean {
  const allowed = new Set<number>();
  const add = (n: number | null) => {
    if (n != null && Number.isFinite(n)) allowed.add(Math.abs(Math.round(n)));
  };
  add(facts.daysLogged);
  add(7); // "of 7 days"
  add(facts.avgCalories);
  add(facts.targetCalories);
  add(facts.calorieDelta);
  add(facts.proteinOnTargetDays);
  if (facts.maintenanceMove) {
    add(facts.maintenanceMove.previousKcal);
    add(facts.maintenanceMove.newKcal);
    add(facts.maintenanceMove.newKcal - facts.maintenanceMove.previousKcal);
  }
  // Extract every run of digits (commas/decimal stripped) and check each
  // against the allow-list. Single-digit numbers are always fine (they're
  // the "2 of 7" / sentence-count framing and can't be a calorie figure).
  const matches = text.replace(/,/g, "").match(/\d+(?:\.\d+)?/g) ?? [];
  for (const m of matches) {
    const n = Math.abs(Math.round(Number(m)));
    if (!Number.isFinite(n)) return false;
    if (n < 10) continue; // single/low digit framing — safe
    if (!allowed.has(n)) return false;
  }
  return true;
}

/* ───────────────────── Deterministic template ────────────────────── */

/**
 * Deterministic fallback narrative — the template used when AI is
 * unavailable, over budget, or fails validation. Grounded in exactly the
 * same facts; warm-coaching voice; never empty (returns a calm minimal
 * line even on a quiet week). This guarantees the surface always renders
 * a sensible coach paragraph.
 */
export function buildTemplateNarrative(facts: DigestNarrativeFacts): string {
  const parts: string[] = [];

  if (facts.daysLogged <= 0) {
    return "It was a quiet week — nothing logged. Whenever you're ready, one meal is enough to pick the thread back up.";
  }

  // Lead — days logged.
  parts.push(
    `Last week you logged ${facts.daysLogged} of 7 days.`,
  );

  // Calorie story.
  if (
    facts.avgCalories != null &&
    facts.targetCalories != null &&
    facts.calorieDelta != null
  ) {
    const absDelta = Math.abs(facts.calorieDelta);
    if (absDelta < 25) {
      parts.push(
        `You averaged ${facts.avgCalories.toLocaleString()} kcal, right around your ${facts.targetCalories.toLocaleString()} target.`,
      );
    } else if (facts.calorieDelta > 0) {
      parts.push(
        `You averaged ${facts.avgCalories.toLocaleString()} kcal, about ${absDelta.toLocaleString()} over your ${facts.targetCalories.toLocaleString()} target.`,
      );
    } else {
      parts.push(
        `You averaged ${facts.avgCalories.toLocaleString()} kcal, about ${absDelta.toLocaleString()} under your ${facts.targetCalories.toLocaleString()} target.`,
      );
    }
  }

  // Maintenance move story — only when supplied. This is the most
  // important sentence when the estimate moved (the adaptive-TDEE story),
  // so it's built BEFORE the optional protein/closest colour and reserved
  // a slot inside the 3-sentence budget below.
  let maintenanceSentence: string | null = null;
  if (facts.maintenanceMove) {
    const m = facts.maintenanceMove;
    maintenanceSentence = `Your maintenance estimate ${m.direction} to about ${m.newKcal.toLocaleString()} kcal this week — ${maintenanceReasonPhrase(m.reason)}.`;
  }

  // Protein + closest-day colour, kept to one calm clause. Suppressed
  // when a maintenance sentence already fills the optional third slot —
  // the adaptive-TDEE story is higher-signal than the protein-day count.
  if (!maintenanceSentence) {
    if (facts.proteinOnTargetDays != null && facts.proteinOnTargetDays > 0) {
      parts.push(
        `Protein landed on target on ${facts.proteinOnTargetDays} of those days.`,
      );
    } else if (facts.closestDayLabel) {
      parts.push(`${facts.closestDayLabel} was your closest day.`);
    }
  }

  // Keep the template to 2-3 sentences max, matching the AI contract.
  // Reserve the final slot for the maintenance story when present so it
  // can never be crowded out by the calorie/protein clauses.
  const trimmed = maintenanceSentence ? parts.slice(0, 2) : parts.slice(0, 3);
  if (maintenanceSentence) trimmed.push(maintenanceSentence);
  return trimmed.join(" ");
}

/** Result shape the digest-narrative route returns. */
export interface DigestNarrativeResult {
  narrative: string;
  source: "ai" | "template";
}
