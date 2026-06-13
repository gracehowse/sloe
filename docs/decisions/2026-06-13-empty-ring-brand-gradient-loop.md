# Empty cold-open calorie ring → brand-gradient loop (ENG-1086)

**Date:** 2026-06-13
**Area:** Today tab / calorie ring (web + mobile)
**Status:** Resolved
**Flag:** `ring_empty_gradient_v1` (in `REDESIGN_DEFAULT_ON` both platforms; legacy grey-track + 1px hairline empty render is the kill switch)

## Context

The senior-designer read (2026-06-13, design-director brief Move 1 — *highest
first-impression leverage*) found the cold-open empty calorie ring rendered as
**pale concentric grey hoops** around "1,231 LEFT" — it read as a loading
skeleton, the weakest-rendered element on the most-viewed screen. Root cause: the
empty branch painted only the grey *track* (+ a 1px inner hairline + 3 thin grey
macro tracks when expanded), so there was **zero brand colour on the largest
object on the cold-open screen**.

## Decision

Paint the empty ring as a **confident brand-gradient loop**:

- **Gradient:** a full 360° `AccentWinGradient` sweep (`#3B2A4D → #5B3B6E →
  #7E5C92`, the existing brand stops) at **~0.36 opacity** (new token
  `RING_EMPTY_GRADIENT_OPACITY` / `--ring-empty-gradient-opacity`). Mobile uses a
  Skia `SweepGradient` (rotational); web uses an SVG `linearGradient`
  (`#ringEmptyGradient`, distinct from the warm `winSpectrum` celebration def).
- **Stroke:** the confident collapsed-hero stroke (0.085·S) on the empty ring so
  the loop reads as intentional, not a thin outline. Isolated to the empty ring
  on the Skia/SVG path — populated/collapsed states and the mobile SVG fallback
  keep their existing stroke.
- **Drop** the empty-state 1px inner hairline.
- **Hide** the inner macro tracks in the empty state (three nested grey arcs were
  the "wireframe" tell) — the single gradient loop carries the cold open.

This does **not** change the ring's state-colour semantics (empty = gradient /
under = plum fill / over = plum capped-at-full + centre verdict) — only the craft
of the *empty* render. The seamless wrap repeats the first stop at the tail so
there is no hard seam at the gradient's start angle.

### Flag choice — dedicated, not `ring_skia_v1`

The brief suggested gating on the existing `ring_skia_v1`, but that flag is the
whole premium Skia ring (round caps, goal-hit glow, overflow). A regression in
just the empty gradient should not require disabling all of Skia. So this ships
behind a dedicated `ring_empty_gradient_v1` (default-on), with the legacy grey
empty render in the `else` — a precise kill switch, exactly per the CLAUDE.md
flag contract.

### Not a native rebuild

`@shopify/react-native-skia` is already linked in the dev clients; `SweepGradient`
is a JS wrapper over the existing native shader, so this is a hot-reloadable JS
render change — no EAS rebuild needed (the brief's "EAS build" note was
overcautious).

## Files

- `apps/mobile/components/charts/SkiaRingArcs.tsx` — `SweepGradient` empty sweep
- `apps/mobile/components/charts/CalorieRing.tsx` — flag wiring + bold empty stroke
- `apps/mobile/constants/theme.ts` — `RING_EMPTY_GRADIENT_OPACITY`
- `src/app/components/suppr/daily-ring.tsx` — `#ringEmptyGradient` + flag (web parity)
- `src/styles/theme.css` — `--ring-empty-gradient-opacity`
- `apps/mobile/lib/analytics.ts`, `src/lib/analytics/track.ts` — flag in `REDESIGN_DEFAULT_ON`
- Tests: `tests/unit/ringEmptyGradient.test.ts`

## Verified

iOS simulator (Today cold-open, consumed = 0): one confident bold plum-gradient
loop replaced the pale concentric grey hoops. Web (`--vp mobile`, `/today`):
identical bold plum-gradient empty loop. Ring suites green on both platforms;
both typechecks clean. Comparable: Oura late-2025 / Apple Fitness empty rings.
