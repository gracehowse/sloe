# North-star activation window + trust posture on QuickAdd / Saved meals

**Date:** 2026-04-30
**Status:** Resolved
**Area:** Today / north-star + trust posture
**Owner:** Grace
**Authority:** Round-2 leak audit (growth-strategist top fix #5,
product-lead B7) + customer-lens carry-over.

## Context

The 2026-04-30 round-1 activation-hooks pass
(`docs/decisions/2026-04-30-activation-hooks-post-onboarding.md`) shipped
five S-effort fixes including default seeds + a why-line subtitle on
the north-star suggestion. Two atomic gaps remained:

1. **The library threshold was correct at steady-state but brutal at
   activation.** A new user with 2-3 saved recipes is still a
   qualified target for "what to eat next" — but
   `NORTH_STAR_LIBRARY_MIN = 5` gated them out of the suggestion and
   stuck the block in its `library-empty` invitation. Default seeds
   (PR #7) cover the case where onboarding completes successfully,
   but users who skipped the picker, lost a network round-trip on
   seed resolution, or signed in on a second device with a young
   account were still blocked.

2. **Trust posture was missing on QuickAdd + Saved meals.** The
   Phase 3 / Phase 4 sweep
   (D-2026-04-27-16) widened the `SourceDot` provenance dot across
   diary, LogSheet, recipe detail, ingredients, Library, and
   Discover. QuickAdd + Saved meals were not enumerated in the
   roadmap row and shipped without dots. Every other macro-bearing
   row in the app carries provenance colour; these two are the only
   exception.

## Decision

### 1. NorthStar 30-day activation window

`src/lib/nutrition/northStarSuggestion.ts` — new constants
`NORTH_STAR_LIBRARY_MIN_ACTIVATION = 2` and
`NORTH_STAR_ACTIVATION_WINDOW_DAYS = 30`. New helper
`isWithinNorthStarActivationWindow(userCreatedAt, now?)`. The
`isLibraryEligibleForNorthStar` gate now takes optional
`userCreatedAt` (Date | string | null) and `now` parameters. Behaviour:

- Account < 30 days old → threshold = 2.
- Account ≥ 30 days old → threshold = 5 (unchanged steady-state).
- `userCreatedAt` is null/undefined/unparseable → threshold = 2
  (safety net — better to surface a real suggestion to a 90-day-old
  user once than gate it off from a 5-day-old user).
- Future creation date (clock drift) → threshold = 2.

Web call site: `src/app/components/NutritionTracker.tsx` reads
`authUserCreatedAt` from `AuthSessionContext` and passes it through.
`AuthSessionContext` was extended to carry `authUserCreatedAt: string
| null` from `session.user.created_at`.

Mobile call site: `apps/mobile/app/(tabs)/index.tsx` reads
`session.user.created_at` from the existing `useAuth()` hook.

The legacy single-arg `isLibraryEligibleForNorthStar(librarySize)`
signature still works — it now defaults to the relaxed path. The
test suite was updated to make this explicit (test
`tests/unit/northStarSuggestion.test.ts`).

### 2. Trust posture sweep on QuickAdd + Saved meals

New helper `dominantSavedMealSource(meal)` in
`src/lib/nutrition/savedMealsLogic.ts` — picks the most-cited source
across a saved meal's items, ties broken by item-order so the dot
reads consistently across re-renders. Variant labels ("Open Food
Facts", "OFF", "OpenFoodFacts") fold via `mapMealSourceToDot` before
tallying.

UI wiring:

- `src/app/components/suppr/quick-add-panel.tsx` — `SourceDot size=6`
  on every favourites / recent / frequent row, derived from
  `mapMealSourceToDot(row.source)`.
- `src/app/components/suppr/saved-meals-tab.tsx` — `SourceDot size=6`
  per saved meal row, derived from `dominantSavedMealSource(meal)`.
- `apps/mobile/components/QuickAddPanel.tsx` — same wiring on the
  mobile twin (favourites / recent / frequent + saved meals tabs).

### 3. Settings copy polish (carry-over from customer-lens wave 2)

Mobile `apps/mobile/app/(tabs)/settings.tsx` + web
`src/app/components/Settings.tsx` + the activity-level picker dialog
on both platforms:

- Activity-level descriptor: "Used to estimate your baseline calorie
  burn before workouts and steps." → "How active you are on a
  typical day."
- Burn segmented control: "Rolling (last 7 days)" → "Last 7 days";
  "This week" → "Mon–Sun" (imperative labels, not parenthetical).
  Search index updated to keep both labels findable.
- Tracking extras toggles (caffeine + alcohol): each toggle now
  carries a one-line helper. Caffeine: "Show a caffeine row on
  Today. Logs in mg, off by default." Alcohol: "Show an alcohol row
  on Today. Logs units + kcal, off by default." Mobile `Row`
  primitive extended with optional `description` prop. Web has
  inline helper spans.

Hydration is always-on (no toggle), so no description applies.

## Tests

`tests/unit/northStarSuggestion.test.ts` (+22 new tests) — pins the
30-day window, threshold matrix (young / old / null), boundary
conditions (29 vs 31 days), unparseable / future-date safety nets.

`tests/unit/savedMealsLogic.test.ts` (+8 new tests) — pins
`dominantSavedMealSource` across single / disagreeing / variant /
empty / malformed inputs.

`tests/unit/trustPostureQuickAddSavedMeals.test.tsx` (new file, 12
tests) — file-source pins (web + mobile) + behaviour pins on the
shared helper.

`apps/mobile/tests/unit/northStarBlockHostPhase5.test.tsx` (+2 new
tests) — host-level integration: 2 saved recipes + young account →
default suggestion renders; same library + old account → empty-state.

Test count: +44 new test cases across 4 files.

## Cross-platform parity

| Surface | Web | Mobile |
| --- | --- | --- |
| Gate (shared lib) | uses `isLibraryEligibleForNorthStar` with `authUserCreatedAt` | uses `isLibraryEligibleForNorthStar` with `session.user.created_at` |
| Trust dot — QuickAdd row | size=6, mapped via `mapMealSourceToDot` | size=6, mapped via `mapMealSourceToDot` |
| Trust dot — Saved meal row | size=6, via `dominantSavedMealSource` | size=6, via `dominantSavedMealSource` |
| Activity-level descriptor | "How active you are on a typical day." | "How active you are on a typical day." |
| Burn segment labels | "Last 7 days" / "Mon–Sun" | "Last 7 days" / "Mon–Sun" |
| Tracking-extras helper | Inline span under each toggle | `Row` `description` prop |

No intentional divergence.

## Risks / follow-ups

- **Activation cohort sample size is N=1** (Grace, per the solo-tester
  memory). The 30-day window is a defensible heuristic but the actual
  conversion lift can't be measured until the cohort grows. The
  threshold lives in the shared lib; rebinding it to (e.g.) 14 days or
  a flag-driven value is a one-line change.
- The `userCreatedAt` plumbing through `AuthSessionContext` is
  available for any future surface that needs to gate behaviour on
  account age (e.g. first-week-only banners, weekly-recap deferral).
