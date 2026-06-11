/**
 * mealCoach — the "what to eat next" coach engine.
 *
 * North-star moment (D-2026-04-27-04): "What should I eat next, from my
 * own library, that hits the macros I have left?" This module is the
 * *brain* behind the Today suggestion surface — it replaces the
 * presentational glue's direct call to `pickNorthStarSuggestion`, not
 * the surface itself.
 *
 * ── Design contract ──────────────────────────────────────────────────
 *
 * The LLM never invents foods and never computes nutrition. ALL numbers
 * (calories, macros, deltas, fit bands) come from OUR data, scored by
 * the existing deterministic `northStarSuggestion` scorer. The model is
 * handed a PRE-FILTERED, PRE-SCORED candidate list and may only:
 *   1. re-order it (select which of OUR candidates is the best pick), and
 *   2. phrase a one-line WHY for each, grounded in the figures we gave it.
 *
 * Two-stage shape:
 *   - `assembleCandidates()` — PURE. Gathers the candidate set
 *     deterministically: filters the user's library by remaining-budget
 *     fit window + time-of-day slot + a recency/variety penalty, then
 *     ranks via the canonical scorer. Returns the top N with a
 *     deterministic fallback why-line baked into each. This is also the
 *     deterministic-fallback answer when AI is unavailable.
 *   - The server route (`app/api/nutrition/coach`) calls
 *     `assembleCandidates()`, then `buildCoachPrompt()` +
 *     `parseCoachRanking()` to fold the model's re-rank/phrasing back
 *     onto OUR candidates. `applyCoachRanking()` does the merge with a
 *     hard guarantee: any id the model invents or drops is ignored, the
 *     deterministic order fills the gaps, and the numbers are always
 *     ours.
 *
 * The surface must NEVER go empty because AI failed: every AI failure
 * path returns the deterministic `assembleCandidates()` result.
 *
 * Cross-platform: shared. Mobile imports via the `@suppr/shared`
 * alias (same pattern as `northStarSuggestion`). Pure — no React, no
 * I/O, no Date access (callers thread `now`/`slot`).
 */

import {
  NORTH_STAR_LIBRARY_MIN,
  bandLabel,
  pickNorthStarSuggestion,
  whyLineForSuggestion,
  type NorthStarRecipe,
  type NorthStarRemaining,
  type NorthStarSlot,
  type NorthStarSuggestion,
} from "./northStarSuggestion";

/** Default number of candidates surfaced to the model + to the caller. */
export const COACH_CANDIDATE_LIMIT = 4 as const;

/**
 * Variety penalty (score units) added per recently-suggested recipe so
 * the coach rotates the library instead of fixating on the single
 * best-scoring recipe every time. Applied to the canonical scorer's
 * `score` (lower = better) so a recently-shown recipe must be
 * meaningfully better to out-rank a fresh one. Tunable; exported so a
 * future experiment can rebind it without a code change.
 */
export const COACH_RECENCY_PENALTY = 40 as const;

/** One assembled candidate — OUR numbers, never the model's. */
export interface CoachCandidate {
  recipeId: string;
  title: string;
  thumbnail?: string;
  /** ONE serving — identical to the recipe detail + north-star card. */
  predictedCalories: number;
  predictedProtein: number;
  predictedCarbs: number;
  predictedFat: number;
  /** Per-meal adherence band ("tight" | "close" | "loose"). */
  band: NorthStarSuggestion["band"];
  /** Human band chip ("Hits within 3%" / "Close fit" / "Roughly fits"). */
  bandLabel: string;
  /** Deterministic WHY line — the fallback shown when AI is unavailable
   *  or the model's phrasing fails validation. Always present. */
  whyLine: string;
  /** Lower = better. The canonical scorer score + variety penalty.
   *  Drives the deterministic order. */
  score: number;
  /** Optional cook time (minutes) for the hero meta chip. */
  cookTimeMin?: number;
}

export interface AssembleCandidatesOptions {
  /** Time-of-day slot. When set, recipes tagged for other slots are
   *  excluded and the per-meal budget uses this slot's share. */
  slot?: NorthStarSlot["slot"];
  /** Recipe ids the user skipped today — hard-excluded. */
  excludeIds?: ReadonlySet<string>;
  /** Recipe ids suggested recently (e.g. in the last few days) — kept in
   *  the running but variety-penalised so the coach rotates. */
  recentlySuggestedIds?: ReadonlySet<string>;
  /** Max candidates to return. Default `COACH_CANDIDATE_LIMIT`. */
  limit?: number;
}

/**
 * Assemble the ranked candidate set deterministically.
 *
 * Returns `[]` (never throws) when:
 *   - the library is empty,
 *   - remaining is non-finite,
 *   - remaining calories ≤ 0 (at/over budget — caller shows the calm
 *     over-budget caption, not a suggestion),
 *   - every candidate is hard-excluded.
 *
 * The first element is the deterministic best pick. Order is by ascending
 * `score` (canonical scorer + variety penalty for recently-suggested
 * recipes).
 */
export function assembleCandidates(
  library: readonly NorthStarRecipe[],
  remaining: NorthStarRemaining,
  options?: AssembleCandidatesOptions,
): CoachCandidate[] {
  const limit = Math.max(1, options?.limit ?? COACH_CANDIDATE_LIMIT);
  const exclude = options?.excludeIds ?? new Set<string>();
  const recent = options?.recentlySuggestedIds ?? new Set<string>();

  if (!library || library.length === 0) return [];
  if (remaining.calories <= 0 || !Number.isFinite(remaining.calories)) return [];

  // Re-use the canonical scorer one recipe at a time so the candidate
  // set inherits the exact same fit-window logic (per-meal budget, slot
  // filtering, asymmetric over/under penalty) the single-pick block
  // already ships. Each single-recipe library run returns either the
  // best (== only) suggestion for that recipe or null when it doesn't
  // fit. This keeps mealCoach a thin ranking layer over one source of
  // truth rather than a fork of the scorer.
  const scored: CoachCandidate[] = [];
  for (const recipe of library) {
    if (exclude.has(recipe.id)) continue;
    const suggestion = pickNorthStarSuggestion([recipe], remaining, {
      slot: options?.slot,
      // excludeIds already applied above; pass empty so the slot filter
      // is the only further gate inside the scorer.
    });
    if (!suggestion) continue;
    const varietyPenalty = recent.has(recipe.id) ? COACH_RECENCY_PENALTY : 0;
    scored.push({
      recipeId: suggestion.recipe.id,
      title: suggestion.recipe.title,
      thumbnail: suggestion.recipe.thumbnail,
      predictedCalories: suggestion.predictedCalories,
      predictedProtein: suggestion.predictedProtein,
      predictedCarbs: suggestion.predictedCarbs,
      predictedFat: suggestion.predictedFat,
      band: suggestion.band,
      bandLabel: bandLabel(suggestion.band),
      whyLine: whyLineForSuggestion(suggestion, remaining),
      score: suggestion.score + varietyPenalty,
      cookTimeMin: suggestion.recipe.cookTimeMin ?? undefined,
    });
  }

  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit);
}

/**
 * Whether the coach should even attempt a suggestion given library size.
 * Thin re-export of the north-star threshold so callers don't import two
 * modules. The activation-window relax lives in
 * `isLibraryEligibleForNorthStar` — callers that have the account age
 * should prefer that; this is the steady-state floor.
 */
export function isLibraryEligibleForCoach(librarySize: number): boolean {
  return Number.isFinite(librarySize) && librarySize >= NORTH_STAR_LIBRARY_MIN;
}

/* ───────────────────────── Prompt contract ───────────────────────── */

/**
 * STABLE system prefix — identical every call so Anthropic prompt
 * caching can hit. Carries the entire behavioural contract; no
 * user-specific data here. The variable tail (candidates + budget) goes
 * in the user message via `buildCoachUserMessage`.
 *
 * The contract is deliberately strict and repeated: the model SELECTS
 * and PHRASES over OUR candidates. It must not invent foods, must not
 * change any number, must not recommend anything not in the list.
 */
export const COACH_SYSTEM_PROMPT = [
  "You are the meal coach inside Suppr, a warm, body-neutral nutrition app.",
  "You help someone choose what to cook or eat next from THEIR OWN saved recipes.",
  "",
  "You are given a pre-scored list of candidate recipes from the user's library",
  "and the macros they have left for the day. Every number has already been",
  "computed by the app from verified data.",
  "",
  "Your job is ONLY to:",
  "  1. Choose the single best candidate and an ordering of the rest.",
  "  2. Write a short, warm, one-line reason for each that is GROUNDED in the",
  "     numbers provided — naming the macro or calorie fit that makes it a good",
  "     pick (e.g. 'fits your remaining 612 kcal and tops up protein').",
  "",
  "Hard rules — breaking any of these makes the answer unusable:",
  "  - NEVER invent a recipe. Only ever reference the candidate ids given.",
  "  - NEVER state a calorie or macro number that is not in the candidate data",
  "    or the remaining-budget data. Do not do arithmetic of your own.",
  "  - NEVER make a health, medical, or weight-loss claim. No 'this will help",
  "    you lose weight', no 'good for you', no prescriptive language.",
  "  - Keep each reason under 90 characters, plain English, second person.",
  "  - No emoji. No exclamation marks. No diet-culture or shaming language.",
  "",
  "Respond with a single JSON object, no markdown fences:",
  '  { "rankedIds": ["id1","id2",...], "reasons": { "id1": "...", "id2": "..." } }',
  "rankedIds must be a permutation of (a subset of) the candidate ids — best",
  "first. reasons maps each id you ranked to its one-line reason.",
].join("\n");

/**
 * Build the variable user message: the candidate list + remaining budget
 * as compact JSON. This is the only part that changes per call, so the
 * stable system prefix above stays cache-friendly.
 */
export function buildCoachUserMessage(
  candidates: readonly CoachCandidate[],
  remaining: NorthStarRemaining,
  slot?: NorthStarSlot["slot"] | null,
): string {
  const payload = {
    slot: slot ?? "any",
    remaining: {
      calories: Math.round(remaining.calories),
      protein: Math.round(remaining.protein),
      carbs: Math.round(remaining.carbs),
      fat: Math.round(remaining.fat),
    },
    candidates: candidates.map((c) => ({
      id: c.recipeId,
      title: c.title,
      calories: c.predictedCalories,
      protein: c.predictedProtein,
      carbs: c.predictedCarbs,
      fat: c.predictedFat,
      fit: c.band,
    })),
  };
  return [
    "Here are the candidates and the macros left for today.",
    "Pick the best one and order the rest, with a grounded reason for each.",
    "",
    JSON.stringify(payload),
  ].join("\n");
}

/* ──────────────────────── Output validation ──────────────────────── */

export interface CoachRanking {
  /** Ordered recipe ids — best first. A subset/permutation of the
   *  candidate ids; ids the model invented are dropped during parse. */
  rankedIds: string[];
  /** Per-id reason phrasing from the model, already validated (length,
   *  non-empty, no banned shapes). Ids the model didn't reason about are
   *  absent — `applyCoachRanking` falls back to OUR deterministic line. */
  reasons: Record<string, string>;
}

/** Max length we accept for a model reason; longer = phrasing went off
 *  the rails (the prompt asks for < 90). We hard-cap at 120. */
const MAX_REASON_LEN = 120 as const;

/** Banned substrings — health/medical/diet-culture claims the brand
 *  voice forbids. Case-insensitive. A reason containing any of these is
 *  rejected (the candidate keeps its deterministic line instead). */
const BANNED_REASON_PATTERNS: readonly RegExp[] = [
  /lose\s+weight/i,
  /weight\s+loss/i,
  /burn\s+fat/i,
  /\bdetox\b/i,
  /\bcleanse\b/i,
  /\bhealthy\b/i,
  /\bguilt\b/i,
  /\bcheat\b/i,
  /\bclean\s+eating\b/i,
  /\bshould\s+eat\b/i,
];

/**
 * Parse + schema-validate the raw model text into a `CoachRanking`,
 * scoped to the known candidate ids. Returns `null` when the output is
 * unparseable or contains nothing usable — the caller then falls back to
 * the deterministic candidate order.
 *
 * Validation guarantees:
 *   - JSON object with `rankedIds: string[]`.
 *   - Every id in `rankedIds` is a real candidate id (invented ids
 *     dropped). Duplicates collapsed, first occurrence wins.
 *   - `reasons` only retains entries for kept ids, non-empty, trimmed,
 *     length-capped, and free of banned claim shapes.
 */
export function parseCoachRanking(
  rawText: string,
  candidateIds: readonly string[],
): CoachRanking | null {
  const known = new Set(candidateIds);
  let obj: unknown;
  try {
    const cleaned = rawText.replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
    obj = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const record = obj as { rankedIds?: unknown; reasons?: unknown };

  const rawIds = Array.isArray(record.rankedIds) ? record.rankedIds : [];
  const rankedIds: string[] = [];
  const seen = new Set<string>();
  for (const id of rawIds) {
    if (typeof id !== "string") continue;
    if (!known.has(id)) continue; // drop invented ids
    if (seen.has(id)) continue; // collapse duplicates
    seen.add(id);
    rankedIds.push(id);
  }
  if (rankedIds.length === 0) return null;

  const reasons: Record<string, string> = {};
  const rawReasons =
    record.reasons && typeof record.reasons === "object"
      ? (record.reasons as Record<string, unknown>)
      : {};
  for (const id of rankedIds) {
    const raw = rawReasons[id];
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.length > MAX_REASON_LEN) continue;
    if (BANNED_REASON_PATTERNS.some((re) => re.test(trimmed))) continue;
    reasons[id] = trimmed;
  }

  return { rankedIds, reasons };
}

/**
 * Fold the model's ranking + phrasing back onto OUR candidates with a
 * hard guarantee that the numbers and the candidate set stay ours.
 *
 *   - Order: the model's `rankedIds` first (in its order), then any
 *     candidate the model omitted, in deterministic score order. So even
 *     a partial ranking can never lose a candidate.
 *   - Why line: the model's reason for an id when it passed validation,
 *     otherwise OUR deterministic `whyLine`. Never empty.
 *   - Numbers: always the candidate's own predicted figures.
 *
 * When `ranking` is null (AI failed / unavailable / unparseable), the
 * deterministic candidate order is returned unchanged — the surface
 * never goes empty.
 */
export function applyCoachRanking(
  candidates: readonly CoachCandidate[],
  ranking: CoachRanking | null,
): CoachCandidate[] {
  if (!ranking || ranking.rankedIds.length === 0) {
    return [...candidates];
  }
  const byId = new Map(candidates.map((c) => [c.recipeId, c]));
  const out: CoachCandidate[] = [];
  const used = new Set<string>();
  for (const id of ranking.rankedIds) {
    const cand = byId.get(id);
    if (!cand) continue;
    used.add(id);
    const modelReason = ranking.reasons[id];
    out.push(modelReason ? { ...cand, whyLine: modelReason } : cand);
  }
  // Append any candidate the model didn't rank, preserving the
  // deterministic (score-ascending) order they arrived in.
  for (const cand of candidates) {
    if (used.has(cand.recipeId)) continue;
    out.push(cand);
  }
  return out;
}

/** The shape the coach route returns + the Today surface consumes. */
export interface CoachResult {
  /** Ranked candidates — best first. Empty only when no recipe fits. */
  candidates: CoachCandidate[];
  /** How the ranking was produced. The surface can show an "AI" affordance
   *  only when `source === "ai"`; otherwise it's the deterministic pick. */
  source: "ai" | "deterministic";
}
