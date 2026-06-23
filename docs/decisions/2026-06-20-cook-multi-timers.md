# Cook-mode multi-timers (ENG-948)

**Date:** 2026-06-20  
**Area:** Cook mode (mobile-primary; web already shipped)  
**Status:** Resolved  
**Linear:** ENG-948  
**Flag:** `cook_multi_timers_v1` (default-OFF)

## Context

Real cooking is parallel — sauce simmering while pasta boils. Suppr parsed only
the **first** duration in a step and ran **one** countdown at a time on mobile.
Web `CookMode.tsx` already supported one pill per match plus a concurrent
heads-up strip; mobile lagged.

## Decision

Port web multi-timer behaviour to mobile `apps/mobile/app/cook.tsx` behind
`cook_multi_timers_v1`:

- **One pill per** `parseTimersInStep` match in the current step (not just the first).
- **Concurrent countdown stack** — timers started on earlier steps stay visible;
  reset/cancel per chip; success haptic + `recipe_timer_completed` on each finish.
- **Stopwatch fallback** preserved when no parsed duration or user prefers count-up.
- Shared pure helpers in `src/lib/nutrition/cookRunningTimers.ts`; mobile hook
  `useCookRunningTimers`.

## Flag posture

Default-OFF. Flag-OFF → legacy single suggested-timer pill + one countdown;
byte-identical to pre-ENG-948 mobile.

## Parity

Web unchanged (multi-timer already live). Mobile catches up when flag ramps.

## Analytics

Existing events only: `recipe_timer_started`, `recipe_timer_completed` — one fire
per timer start/completion (same as web).

## ENG-1230 follow-up — timers ported to the LIVE inline overlay (2026-06-23)

The original ENG-948 port landed the timer UI in `apps/mobile/app/cook.tsx` — the
**orphaned standalone `/cook` route**, which the live "Start Cooking" button does
**not** open. The button opens the **inline cook overlay inside
`apps/mobile/app/recipe/[id].tsx`** (the `CookStepSwipeSurface` path, ENG-1230),
which had **zero timers**. So the cook path the user actually reaches was missing
timers that already existed in the codebase (`cook.tsx`) and on web
(`CookMode.tsx`) — an unflagged parity break flagged by the 2026-06-22 Sloe-v3
completion audit.

**Fix (2026-06-23):** extracted the timer wiring into
`apps/mobile/components/cook/CookTimerPanel.tsx` — a small self-contained component
(keeps the pinned `recipe/[id].tsx` screen file within its line-budget cap) that
reuses the **existing** primitives without rebuilding them:

- `useCookRunningTimers` hook (tick + Success haptic + `recipe_timer_completed`),
- `CookStepTimerPills` (one tappable pill per parsed duration), and
- `CookRunningTimerStrip` (concurrent countdown stack, reset/cancel per chip).

Wired into the inline overlay under the step text, gated behind the same
`cook_multi_timers_v1` flag (flag-OFF renders nothing — byte-identical revert).
Timers parse off the **RAW `cleanedStep`** (pre-scale), matching web's
`currentStepCleaned`, so offsets stay stable as the serving scale changes. The
button's cook path is unchanged; the swipe/step flow is intact.

**Platform divergence (not a gap):** web's timer-done feedback is `playChime()`
(an AudioContext tone) + a toast; mobile's is the **Success haptic** (via the
shared hook) + the strip's "Done!" state — the standard native-haptics-vs-web-audio
divergence, identical to the orphaned `cook.tsx` multi-timer path.

**Tests:** `apps/mobile/tests/unit/cookInlineTimersParity.test.ts` pins the overlay
wiring (panel present, flag-gated, RAW-step parse) and that `CookTimerPanel` reuses
the shared hook + both components rather than rebuilding them.

**Owed:** on-device SEE in the simulator before the flag re-flips (per the
completion audit's "per-flag on-device validation" gate — the swipe-surface
layout-collapse half of ENG-1230 was the reason the flags were reverted to OFF).
