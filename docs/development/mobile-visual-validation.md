# Mobile visual validation — the discipline

Every PR that touches a mobile-visible surface must include before/after
screenshots from an iOS build, attached to the PR description.

This file documents the standard pattern, established 2026-05-03 after
Bundle 1A's mobile parity changes were initially shipped without
visual validation (Grace correction; see
`feedback_visual_validation_mandatory` in user-memory).

## The pattern

For each bundle of mobile UI changes, ship THREE files:

1. **Dev screen** — `apps/mobile/app/dev/<bundle-id>-states.tsx`
   Mounts the changed component(s) in 3–6 controlled states with
   inline notes describing the expected behaviour. Reachable via
   deeplink only (no nav exposure).
2. **Maestro flow** — `apps/mobile/.maestro/<NN>_<bundle-id>_validation.yaml`
   Skips login by deeplinking straight to the dev screen, then
   captures full-page + per-state screenshots.
3. **Screenshots** — committed to
   `docs/screenshots/launch-bugs/<bundle-id>-mobile/` after a Maestro run.

The same pattern exists on web (`app/dev/<bundle-id>-states/page.tsx`
+ `tests/e2e/screenshots/<bundle-id>-validation.spec.ts`).

## Reference implementation — Bundle 1A

- Dev screen: [`apps/mobile/app/dev/calorie-ring-states.tsx`](../../apps/mobile/app/dev/calorie-ring-states.tsx)
- Maestro flow: [`apps/mobile/.maestro/00f_bundle_1a_validation.yaml`](../../apps/mobile/.maestro/00f_bundle_1a_validation.yaml)
- Screenshots: `docs/screenshots/launch-bugs/bundle-1a-mobile/`

Web mirror:
- Dev page: [`app/dev/daily-ring-states/page.tsx`](../../app/dev/daily-ring-states/page.tsx)
- Playwright spec: [`tests/e2e/screenshots/bundle-1a-validation.spec.ts`](../../tests/e2e/screenshots/bundle-1a-validation.spec.ts)
- Screenshots: `docs/screenshots/launch-bugs/bundle-1a-after/`
- Product context for what's being validated (the hero ring + NET-tile
  states this route renders): see the "Internal QA tooling" subsection
  (under Layout) in
  [`docs/journeys/food-tracking.md`](../journeys/food-tracking.md).

## Second implementation — Bundle 1B

- Dev screen: [`apps/mobile/app/dev/health-import-labels.tsx`](../../apps/mobile/app/dev/health-import-labels.tsx)
- Maestro flow: [`apps/mobile/.maestro/00g_bundle_1b_validation.yaml`](../../apps/mobile/.maestro/00g_bundle_1b_validation.yaml)
- Screenshots: `apps/mobile/screenshots/latest/bundle-1b-mobile-*.png`

Web mirror:
- Dev page: [`app/dev/health-import-labels/page.tsx`](../../app/dev/health-import-labels/page.tsx)

Validates the HealthKit-import fallback-title format + filter
(`isHealthImportFallbackTitle`) against hardcoded sample data — see
[`docs/journeys/food-tracking.md`](../journeys/food-tracking.md#healthkit-import-fallback-titles-n1-2026-05-03)
for the product behaviour this harness exists to check.

## How to run the mobile flow

### One-time setup (per worktree, once)

```bash
# From the bundle's worktree:
cd apps/mobile
npm install                                      # if node_modules missing
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo prebuild --platform ios
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios --device "iPhone 16 Pro iOS 18"
# Wait for the app to launch on the sim (~5–10 min first time, ~2 min subsequent).
```

The `LANG` / `LC_ALL` overrides work around a Ruby/CocoaPods Unicode
encoding bug on macOS that surfaces when Ruby 4.0+ is the default.

### Each visual-validation run

```bash
# From the bundle's worktree:
maestro test apps/mobile/.maestro/<NN>_<bundle-id>_validation.yaml

# Move the output PNGs into the canonical screenshots dir + commit:
mkdir -p docs/screenshots/launch-bugs/<bundle-id>-mobile
mv apps/mobile/screenshots/latest/<bundle-id>-mobile-*.png \
   docs/screenshots/launch-bugs/<bundle-id>-mobile/
git add docs/screenshots/launch-bugs/<bundle-id>-mobile/
```

### Attach to PR

Add a comment to the PR with inline image refs using the GitHub raw
URL pattern:

```md
![bundle-1a-mobile-empty](https://github.com/gracehowse/Suppr/raw/<branch>/docs/screenshots/launch-bugs/<bundle-id>-mobile/<file>.png)
```

## Why this pattern (over alternatives)

- **Deeplink-to-dev-screen** > full Maestro user-flow walk: the
  user-flow walk needs a logged-in account + DB state; the dev screen
  mounts components directly with controlled props. ~10× faster + no
  flaky auth.
- **Per-state testID elements** > full-page screenshots only: the
  per-state `screenshots/latest/<id>-state-N.png` files crop tightly
  around each state, making side-by-side diff in the PR comment readable.
- **Same harness pattern web + mobile** > custom-per-bundle: reduces
  the cognitive load of the visual-validation rule. Every bundle does
  the same thing on both platforms.

## When this pattern is overkill

For pure-logic changes (e.g. a database migration, an analytics
event rename) that don't touch the rendered UI, skip the dev screen
+ Maestro flow. Tests + a "no UI surfaces" note in the PR is enough.

For changes that touch a mobile surface that's deeply embedded in
authenticated user state (e.g. the LogSheet Recents tab — needs a
DB with MFP-imported entries), document the gap honestly in the PR
("logic-tested; visual proof of state X requires seeded DB") rather
than skipping the mention.
