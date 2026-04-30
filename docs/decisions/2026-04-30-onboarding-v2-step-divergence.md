# Onboarding v2 has 15 steps; design bundle defines 13 (Issue #23)

**Date:** 2026-04-30
**Area:** Onboarding / Design system
**Status:** Resolved (intentional — log + carve out)
**Owners:** product-memory (carve-out), product-lead + nutrition-engine (rationale)

## Context

The Claude Design onboarding bundle at [`docs/ux/claude-design-bundles/onboarding/project/design/state.jsx`](../ux/claude-design-bundles/onboarding/project/design/state.jsx) defines a 13-step flow:

```
welcome / signup / goal / sex / age / height / weight / activity /
pace / diet / reveal / permissions / import
```

The live v2 flow at [`src/lib/onboarding/v2/state.ts`](../../src/lib/onboarding/v2/state.ts) defines **15** steps:

```
welcome / signup / goal / sex / age / height / weight / activity /
pace / diet / strategy / reveal / permissions / import / recipes
```

Two additions to the bundle: **`strategy`** (step 11, between `diet` and `reveal`) and **`recipes`** (step 15, the new terminal step replacing `import` as the completion trigger).

## Why both additions exist (and stay)

### `strategy` (macro split picker)

Maps to `profiles.nutrition_strategy` — the user's preferred macro split (`balanced` / `high_protein` / `high_satisfaction` / `low_carb`). The bundle predates this column. Without the step, the v2 flow can't write a value the rest of the app expects, and users would never see why their suggested macros differ from a flat 30/40/30.

### `recipes` (seed recipe picker, terminal step)

Phase 5 / B2.3 — first-week meal plan is built from user-picked seed recipes. The bundle's terminal step was `import`; live now treats `import` as penultimate and `recipes` as the completion trigger that calls `buildFirstWeekFromSeeds` before routing to `/home`.

Both additions are present on web (`src/app/components/onboarding-v2/`) and mobile (`apps/mobile/components/onboarding-v2/`) identically — no platform drift inside the live flow.

## Decision

**Keep the 15-step shape. The bundle is reference, not mandate.**

Sync-enforcer must not flag this as drift on subsequent runs. The bundle remains useful for: token names, primitive shapes (Button / OptionCard / Chip / RulerSlider / NumberStepper), copy tone, narrative-column content, mobile/web split layout. It is NOT a step-count source of truth.

## Mobile-flow line count delta

- Bundle `mobile-flow.jsx` — 143 lines (demo shell, no auth/persist/analytics)
- Live `mobile-flow.tsx` — 369 lines

The 369 is **not over-built**. Every extra line traces to one of:

- `handleComplete` — Supabase persist + ONBOARDING_SEEDS + buildFirstWeekFromSeeds + analytics + AsyncStorage clear + router.replace with plan-build failure handling
- `MV-02` auto-skip authed signup
- `MV-03` AsyncStorage persistence
- Pace warning analytics (`onboarding_pace_below_safety_floor` event, Stage E + F legal-reviewer sign-off)
- Terminal-step routing with `pickerState.canSubmit` gating (Phase 5 / B2.3)
- `Alert.alert` error handler wrapping the persist call
- `ActivityIndicator` on the Continue CTA when completing

## Mobile-web step counter (issue #18)

Adjacent finding from sync-enforcer. Web onboarding's narrative-column eyebrow is hidden at phone viewport widths (`hidden md:flex`), so on mobile-web a user had no position indicator. Fixed in [`web-flow.tsx`](../../src/app/components/onboarding-v2/web-flow.tsx) by adding a `md:hidden` numeric counter beside the progress bar.

## Implementation pointers

- Live state model: `src/lib/onboarding/v2/state.ts:30-50`
- Live targets math: `src/lib/onboarding/v2/targets.ts`
- Bundle reference: `docs/ux/claude-design-bundles/onboarding/project/design/state.jsx`
