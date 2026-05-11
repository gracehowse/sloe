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

## Known sweep-tooling improvements

| # | Status | Detail |
|---|---|---|
| 1 | ✅ Closed (PR #223) | `screen-<name>` testID anchors replace regex matches. Today captures fully-loaded content now. |
| 2 | ✅ Closed (PR #225) | Sweep split into independent sections + Bash wrapper at `apps/mobile/scripts/run-visual-sweep.sh`. Section failure no longer kills siblings. |
| 3 | ✅ Closed (PR #226) | Pixelmatch-based baseline diff at `apps/mobile/scripts/diff-visual-sweep.mjs`. Run after each sweep to catch unintended pixel drift. |
| 4 | ✅ Closed | Auth flow capture at `apps/mobile/.maestro/00z_sweep_auth_flows.yaml`. Run deliberately when refreshing logged-out captures (modifies sim state). |
| 5 | ✅ Closed | `--with-web` flag on the wrapper runs the existing Playwright `web-screenshot-tour.spec.ts` in lockstep. `--with-diff` runs the baseline diff after capture. |

## Usage

```bash
# Mobile-only sweep (default — sim must be booted + logged-in, Metro running)
bash apps/mobile/scripts/run-visual-sweep.sh

# Mobile + web in lockstep
bash apps/mobile/scripts/run-visual-sweep.sh --with-web

# Mobile + diff against baseline (CI-friendly, exits non-zero on regression)
bash apps/mobile/scripts/run-visual-sweep.sh --with-diff

# Refresh baseline after intentional UI change
node apps/mobile/scripts/diff-visual-sweep.mjs --update

# Refresh auth surfaces (signs out, captures, signs back in)
cd apps/mobile && maestro test .maestro/00z_sweep_auth_flows.yaml \
  -e E2E_EMAIL="$E2E_EMAIL" -e E2E_PASSWORD="$E2E_PASSWORD"
```

## V-item proof (this run)

| V# | Surface | Proof file | Status |
|---|---|---|---|
| V1 | `/recipes` redirects to Library | `11-recipes-redirect.png` | ✅ Verified (no more 404) |
| V11 | Extended badge on long fasts | `41-fasting.png` | ✅ Verified ("EXTENDED" badge on 63h 30m fast) |

Other shipped V-items (V4, V5/V16, V6, V10, V12, V13/V15, V17) are code-only
text/CSS/state changes that aren't easily proven in a single static
screenshot but ship via the merged PRs (#209–#217).
