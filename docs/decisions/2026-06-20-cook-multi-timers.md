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
