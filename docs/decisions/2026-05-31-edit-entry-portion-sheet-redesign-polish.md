# Edit-entry + portion sheet redesign polish: morph, elevation, confirm haptic (ENG-813)

**Date:** 2026-05-31
**Status:** Resolved (mobile shipped behind redesign flags; web parity tracked — see "Parity")
**Area:** Today / Logging / Saved meals / Motion + Depth
**Flags:** `redesign_motion` (morph + haptic), `design_system_elevation` (resting-card lift)
**Related:** [`2026-05-30-edit-entry-v2-and-saved-meal-portion.md`](2026-05-30-edit-entry-v2-and-saved-meal-portion.md) (the ENG-783 base sheets this polishes), [`2026-05-31-design-director-review-and-direction.md`](2026-05-31-design-director-review-and-direction.md) (the 5 spine rules), `docs/planning/2026-05-31-redesign-implementation-plan.md` (P1 "Edit-entry and portion sheet polish")

## The ask

The 2026-05-31 design-director review scored the logging flow as
"competent tracker" — the depth, motion, and delight floor of the
product. `TodayEditMealModal` (V2) and `SavedMealPortionSheet` are the
two sheets the user touches most during the daily loop, and both opened
with a plain `Modal animationType="slide"`, drew their content cards with
a flat hairline border, and confirmed with no haptic. This lane applies
the three relevant spine rules to those two sheets, each behind a Phase 0
redesign flag with the OLD path kept alive in the `else`.

## Decision

Three additive layers on top of the existing ENG-783 `EditEntryV2` +
`SavedMealPortionSheet` bodies. None changes the sheets' structure, copy,
or write path — they are pure depth/motion/feedback polish.

### 1. Element→sheet morph on open — `redesign_motion`

Both sheets now drive their entry through `useSheetMorph(open)` from the
shared mobile motion lib (`apps/mobile/lib/motion.ts`, ENG-812), whose
spring numbers come from the single source of truth in `src/lib/motion.ts`
(`SPRING_DEFAULT` — damping 18, stiffness 200, mass 0.7). The sheet panel
springs from off-screen → rest; the Modal's own `animationType` is set to
`"none"` **only when motion is on** so the spring is the sole driver (a
native slide + a spring translate would double-animate and jangle).
Motion off → `animationType="slide"`, byte-identical to before.

The animated transform lives on an **outer wrapper** `Animated.View`; all
static panel styling (`Elevation.sheet`, radius, background, padding) sits
on an inner `View`. This is the proven `NorthStarBlock` split — it keeps
the Reanimated animated style and plain `StyleSheet` ViewStyles out of one
array (mixing them trips a `react-native-reanimated` style-type
contravariance on `cursor`/`userSelect`).

### 2. Soft resting-card elevation — `design_system_elevation`

Both sheets consume `useCardElevation()` (the flag-aware spreadable
elevation hook, ENG-795) for their **resting content cards**:

- `SavedMealPortionSheet` — the live scaled-macro read-out card takes the
  soft drop shadow (light) / tonal lift (dark) and drops its hairline
  border when the flag is on.
- `TodayEditMealModal` V2 — the name field and the 2×2 macro input cells
  are **recessed inputs**, so they take the tonal-lift background + lose
  their hairline under the flag, but deliberately **do not** carry the
  drop shadow. Shadow is reserved for genuinely *lifted* content cards;
  recessed inputs reading as floating cards would be wrong. (The
  `useCardElevation` contract also warns that the soft shadow must sit on
  a non-clipping View, which a `TextInput` is not.)

The hairline-border followup folds in here: the previously hand-rolled
`borderWidth: 1` on these cards is now driven by `useCardElevation().useBorder`.

### 3. Quiet log-confirm haptic — `redesign_motion`

The design direction's tiered-delight rule: a quiet `<100ms` confirm on
every commit, the loud reserved win-moment at landmarks only. Applied here
as the `PressableScale haptic="confirm"` Light-impact feel on:

- the commit CTAs (`Log N× to <slot>` and `Save changes`), via
  `PressableScale haptic={motionEnabled ? "confirm" : "none"}`;
- the **portion recalc** — every settled multiplier change from the shared
  `PortionStepper` (± / quick-chip / blur), fired in the sheet's
  `onPortionChange` wrapper. It fires on the *committed* value only, never
  on raw keystrokes (the stepper keeps a local text buffer and only calls
  `onChange` with a clamped number).

The commit CTAs were already blue (Phase 0 `design_system_colours`), so no
colour change was needed in this lane.

## What changed

**Mobile (`apps/mobile/`):**
- `components/today/SavedMealPortionSheet.tsx` — morph wrapper +
  `useCardElevation` on the macro read-out card + confirm haptic on portion
  recalc and the commit CTA (`PressableScale`).
- `components/today/TodayEditMealModal.tsx` — same morph wrapper + elevation
  treatment on the name/macro inputs + confirm haptic on portion recalc and
  the `Save changes` CTA, in the `EditEntryV2` path only. `EditEntryLegacy`
  untouched.

No changes to the host (`app/(tabs)/index.tsx`), the shared portion math,
`PortionStepper`, or any write path.

**Tests:**
- `tests/unit/editEntryPortionSheetRedesign.test.tsx` (new, 7 cases) —
  commit CTA fires `onConfirm`/`onSave`; portion recalc + commit fire the
  quiet confirm haptic when `redesign_motion` is on; motion-off fires no
  haptic and the recalc still applies. `useCardElevation` mocked to the
  flag-on light shape (its own branching is covered by `elevationToken.test.ts`).

## Why this is correct

- Each layer is gated independently (`redesign_motion`, `design_system_elevation`)
  with the old path alive in the `else`/ternary, so a 0% ramp is
  byte-identical to the ENG-783 sheets.
- Motion reads spring numbers from the one shared `src/lib/motion.ts`
  source via `useSheetMorph`, so the morph personality can never drift from
  the rest of the product's motion vocabulary.
- The haptic fires only on committed values and on commit — never per
  keystroke — matching the "quiet confirm, not noisy" intent.
- Elevation routes through the shared `useCardElevation` hook, so these
  cards pick up any future dark/light/flag change with no local re-derivation.

## Acceptance checks performed

- Mobile `tsc --noEmit` clean.
- Mobile vitest: full suite green (232 files / 1998 tests), including the
  new 7-case redesign test and the existing `todayLogUsualRowV2` (12) +
  `logSheetPhase3` (33) + `portionPickerSheet` (9) sheet tests (no regression).
- Visual sim validation (before/after on iOS, both flags forced on/off) is
  the next gate before the flag ramps — pending per
  `feedback_visual_verify_before_commit.md`. Not claimed done here.

## Parity

Mobile is shipped behind the redesign flags. **Web parity** — the matching
depth/motion/confirm polish on the web edit dialog + portion control in
`src/app/components/NutritionTracker.tsx` / `suppr/today-meals-section.tsx`
— rides on the existing ENG-783 web-parity follow-up and the web motion
analogs (`sheetTransition`/`triggerMorphStyle` + `SPRING_EASE` from
`src/lib/motion.ts`). Per `feedback_mobile_decisions_apply_to_web.md` this
is not optional; it lands before the redesign flags ramp to 100%. Tracked
on the ENG-813 issue — not a silent deferral.

## How to apply

When a new bottom sheet enters the daily loop: drive its entry through
`useSheetMorph(open && isFeatureEnabled("redesign_motion"))` on an outer
`Animated.View` wrapper (static styles on the inner View), take resting
content cards through `useCardElevation()`, and fire
`PressableScale haptic="confirm"` on every committed value + the commit
CTA. Never invent a per-sheet spring or a bespoke shadow.
