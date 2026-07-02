# ENG-1240 — Full Coach screen (Today's read + Ask chips)

**Date:** 2026-07-01  
**Area:** AI features / Today / Coach  
**Status:** Shipped behind `coach_screen_v1`

## Decision

Ship the prototype's unified **Coach** destination as a flag-gated push screen on web (`/coach`) and mobile (`/coach`), while keeping the Today one-liner coach hint as the lightweight entry when the flag is off.

The screen has three sections:

1. **Today's read** — grounded day narrative (`coachDayNarrative` + `POST /api/nutrition/coach-day-narrative`)
2. **What to eat next** — ranked saved-recipe list (`mealCoach` + existing `POST /api/nutrition/coach`)
3. **Ask the coach** — three bounded chips with grounded answers (`coachAsk` + `POST /api/nutrition/coach-ask`)

When `coach_screen_v1` is on, tapping the Today hero coach line opens `/coach`. When off, behaviour is unchanged (one-liner only).

## Grounding contract

Same posture as `digestNarrative` and `mealCoach`:

- Facts are assembled client-side from logged totals + targets the app already computed.
- The model may only phrase over those facts; output is schema-validated and number-grounded.
- Template fallbacks guarantee non-empty surfaces when AI is off, over budget, or off-contract.

## Parity

- Shared pure libs in `src/lib/nutrition/coachDayNarrative.ts` and `coachAsk.ts`
- Web: `app/coach/page.tsx` + `coach-screen-client.tsx`
- Mobile: `apps/mobile/app/coach.tsx` + `CoachScreenView.tsx`
- Kill switches: `kill_coach_day_narrative_ai`, `kill_coach_ask_ai` (server flags)

## Tier gating (2026-07-01 update, ENG-1292)

The AI branch on all three routes (`coach`, `coach-ask`, `coach-day-narrative`) is **Pro-only, server-enforced** via `getUserTier` (voice-log precedent, `2026-04-19-voice-logging-pro-only-server-enforced.md`) per sweep decision #1 (`2026-07-01-sweep-decisions.md`). Free/Base users get the deterministic/template result with the same 200 response shape (`source: "deterministic"` / `"template"`) — the screen and endpoints stay free; only the Claude calls are gated. Supersedes the ungated state this screen originally shipped with.

## Analytics

- `coach_screen_opened`
- `coach_ask_chip_tapped` (`chip_id`)

## Overlap note

Intentionally **not** started ENG-1233/ENG-1241 (onboarding) while Claude owns ENG-1247 prototype-conformance on onboarding surfaces.
