# Expanded visual sweep — 2026-05-11

## What this is

Replaces the narrow 12-screen tour (`apps/mobile/.maestro/00_quick_sim_tour.yaml`)
captured during the 2026-05-11 visual sweep — which only hit the four tab
landings + a few deeplinks and missed dozens of real bugs (V1 recipes 404,
V11 unended fast in history, etc.).

The expanded sweep covers:

1. **Every tab landing** (Today, Recipes, Plan, Shopping, You) — default + scrolled state
2. **Every routable deeplink** including hidden routes (`/profile`, `/fasting`, `/barcode`, `/burn-detail`, `/macro-detail`, `/meal-nutrition`, `/health-sync`, `/household-settings`, `/nutrition-sources`, `/paywall`, `/weekly-recap`, `/notifications-prompt`, `/create-recipe`)
3. **Primary actions' resulting modal states** — FAB Log sheet, Weekly check-in modal
4. **V1 redirect regression guard** — confirms `/recipes` resolves to Library (not 404)

## How to run

```bash
# Pre-req: Suppr dev client booted on iOS sim, logged in to a test account
# Metro running: npx expo start --dev-client (from apps/mobile/)
cd apps/mobile
maestro test .maestro/00z_expanded_visual_sweep.yaml
```

Output: `docs/audits/visual-sweep-expanded/<NN>-<name>.png`

## Coverage matrix vs original sweep

| Surface | Original sweep | Expanded |
|---|---|---|
| Today (states) | 1 | 3 (default + 2 scrolled) |
| Recipes Library | ✅ | ✅ |
| Recipes /recipes redirect | ❌ (404) | ✅ (V1 regression guard) |
| Discover | ✅ | ✅ |
| Plan (states) | 1 | 2 (default + scrolled) |
| Shopping | ✅ | ✅ |
| Progress (states) | 1 | 2 |
| Settings (states) | 1 | 2 |
| Profile | ✅ | ✅ |
| Fasting | ✅ | ✅ + Extended badge verification |
| Barcode | ❌ (timing) | ✅ |
| Create recipe | ❌ | ✅ |
| Burn detail | ❌ | ✅ |
| Macro detail | ❌ | ✅ |
| Meal nutrition | ❌ | ✅ |
| Health sync | ❌ | ✅ |
| Household settings | ❌ | ✅ |
| Nutrition sources | ❌ | ✅ |
| Paywall | ❌ | ✅ |
| Weekly recap | ❌ | ✅ |
| Notifications prompt | ❌ | ✅ |
| FAB Log sheet | ❌ | ✅ |
| Weekly check-in modal | ❌ | ✅ |

**Net: 23 expanded surfaces vs 12 original.**

## Known sweep-tooling improvements still needed

1. **`extendedWaitUntil` regex matches against bottom tab labels** — e.g.
   `.*Today.*` matches the "Today" tab text in the bottom tab bar, so the
   screenshot fires before the actual Today screen content loads. Fix:
   use screen-specific testIDs (`today-calorie-ring`, `library-recipe-card`,
   `progress-weight-chart`) as wait anchors.

2. **Deeplink routes without that name** — `/burn-detail`, `/macro-detail`,
   `/meal-nutrition` may resolve to different screen titles. Failed assertion
   blocks the rest of the sweep. Fix: add `optional: true` semantics so the
   sweep continues with a `MISSING` placeholder screenshot if a route can't
   be reached.

3. **Logged-out auth flows** (signin, signup, password reset) need a separate
   sweep that starts from logout. Mixing into the main sweep would corrupt
   sim state. TODO: `00z_auth_flows_sweep.yaml`.

4. **Diff-against-baseline visual regression** — every run produces fresh
   screenshots. A pixelmatch comparator with 1% tolerance + diff highlights
   would catch unintended UI regressions across PRs.

5. **Web parity sweep** — Playwright already has `web-screenshot-tour.spec.ts`
   covering ~36 routes. Should run in lockstep with the mobile sweep so
   web/mobile drift surfaces in one place.

## V-item proof (this run)

| V# | Surface | Proof file | Status |
|---|---|---|---|
| V1 | `/recipes` redirects to Library | `11-recipes-redirect.png` | ✅ Verified (no more 404) |
| V11 | Extended badge on long fasts | `41-fasting.png` | ✅ Verified ("EXTENDED" badge on 63h 30m fast) |

Other shipped V-items (V4, V5/V16, V6, V10, V12, V13/V15, V17) are code-only
text/CSS/state changes that aren't easily proven in a single static
screenshot but ship via the merged PRs (#209–#217).
