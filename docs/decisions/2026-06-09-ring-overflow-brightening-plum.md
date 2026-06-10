# Calorie-ring overflow = brightening plum, not warm amber

**Date:** 2026-06-09
**Status:** Resolved
**Area:** Design system / Today hero ring
**Decider:** Claude (delegated by Grace — "does it have to be warm amber? you decide what's actually best")
**Supersedes:** the over-budget treatments before it — the 2026-05 destructive-red flat-fill and the 2026-06-04 lighter-plum interim lap — and **rejects** the amber→coral overflow proposed in the 2026-06-09 Skia-ring spec (Spec 1 §1.3).

## Decision

When `consumed > goal`, the Skia ring draws the overflow as a second lap in a
**brightening aubergine SweepGradient** — the calorie hue intensifying, never a
hue change:

- **Light:** `#5B3B6E → #9A7BAA` (deep-plum lift → lifted lavender), blurred
  leading-cap glow in `#9A7BAA`.
- **Dark:** `#815E91 → #C4ACD0`, cap glow `#C4ACD0`.
- Geometry/behaviour per Spec 1 (same origin, `overFrac` sweep, round caps,
  capped at one extra lap).

The `ring_warm_overflow_v1` sub-flag from the spec is **not needed** — the
overflow ships as part of `ring_skia_v1` with these colours; there is no
amber variant to ramp separately.

## Why not amber→coral

1. **Amber is already claimed twice on this ring** — the fat macro ring and
   the honey activity-bonus arc. A third amber meaning "overage" would have
   the bonus arc ("you earned more") and the overflow ("you went over")
   speaking the same colour with opposite meanings. Violates the one-colour-
   one-meaning rule (design-director 2026-06-09 §7.5).
2. **Same-hue overflow is the canonical premium pattern** (Apple Activity:
   overflow laps in the same colour, layered/brighter). "More plum" = "more
   of the measured thing" — literally true. The old plum lap was only ever
   flagged as a stopgap because SVG couldn't gradient; Skia removes that
   constraint, so the plum treatment gets the premium upgrade rather than
   replacement.
3. **Anti-shame:** warm→coral carries traffic-light residue and its endpoint
   sits next to the removed destructive red. A brightening of the calorie
   colour is information with zero verdict; the centre "N OVER" text and the
   status chip carry the message.

## Unchanged

- Empty/under/goal-hit states per Spec 1 (track, plum fill, win-gradient
  bloom at goal).
- The locked empty=calm / logged-under=success-at-goal mappings.
- The macro/bonus arc colours.
