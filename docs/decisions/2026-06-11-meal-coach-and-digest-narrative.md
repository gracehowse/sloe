# Meal coach engine + grounded digest narrative

**Date:** 2026-06-11
**Area:** Nutrition / AI / Today + Progress surfaces
**Status:** Resolved

## Context

"What to eat next" is the north-star moment (D-2026-04-27-04). Until now the
Today suggestion surface was driven by a purely deterministic single-pick
scorer (`northStarSuggestion.ts`). The strategic direction calls for an AI
layer that *reasons over the user's own data* — their library, their
remaining macros, their adaptive-maintenance story — without ever inventing
food or nutrition numbers. Same intent on Progress: the weekly digest should
read as a warm coach narrative, not a stat dump.

## Decision

Two AI features ship behind a hard, non-negotiable grounding contract.

### 1. Coach engine (`src/lib/nutrition/mealCoach.ts` + `POST /api/nutrition/coach`)

- **Deterministic spine.** `assembleCandidates()` reuses the canonical
  `northStarSuggestion` scorer to build a ranked candidate set from the
  user's saved library, filtered by remaining-budget fit window +
  time-of-day slot, with a variety penalty for recently-suggested recipes.
  This is also the answer when AI is unavailable.
- **The LLM ranks + phrases only.** The model (Claude Haiku) receives the
  pre-scored candidate list + remaining budget and may only (a) re-order it
  and (b) write a grounded one-line WHY per candidate. It never invents a
  recipe and never states a number that isn't ours.
- **Validated + folded back.** `parseCoachRanking` drops invented ids,
  collapses duplicates, and rejects reasons that make health/diet-culture
  claims or run over-length. `applyCoachRanking` merges the model's order +
  phrasing onto **our** candidates — numbers stay ours, no candidate is lost.
- **Surface never empties.** Every AI failure path (provider error, timeout,
  `AiBudgetExceededError`, unparseable output, `kill_meal_coach_ai` flag,
  or < 2 candidates) returns the deterministic order.

### 2. Digest narrative (`src/lib/nutrition/digestNarrative.ts` + `POST /api/nutrition/digest-narrative`)

- **Facts in, sentences out.** `buildNarrativeFacts` assembles only computed
  facts (nulling anything that would be a lie — no target, no logged days).
  The model writes 2–3 warm, past-tense, body-neutral sentences grounded in
  exactly those facts, weaving in the adaptive-TDEE move when it changed.
- **Reason enum, not free-form physiology.** The maintenance-move reason is a
  closed enum (`ate_more_held_weight` / `ate_less_lost_slower` / `more_data`)
  mapped to a fixed honest phrase server-side, so the model never invents the
  "why your maintenance moved" framing.
- **Hard number guard.** `parseNarrative` rejects any multi-digit number not
  present in the facts, plus banned health/weight-loss/"you should" phrasing.
- **Template fallback** (`buildTemplateNarrative`) is grounded in the same
  facts and is used whenever AI is unavailable, over budget, off-contract, or
  the `kill_digest_narrative_ai` flag is on.

## Why this shape (alternatives weighed)

- **Let the model pick from the raw library.** Rejected — it would let the
  model invent foods/numbers and bypass the verified scorer. The candidate
  pre-filter is the whole safety story.
- **Pure deterministic copy, no AI.** Rejected — loses the warmth/reasoning
  that is the differentiator. But it survives as the always-present fallback,
  so we get the AI upside with zero "AI broke → blank surface" risk.
- **Free-form maintenance explanation.** Rejected — a model explaining
  physiology is a health-claim risk. The enum→phrase mapping keeps the
  framing ours.

## Parity

Engine + routes are shared. Both platforms get a non-blocking `useCoach`
hook (`src/lib/today/useCoach.ts` web, `apps/mobile/lib/useCoach.ts` mobile)
that renders the deterministic candidates synchronously and swaps in the AI
ranking when it arrives. Today-surface one-line wiring on mobile
(`apps/mobile/app/(tabs)/index.tsx`) is deferred behind the rhythm-sweep
agent's edit — tracked, not silent (see the journey doc).

## Events

`meal_coach_suggestion_shown` and `digest_narrative_shown` added to the
shared taxonomy (`src/lib/analytics/events.ts`) — same name web + mobile,
each carrying `source` so the AI-vs-fallback rate is queryable. No PII;
recipe ids are not sent.

## Feature flags (kill switches)

`kill_meal_coach_ai` and `kill_digest_narrative_ai` cut the AI layer
instantly without a deploy; the deterministic path keeps working.
