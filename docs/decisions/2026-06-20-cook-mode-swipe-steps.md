# Cook-mode swipe-between-steps (ENG-947)

**Date:** 2026-06-20  
**Area:** Recipes / Cook mode  
**Status:** Resolved  
**Linear:** ENG-947  
**Flag:** `cook_swipe_steps_v1` (default-OFF)

## Context

Cook mode on both platforms was button-only (Previous / Next). Category
research (Crouton, Kitchen Stories) shows swipe-to-cycle is the signature
interaction users praise — especially with messy hands at the counter.

## Decision

Add **horizontal swipe between steps** with the existing selection haptic on
step change, while keeping Prev/Next as the accessible fallback.

- Shared pure helper `src/lib/nutrition/cookStepSwipe.ts` owns swipe
  thresholds, velocity flick detection, and edge rubber-banding so web touch
  handlers and mobile Pan gestures behave identically.
- **Mobile:** `CookStepSwipeSurface` (Pan gesture + gentle slide animation) wraps
  step content on `/cook` and the recipe-detail cook overlay. When the flag is
  ON, the legacy filled progress bar is replaced by `CookStepPageIndicator`
  (quiet segment track — mirrors web).
- **Web:** touch swipe on the main step area; segment indicator already existed
  in `CookMode.tsx` and stays visible regardless of flag.

Motion is editorial — a soft page-turn slide, not a snappy carousel.

## Flag posture

Structural cook UI ships gated per project rules:

- Flag-OFF → byte-identical to pre-ENG-947 (buttons only; mobile keeps the
  legacy progress bar).
- Flag-ON → swipe + segment indicator on mobile; touch swipe on web.

Ramp: validate in iOS sim + web → 100% for single tester → remove gate after
two clean weeks. See `docs/operations/posthog-rollout.md`.

## Analytics

`cook_step_swiped` — fires on each committed swipe (not button nav) with
`{ direction: "next" | "prev", platform: "web" | "ios" }`.

## Parity

Same thresholds and bounds from the shared helper. Intentional differences:
mobile uses `react-native-gesture-handler` Pan + Animated slide; web uses
touchstart/touchend with zero velocity (distance-only commit).
