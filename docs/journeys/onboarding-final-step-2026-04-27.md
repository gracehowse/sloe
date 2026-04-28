# Onboarding final step — "Pick 5 recipes"

**Status:** Phase 3 / B2.3 — selection logic shipped 2026-04-27.
Auto-plan-from-seed pending follow-up (see "Open work" below).
**Authority:** D-2026-04-27-14 (onboarding ends with a populated
first week, not just a target).
**Spec:** `docs/specs/2026-04-27-production-design-spec.md` Surface F.

## What it is

The final step of the onboarding flow — Step 11 of 11 — that lets
the user pick at least 5 recipes from a curated grid. Their picks
seed the Library on Today + drive the auto-plan generator that
populates Plan with their first week.

> "Best-in-class onboarding ends with the user having a thing, not
> just knowing a thing. Current end-state ('you have a target, now
> go figure it out') is the cliff that kills activation."
> — D-2026-04-27-14

## What ships in Phase 3

The selection state machine:

- `src/lib/onboarding/v2/finalStep.ts` —
  - `togglePick(picked, recipeId)` immutable Set toggle.
  - `derivePickerState(picked)` returns `{canSubmit, remaining,
    ctaLabel}` driven by the `ONBOARDING_PICK_MIN` constant.
  - `pickCounterLabel(picked)` renders "X of N picked" capped at N.
  - `ONBOARDING_PICK_MIN` re-exports `NORTH_STAR_LIBRARY_MIN` so
    the onboarding threshold + the north-star block's library
    threshold can't drift apart.

The CTA states per spec Surface F §State:

| Picked count | CTA label                       | Enabled |
|-------------:|---------------------------------|---------|
|       0–4    | "Pick {n} more to continue"     | no      |
|       5+     | "Build my first week"           | yes     |

## Open work — auto-plan-from-seed

The presentation layer (recipe grid, selection chrome, CTA gating)
+ the persist hook (saving `saved_recipes` rows + generating the
first `meal_plans` row) is staged for follow-up. The reasons:

1. **Schema review.** Writing 5–10 saved-recipe rows + 7 plan rows
   to Supabase touches `saved_recipes` (created in B-Phase 2) and
   `meal_plans` (planner schema). Per CLAUDE.md, MCP
   `apply_migration` is forbidden — any schema delta must be staged
   in `supabase/migrations/` for `supabase db push --linked` by
   Grace.
2. **`mealPlanAlgo` audit.** The existing `generateSmartPlan`
   helper takes a `library` parameter — confirmed eligible to
   ingest a 5–10 seed list directly. No public-API changes
   expected, but per CLAUDE.md (correctness over speed) the auto-
   plan path needs an integration test before TestFlight.

## Component shape (when added)

The presentational component lives at:
- web: `app/components/onboarding-v2/RecipePickerStep.tsx`
- mobile: `apps/mobile/app/onboarding.tsx` final-step branch

Both components consume `derivePickerState` + `togglePick` from the
shared lib. Stepper caption "Step 11 of 11" + thicker progress bar
(6pt) per spec.

State coverage per spec Surface F §State:

- **Loading recipe candidates** — 6 skeleton tiles.
- **Empty (no candidates — broken backend)** — error band + "Skip
  and finish" escape hatch.
- **Disabled state** — button at 50% opacity, label "Pick {n} more
  to continue".
- **Success transition** — 600ms loader "Building your week…" →
  Today populated.
- **Plan-build fails post-save** — "We saved your recipes but
  couldn't build a plan. Try regenerate from the Plan tab." +
  button "Go to Today".

## Tests shipped in Phase 3

- `tests/unit/onboardingFinalStepPhase3.test.ts` — 11 tests on the
  selection state machine, threshold parity with
  `NORTH_STAR_LIBRARY_MIN`, CTA label switching.

## Tests pending (with auto-plan ship)

- `apps/mobile/tests/unit/onboardingFinalStepPhase3.test.tsx` —
  recipe grid rendering, selection state, CTA disabled gate,
  success transition writes ≥5 saved_recipes + 1 meal_plan row.
- `tests/unit/onboardingFinalStepPhase3.test.tsx` — web parity.

## Cross-platform

- Same threshold constants on both platforms (shared lib).
- Same CTA copy on both platforms (single source: `derivePickerState`).
- Welcome-copy divergence (web "Join the Suppr Club" vs mobile
  prototype copy) preserved per
  `project_onboarding_welcome_divergence.md`.
