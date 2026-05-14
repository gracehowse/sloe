# Triage capture set — premium-sweep-v2 S0

**Captured:** 2026-05-15, ~10:00 local
**Total:** 94 PNGs (22 mobile + 72 web)
**Purpose:** Triage map only — not source-of-truth for any item.
The per-bucket `captures/<bucket>/before/` directories carry the
canonical pre-implementation captures used at `G4` item review.

**Capture environment:** iPhone 17 Pro / iOS 26.4 booted; web on
`http://127.0.0.1:3000`; status bar locked to 9:41 / charged / WiFi
per `apps/mobile/scripts/maestro-screenshot-tour.mjs`.

---

## Mobile (22 PNGs)

Source: `apps/mobile/.maestro/00_screenshot_tour.yaml` via
`npm run mobile:test:screens:tour`.

| # | File | Surface | Bucket |
|---|---|---|---|
| 01 | `tour-01-today.png` | Today tab — default view | P1 |
| 02 | `tour-02-today-scrolled.png` | Today tab — scrolled | P1 |
| 03 | `tour-03-library.png` | Recipes / Library tab | P1 |
| 04 | `tour-04-discover.png` | Discover sub-tab | P1 |
| 05 | `tour-05-plan.png` | Plan tab | P1 |
| 06 | `tour-06-shopping.png` | Shopping sub-tab | P1 |
| 07 | `tour-07-progress.png` | Progress / You tab | P1 |
| 08 | `tour-08-settings.png` | Settings sub-tab — top | P2 |
| 08b | `tour-08b-settings-mid.png` | Settings sub-tab — mid scroll | P2 |
| 08c | `tour-08c-settings-bottom.png` | Settings sub-tab — bottom | P2 |
| 09 | `tour-09-more-redirected.png` | More sub-tab | P2 |
| 10 | `tour-10-weight-tracker.png` | Weight Tracker stack screen | P1 |
| 11 | `tour-11-fasting.png` | Fasting stack screen | P2 |
| 12 | `tour-12-targets.png` | Targets stack screen (DC11 / DC14) | P2 |
| 13 | `tour-13-health-sync.png` | Health Sync stack screen | P2 |
| 14 | `tour-14-notifications.png` | Notifications stack screen | P2 |
| 15 | `tour-15-paywall.png` | Paywall stack screen (DC4) | **P0** |
| 16 | `tour-16-whats-new.png` | What's New stack screen | P2 |
| 17 | `tour-17-import-shared.png` | Import Shared Recipe stack screen | P2 |
| 18 | `tour-18-create-recipe.png` | Create Recipe stack screen | P2 |
| 19 | `tour-19-nutrition-sources.png` | Nutrition Sources stack screen | P2 |
| 20 | `tour-20-profile.png` | Profile stack screen (DC14) | P2 |

### Mobile gaps not in this triage set

The default tour does not capture these — they need dedicated Maestro
flows at S1 / S4 / S6 capture time:

- **P0 onboarding** — all 16 step screens (auth-gated)
- **P0 Today first-render** (no logs) — current tour ran against the
  fixture user who already has logs
- **P0 mobile login + AI paywall sheet**
- **P1 Cook mode** — captured by `00b_screenshot_tour_extended.yaml`
  but that wasn't part of this triage run
- **P1 Macro Detail, Burn Detail, Meal Nutrition** — same as above
- **P1 Household, Recipe Detail** — same
- All **bottom sheets / modals** (LogSheet, FoodSearch, BarcodeScanner,
  Photo Log, Voice Log, etc.) — these need interactive Maestro flows
  to surface

---

## Web (72 PNGs = 18 routes × 2 viewports × 2 themes)

Source: `tests/e2e/screenshots/premium-bar-sweep-{dark,light}.spec.ts`
via `npx playwright test`.

**Viewports:** `desktop` (1440 × 900), `mobile` (iPhone 13 — 390 × 844).
**Themes:** `dark`, `light`.

### Routes captured (per viewport × per theme = 4 files each)

| Route | Bucket |
|---|---|
| `/` (landing) | **P0** |
| `/pricing` | **P0** |
| `/login` | **P0** |
| `/signin` | **P0** |
| `/signup` | **P0** |
| `/reset-password` | P2 |
| `/onboarding` | **P0** |
| `/home` | P1 (Today logged-state) |
| `/fasting` | P2 |
| `/account/billing` | P2 |
| `/roadmap` | P2 |
| `/help` | P2 |
| `/whats-new` | P2 |
| `/privacy` | P2 |
| `/terms` | P2 |
| `/dmca` | P2 |
| `/licences` | P2 |
| `/dev/primitives` | n/a (dev internal) |

### Web gaps not in this triage set

- **P0 individual onboarding step screens** — `/onboarding` only
  captures the entry/first step. The 16 distinct step screens need
  per-step Playwright captures at S1.
- **P0 upgrade paywall dialog + AI paywall dialog** — these are modal
  overlays inside the authed product, not standalone routes. Need
  interactive Playwright flows to surface.
- **P0 checkout success** — needs a post-purchase fixture state.
- **P1 most product surfaces** — Today logged-state captured as `/home`
  but Plan, Library, Discover, Recipe Detail, Shopping, Progress,
  Weight Tracker, Macro Detail, Burn Detail, Food Search, and all the
  dialogs (LogSheet, Photo Log, Voice Log, custom food, etc.) are not
  captured by the dark/light public-routes spec.
- **P2 settings + profile + targets + household + notifications +
  creator profile** — also not in the public-routes spec.

These gaps are explicitly handled in S1 (P0 deep recapture), S4 (P1
deep recapture), and S6 (P2 deep recapture). The triage set is a
*starting map*, not a complete one.

---

## How to scan this set

1. Open `mobile/` — scroll through 22 PNGs in order. These give the
   current state of every primary mobile surface in light mode (sim
   default).
2. Open `web/` — scan `web-desktop-dark-*` first (most-trafficked
   viewport × design-foundation theme), then `web-desktop-light-*`,
   then the mobile-web pair.
3. **Flag anything obviously broken or "wait that doesn't look like
   premium"** for inclusion in the P0 audit brief at S1.

The mobile captures here are **light mode only** (current sim
default). Mobile dark captures will be taken at S1 via a `_light`
sibling flow + the existing `00z_premium_bar_dark.yaml`.
