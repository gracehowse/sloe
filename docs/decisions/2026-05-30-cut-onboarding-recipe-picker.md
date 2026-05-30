# Cut the dormant onboarding recipe-picker (web + mobile)

**Date:** 2026-05-30
**Status:** Resolved
**Area:** Onboarding → activation / dead-code
**Owner:** Grace

## Problem

The onboarding "Pick 5 recipes" picker step was pulled from the linear
flow in the 15→12 customer-lens shrink (`2026-04-30-onboarding-shrink-15-to-12.md`).
Since then its components were kept on disk and re-exported from the
step barrels "for the post-launch nudge queue."

Ground-truth audit found that mount point never materialised:

- **Web has no nudge queue at all.** The queue
  (`apps/mobile/components/today/onboarding-nudges/`) is mobile-only.
- **The mobile nudge queue's `recipes` nudge deep-links to the Library
  tab** (`/(tabs)/library`), not the onboarding picker component.

So `RecipePickerStep` (web), `MobileRecipePickerStep` (mobile), and both
platforms' `RecipePickerGrid` had **no live call site on either
platform** — genuinely dormant, not deferred-pending.

Separately, the library-seeding that the picker used to provide had only
ever been wired on mobile (`mobile-flow.tsx`, activation-hooks fix
2026-04-30, leak #2). Web-flow had the resolve→save→plan pipeline but no
`defaultOnboardingSeeds` fallback, so cutting the web picker without
wiring web seeding would have left every web user's library empty.

## Decision

1. **Delete the picker on both platforms** (parity):
   - `src/app/components/onboarding/steps/recipes.tsx` +
     `src/app/components/onboarding/recipe-picker-grid.tsx`
   - `apps/mobile/components/onboarding/steps/recipes.tsx` +
     `apps/mobile/components/onboarding/RecipePickerGrid.tsx`
   - Remove the imports + re-exports from both step barrels. The
     `permissions` + `import` re-exports stay (still candidate nudge
     surfaces).

2. **Wire the live resolver on both** — web-flow.tsx now mirrors
   mobile-flow.tsx: when `state.pickedRecipeSlugs` is empty (every
   default completion), seed the library from `defaultOnboardingSeeds`
   (diet/allergen-filtered curated 5) through the existing
   `resolveSeedsToRecipeIds` → `saveResolvedSeeds` →
   `buildFirstWeekFromSeeds` pipeline, and emit `used_default_seeds` on
   `onboarding_completed` for activation-lift tracking.

3. **Extract one shared selector + gate it behind one flag** (the
   "fix properly" follow-up). The picks-vs-defaults decision was a
   duplicated inline ternary in both flows — exactly where web/mobile
   silently drift. It now lives once in
   `selectOnboardingSeeds(input)` (src/lib/onboarding/onboardingSeeds.ts),
   called identically by both flows. Seeding is gated behind a single
   shared kill switch, the `onboarding_default_seeds` PostHog flag, read
   via `isFeatureDisabled` on each platform.

This makes the library seed identically on web + mobile and removes the
only consumer of the picker, so the dead components are safe to delete.

### Why `isFeatureDisabled`, not `isFeatureEnabled`

Both platforms' `isFeatureEnabled` return `false` when PostHog is cold,
unloaded, or missing — they cannot tell "flag off" apart from "flag not
loaded yet". During onboarding completion PostHog is routinely cold, so
a naive `isFeatureEnabled` gate would skip seeding and empty every new
user's library — a regression of mobile's month-old shipped behaviour.

`isFeatureDisabled(flag)` is a fail-safe **default-ON kill switch**: it
returns `true` (→ skip seeding) ONLY when the flag resolves explicitly
to `false`. Cold / missing / unloaded → `false` (→ seed). So the flag is
an off-switch for rollback safety, never an on-gate — default behaviour
(seeding) is unchanged unless someone deliberately flips the flag off in
the PostHog dashboard, at which point BOTH platforms roll back together.

Flag key is snake_case (`onboarding_default_seeds`, matching
`today_log_usual_row_v2`) so mobile's `__DEV__` Maestro override can
derive a valid env-var key via `flag.toUpperCase()` →
`EXPO_PUBLIC_FLAG_FORCE_ONBOARDING_DEFAULT_SEEDS`.

**Action for Grace:** create the `onboarding_default_seeds` flag in
PostHog with rollout **100% / default ON**. Until it exists it resolves
unloaded → `isFeatureDisabled` → `false` → seeding proceeds (the safe
default), so there is no rush, but the kill switch is inert until the
flag is created.

## Cross-platform parity

| Item | Web | Mobile |
| --- | --- | --- |
| Picker step deleted | Yes | Yes |
| Picker grid deleted | Yes | Yes |
| Barrel re-export removed | Yes | Yes |
| `defaultOnboardingSeeds` fallback | Shipped (this change) | Already shipped (2026-04-30) |
| Shared `selectOnboardingSeeds` | Shipped (this change) | Shipped (this change) |
| `onboarding_default_seeds` flag gate | Shipped (this change) | Shipped (this change) |
| `used_default_seeds` flag | Shipped (this change) | Already shipped |
| Post-completion land | `/home` | `(tabs)?firstRun=1` |

## Validation

- **Executing** unit tests on the shared selector (not source greps):
  `tests/unit/selectOnboardingSeeds.test.ts` — picks→those seeds;
  no-picks+enabled→curated 5 (diet/allergen-filtered, incl. vegan-safe);
  no-picks+kill-switch→`[]`; allergen drops the salmon default.
- **Executing** kill-switch semantics on both platforms:
  `tests/unit/isFeatureDisabled.test.ts` (web) +
  `apps/mobile/tests/unit/isFeatureDisabled.test.ts` (mobile) — cold /
  unloaded / on → not disabled; explicit-off → disabled; SDK-throw →
  not disabled; the mobile test also covers the `__DEV__` Maestro
  override.
- Source-level wiring pins: `tests/unit/onboardingDefaultSeedsWiringWeb.test.ts`
  + `apps/mobile/tests/unit/onboardingDefaultSeedsWiring.test.ts` — pin
  that both flows import + call `selectOnboardingSeeds` and read the flag
  via `isFeatureDisabled("onboarding_default_seeds")`.
- `npm run ci` — web + mobile typecheck/test/build.
- Stale docstring in `src/lib/onboarding/onboardingSeedResolver.ts`
  (referenced the deleted grid) updated to point at
  `defaultOnboardingSeeds`.

## Notes

- Originally shipped ungated (mobile parity bugfix). The "fix properly"
  follow-up gates BOTH platforms behind one shared default-ON kill
  switch (`onboarding_default_seeds`) so the seeding can be rolled back
  on web + mobile together without a deploy — without ever gating web
  alone (which would itself be divergence). See "Why `isFeatureDisabled`"
  above for the cold-start rationale.
- The picker components can be reconstructed from git history if a real
  in-onboarding picker surface is ever revived — but it would be a new
  design, not this dormant code.
