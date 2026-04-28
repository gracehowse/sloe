# North-star block — "What to eat next"

**Status:** Phase 3 / B2.2 — shipped 2026-04-27
**Authority:** D-2026-04-27-04 (north-star moment, permanent block)
**Spec:** `docs/specs/2026-04-27-production-design-spec.md` §A-northstar

## What it is

A permanent block on Today, second thing the eye lands on after the
calorie ring, that suggests one recipe from the user's library that
fits the calories + macros they have left for the slot they're in.

> "This is the single moment Suppr does what no competitor can.
> MacroFactor doesn't have your recipes. Mob/Paprika don't know
> your macros." — D-2026-04-27-04

## Component map

- **Scorer (shared lib):** `src/lib/nutrition/northStarSuggestion.ts`
  — `pickNorthStarSuggestion`, `pickNextNorthStarSuggestion`,
  `detectSlotForHour`, `ctaForSlot`, `bandLabel`,
  `NORTH_STAR_LIBRARY_MIN`, `isLibraryEligibleForNorthStar`.
- **Web primitive:** `src/app/components/suppr/north-star-block.tsx`
  — four `kind` branches (`default` / `library-empty` /
  `over-budget` / `no-fit`).
- **Mobile primitive:** `apps/mobile/components/today/NorthStarBlock.tsx`
  — same four kinds + swipe-to-skip gesture (mobile only) with
  reduce-motion `X` button fallback.
- **Web host:** `NorthStarBlockHost` inside `NutritionTracker.tsx`
  picks the right `kind` based on remaining macros + library size.
- **Mobile host:** wired into `apps/mobile/app/(tabs)/index.tsx`
  (see `NorthStarBlock` import and render).

## Branch logic

| Condition                          | Render kind          |
|-----------------------------------|----------------------|
| `remainingCalories <= 0`          | `over-budget` (calm caption) |
| `library.size < NORTH_STAR_LIBRARY_MIN` (5) | `library-empty` (invitation card) |
| Picker returns null               | `no-fit` (browse caption)    |
| Picker returns a suggestion       | `default` (gradient card + CTA) |

## Time-of-day CTA branching

`detectSlotForHour(hour*60 + minute)` →

| Window           | Slot       | CTA                 |
|------------------|-----------|---------------------|
| 06:00–10:30      | breakfast | "Log breakfast"     |
| 10:30–14:30      | lunch     | "Log lunch"         |
| 14:30–17:30      | snack     | "Cook ahead →"      |
| 17:30–22:00      | dinner    | "Cook it →"         |
| 22:00–06:00      | (none)    | "Log it" (fallback) |

The slot is also threaded into the picker's filter — recipes whose
`mealType` excludes the slot are filtered out. Untagged recipes are
eligible for any slot.

## Scoring

`pickNorthStarSuggestion(library, remaining, options?)` —

1. Reject when library empty, remaining calories ≤ 0, or all
   candidates excluded.
2. Filter by slot (if provided).
3. Per recipe, evaluate at portion multipliers `{0.5, 1.0, 1.5, 2.0}`
   matching the planner clamp.
4. Score: asymmetric calorie penalty (over ×3 / under ×1.5),
   protein-shortfall pull (×0.5), carb / fat distance (×0.1).
5. Return the lowest-penalty (recipe, multiplier) pair plus its
   adherence band: `tight` (within 5%), `close` (within 15%),
   `loose` (beyond).

The scorer is independent from the planner's whole-day
`scoreMealSetCanonical`. The two scorers solve different problems
(single-recipe-against-remaining vs whole-day-set), and trying to
share one scorer was the failure mode that produced the gated
"Dinner could hit" prototype that this block replaces.

## Library threshold (V-6 sub-decision)

Default ships at `NORTH_STAR_LIBRARY_MIN = 5`. The constant is
re-exported into `src/lib/onboarding/v2/finalStep.ts` as
`ONBOARDING_PICK_MIN` so the onboarding "Pick 5 recipes" step + the
Today block can't drift out of sync.

If onboarding completion drops because 5 is too high a bar, drop to
3 via a flag override (per V-6) — both surfaces shift together.

## Swipe-to-skip (mobile only)

The mobile primitive uses raw `PanResponder` to detect a left-pan;
release at >50pt commits a `Skip` and triggers a decisive haptic
(`Haptics.ImpactFeedbackStyle.Medium`). The caller receives `onSkip`,
which the Today host wires to `pickNextNorthStarSuggestion(library,
remaining, new Set([prevId]))` to surface the next-best.

Reduce-motion fallback (per `useReduceMotion`): a small `X` button
appears top-right of the card and fires the same `onSkip`.

The PanResponder import is defensively guarded — the test-time RN
shim doesn't ship `PanResponder`, so the component falls back to a
no-op handler set in tests. The gesture path is exercised on-device
only.

## Web parity

Web has no swipe gesture — the spec says reduce-motion users see a
small `X` button at top-right at opacity 0.4 → 1 on hover. We
render the same `X` whenever an `onSkip` handler is supplied
(opacity transition is left to default Tailwind hover styles).

## State coverage (per spec Surface A §State)

- **Default** — gradient SupprCard with thumb / body / CTA + skip.
- **Loading** — host returns the gradient card with skeleton in
  body (TODO — current implementation gates on library + remaining;
  loading-while-library-fetches is a no-op render).
- **Empty (no fit)** — caption "Library has nothing under your
  remaining macros today" + Browse → text button.
- **Library < 5** — primary-tinted invitation: "Pick a few recipes
  you'd actually cook — we'll suggest from there." + button "Open
  Library →".
- **Over-budget** — calm caption: "You've hit your calories for
  today — eat freely, or save for tomorrow."

## Tests

- `tests/unit/northStarSuggestion.test.ts` — 28 tests on the scorer
  (band thresholds, asymmetric penalty, slot filter, exclude-ids,
  CTA copy, library threshold).
- `tests/unit/northStarBlockPhase3.test.tsx` — 10 tests on the web
  primitive (every kind, CTA, skip, thumbnail).
- `apps/mobile/tests/unit/northStarBlockPhase3.test.tsx` — 7 mobile
  tests including reduce-motion `X` button fallback.

## Open visual-qa flags carried forward

- **V-1** — North-star gradient saturation on dark mode (visual-qa
  to A/B against a more muted variant).
- **V-3** — "Cook ahead →" copy for the 14:30–17:30 window
  (customer-lens to read 3 testers' reactions).
- **V-6** — Library-size threshold (5 vs 3 vs 1-with-apologetic
  copy). Default ships at 5; flag-driven adjustment supported.
