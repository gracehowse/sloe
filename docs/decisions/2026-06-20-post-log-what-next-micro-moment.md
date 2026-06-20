# Post-log "what to eat next" micro-moment (ENG-977)

**Date:** 2026-06-20
**Area:** Nutrition / AI logging / Today surface (web + mobile)
**Status:** Resolved

## Context

"What to eat next" is the north-star moment (D-2026-04-27-04). We already
surface it on the Today tab via the meal-coach engine. But the highest-intent
moment in the whole product — the half-second right after a user finishes an
AI log (photo / voice / describe) — was a dead end: we showed a flat "Logged N
items" toast and stopped. Cal AI's whole gap is that it logs and then abandons
you. Bridging log → next-step coaching in that exact beat is the cheapest,
highest-leverage way to feel like a coach rather than a logger.

## Decision

After an AI log commits and there is still budget left for the day, replace the
generic count toast with one calm, grounded line — either a concrete library
suggestion ("~640 kcal left — dinner could be Chicken traybake.") or a plain
budget read-out when nothing in the library fits. One line, no card, no CTA: it
is a nudge, not a surface.

- **Deterministic + grounded.** `buildPostLogSuggestion`
  (`src/lib/nutrition/postLogSuggestion.ts`) reuses the canonical
  `northStarSuggestion` scorer over the user's *own* saved library and the
  *remaining* budget after the just-committed items. It never invents a recipe
  or a number — same grounding contract as the meal coach.
- **Only when it helps.** Returns `null` (→ falls back to the default count
  toast) when the day is already at/over budget, calories are non-finite, or
  the library is too small to suggest from. No nag when there's nothing useful
  to say.
- **Shared one line, both platforms.** The host commit handler
  (`commitAiLoggedItems` in web `NutritionTracker.tsx` / mobile `TodayScreen.tsx`)
  calls the shared helper and renders the identical line — web via the existing
  `sonner` success toast, mobile via a new transient `PostLogSuggestionToast`
  styled to match `FirstLogAcknowledgment`.

## Why this shape (alternatives weighed)

- **A full suggestion card / sheet after logging.** Rejected — interrupts the
  log flow with a heavy surface at the moment the user is trying to move on. A
  one-line toast respects the beat.
- **Always show a suggestion (pick the closest even when over budget).**
  Rejected — suggesting more food when someone is already over their target is
  the opposite of coaching. Silence (default toast) is correct there.
- **A new LLM call for phrasing.** Rejected — unnecessary cost/latency in a
  transient toast. The deterministic line is grounded and instant; the AI
  ranking layer already lives on the Today coach surface.

## Parity

Helper is shared (`src/lib/nutrition/postLogSuggestion.ts`, re-exported through
`@suppr/nutrition-core`). Both platforms wire it into the same AI-commit point
and render the same line. Intentional platform difference: web reuses the
existing `sonner` toast; mobile uses a dedicated `PostLogSuggestionToast`
(RN has no `sonner`) — same copy, same trigger, same dismissal behaviour.

## Events

`post_log_suggestion_shown` added to the shared taxonomy
(`src/lib/analytics/events.ts`) — same name web + mobile, carrying
`{ source, hasSuggestion, slot, platform }` so the suggestion-vs-budget-only
rate is queryable. No PII; recipe ids are not sent (matches
`meal_coach_suggestion_shown`).

## Feature flag

`post_log_what_next_v1` gates the whole micro-moment. Default OFF (a cold /
missing PostHog client resolves to `false`), so until it is ramped the legacy
"Logged N items" toast is byte-identical to pre-ENG-977. See the rollout
runbook for the ramp schedule.
