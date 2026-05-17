# External captures — 2026-05-17

Output of running the previously "External"-blocked Maestro + Playwright capture flows for the 2026-05-12 premium-bar audit. Run from Grace's machine against the booted iOS 26.4 sim + local Playwright web tour.

> **⚠ READ-FIRST CAVEAT (post-merge correction):** my initial framing was that `mobile-dark/` contained dark-mode captures and that the cook and barcode-scanner Linear items were resolved. **Visual review after the fact shows all the captures are in LIGHT mode, both cook captures are of the empty state (not populated), and the barcode-scanner failure was a stale test, not a UI regression.** All affected Linear issues (ENG-485, ENG-458, ENG-466, ENG-484, ENG-477, ENG-504, ENG-416) have been re-opened with the corrected findings. The captures themselves still have value as a 2026-05-17 LIGHT-mode reference of 17 surfaces — that's how to treat them. The dir + file names are kept as-is to preserve the audit-trail link with the Linear comments that reference them; treat `dark-*` as misleading naming, not actual dark-mode content.

## Contents (with corrected labels)

### `mobile-dark/` (15 captures) — **actually LIGHT mode**

Source flow: `apps/mobile/.maestro/00z_premium_bar_dark.yaml`. The flow's dark-mode toggle silently failed — no error, but the app stayed light. Captures are still useful as a light-mode reference for the 15 surfaces but DO NOT satisfy ENG-485 / ENG-458 (dark mode parity).

Also: `dark-01-today-default.png` and `dark-02-today-scrolled.png` are byte-identical (scroll didn't take). Same for `dark-30` and `dark-31`.

Surfaces captured (light): Today, Recipes Library, Discover, Plan, Shopping (loading state), Progress (30d), Settings (Pro tier + Promo code), Profile (Daily Targets + Edit Targets), Intermittent Fasting, Barcode Scanner viewfinder, Create Recipe, Activity Bonus (Burn detail), Macro Detail (empty Protein state).

### `mobile-cook/` (2 captures) — **EMPTY state, not populated**

Source flow: `apps/mobile/.maestro/00e3_cook_active.yaml`. Captured "No cook steps yet — This recipe doesn't have step-by-step instructions" empty fallback. The test recipe doesn't have cook steps configured — the flow needs to open a recipe that has steps before this audit item can close.

### `maestro-flagged-regressions/` (2 captures)

Maestro AI flagged "could be a real regression" on `22_barcode_scanner.yaml` and `23_nutrition_sources.yaml`.

- **`22-barcode-scanner-failure.png`** shows the "Log a meal" sheet, not the barcode scanner. **This is test-script staleness, not a UI regression** — the dedicated Barcode Scanner viewfinder is still alive and reachable via `suppr:///barcode` (visible in `mobile-dark/dark-42-barcode.png`). The flow's navigation steps need updating to match the new tap sequence.
- **`23-nutrition-sources-failure.png`** shows a "Not found / 404" page. Either the nutrition-sources detail surface was removed (consistent with the April Progress redirection from dashboard → story) or the deeplink path moved. Product call needed.

## Web captures: not landed

Playwright `web-authed-tour.spec.ts` failed at the sign-in step — `waitForURL: Timeout 45000ms exceeded` after the Sign-in click on both desktop + mobile. Traces / videos preserved locally at `test-results/screenshots-web-authed-tou-*-chromium/` (gitignored, not in repo). Affects ENG-435 and ENG-495.

## Also refreshed

`docs/audits/2026-05-11-visual-sweep/mobile/01-12-*.png` — 12 baseline quick-tour captures overwritten with today's run (`00_quick_sim_tour.yaml`). These are valid (light mode is the default, the quick-tour flow doesn't try to toggle dark).
