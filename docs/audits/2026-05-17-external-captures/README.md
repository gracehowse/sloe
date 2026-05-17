# External captures — 2026-05-17

Output of running the previously "External"-blocked Maestro + Playwright capture flows for the 2026-05-12 premium-bar audit. Run from Grace's machine against the booted iOS 26.4 sim + local Playwright web tour.

## Contents

### `mobile-dark/` (15 captures)
Dark-mode parity sweep from `apps/mobile/.maestro/00z_premium_bar_dark.yaml`.

Covers: Today (default + scrolled), Recipes Library, Discover, Plan, Shopping, Progress (default + scrolled), Settings, Profile, Fasting, Barcode, Create Recipe, Burn Detail, Macro Detail.

Satisfies:
- **ENG-485** — Dark mode parity audit (≥8 surfaces). 15 surfaces captured, all dark.
- **ENG-458** — Capture missing dark Plan screenshots (Maestro). `dark-20-plan.png`.

### `mobile-cook/` (2 captures)
Cook-mode populated state from `apps/mobile/.maestro/00e3_cook_active.yaml`.

Satisfies:
- **ENG-466** — Cook mode populated state P0 capture. `state-80-cook-entry.png` + `state-81-cook-scrolled.png`.

### `maestro-flagged-regressions/` (2 captures)

Maestro's AI flagged "could be a real regression that needs to be addressed" on two flows. These are the failure-state captures — the surface at the moment the test gave up.

- `22-barcode-scanner-failure.png` — flow `22_barcode_scanner.yaml`. Maestro AI label: "Barcode Scanner — permission screen, UI elements". Debug bundle: `~/.maestro/tests/2026-05-17_125829/`.
- `23-nutrition-sources-failure.png` — flow `23_nutrition_sources.yaml`. Maestro AI label: "Nutrition Sources — info screen with all data sources". Debug bundle: `~/.maestro/tests/2026-05-17_130029/`.

These trip:
- **ENG-484** — Barcode scanner light capture. The flow failed before capturing the intended state; the failure screenshot itself is evidence of whatever regressed.
- **ENG-477** — Meal nutrition populated state P0 re-capture. Same — flow failed.

These need Grace's eyes: either the test is stale and the UI is fine, or the UI genuinely regressed and the test caught it.

## What didn't capture

### Playwright (`tests/e2e/screenshots/web-authed-tour.spec.ts`) — failed

Both desktop and mobile viewports timed out at the sign-in step:

```
TimeoutError: page.waitForURL: Timeout 45000ms exceeded.
waiting for navigation until "load"
```

The spec clicks "Sign in", expects the URL to leave `/login` within 45s, and gives up when it doesn't. Either E2E_EMAIL / E2E_PASSWORD don't authenticate against the local dev server, or the sign-in button doesn't submit (selector drift, post-routing-refactor regression).

Traces + videos saved under `test-results/screenshots-web-authed-tou-*/` (not committed — gitignored).

Affects:
- **ENG-435** — Re-run screenshot capture with verified authed session (Playwright re-capture). Spec runs but auth fails — needs root cause.
- **ENG-495** — Re-capture web authed flows once routing fixed. Same auth failure blocks this.

### Maestro extended tour (`00b_screenshot_tour_extended.yaml`) — hung

Started 13:01 UTC, no progress after 20 minutes — killed. Probably waiting on a never-visible testID. Affects **ENG-471** (import flow states) which the extended tour was supposed to cover.

## Also refreshed

`docs/audits/2026-05-11-visual-sweep/mobile/01-12-*.png` — 12 baseline quick-tour captures overwritten with today's run. These are the standard "tab + sub-route" tour from `00_quick_sim_tour.yaml`.
