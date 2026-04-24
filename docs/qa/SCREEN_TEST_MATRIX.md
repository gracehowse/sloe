# Screen ↔ human cases ↔ Maestro

**Parent spec:** [Testing system specification](../testing/SYSTEM.md) (priorities, case template, release honesty bar).

This repo already has **Maestro** UI flows under `apps/mobile/.maestro/` (see `apps/mobile/.maestro/README.md`). This document is the **traceability layer**: each important surface has **human-readable case IDs** that you can run in TestFlight or the simulator, and **automation hooks** where a flow exists.

## How to use this

1. **Exploratory / release QA** — Pick a screen, run the **manual** cases ( Preconditions + Steps + Expected ). Log pass/fail in TestFlight, Linear, or a spreadsheet.
2. **Regression** — When a bug is fixed, add a **Maestro** assertion (or a new flow) and reference the same `TC-…` id in the YAML header comment.
3. **With Cursor** — Paste a failing `TC-…` block into chat; the agent can update RN code **or** the matching `.maestro/*.yaml`. The agent **cannot** tap your phone; it can only edit flows and suggest `maestro test …` commands you run locally.

## Case ID convention

| Pattern | Meaning |
|--------|---------|
| `TC-<AREA>-<nn>` | Human case (e.g. `TC-HEALTH-01`) |
| `@screen <route-or-name>` | Primary RN screen / route |

Optional YAML header (add to the top of a flow file):

```yaml
# @cases TC-TODAY-01
# @screen (tabs)
```

## Matrix (mobile)

Preconditions often: **dev client or TestFlight build** (not Expo Go) for native modules (Health, barcode, etc.).

| @screen | Maestro flow | In `config.yaml` suite? | Manual-only highlights |
|--------|----------------|-------------------------|-------------------------|
| Login / session | `30_login_auth.yaml`, `shared/login.yaml` | Yes | Clerk / email edge cases, password reset |
| Tab shell | `01_navigation.yaml` | Yes | Deep link into each tab |
| Today | `02_today_screen.yaml` | Yes | Ring data depends on backend + same-day entries |
| Meal journal | `33_meal_journal.yaml` | Yes | Long lists, edit/delete, timezone |
| Planner | `03_meal_plan.yaml` | Yes | Generate plan, shopping handoff |
| Profile / targets | `04_profile_settings.yaml`, `34_profile_targets.yaml` | Yes | Legal links, export |
| Settings hub | `31_settings_hub.yaml` | Yes | Navigation to sub-screens |
| Recipe detail | `05_recipe_detail.yaml` | Yes | Needs discoverable recipe; portions |
| Burn detail | `06_burn_detail.yaml` | Yes | Data from Health / estimates |
| Progress | `07_progress.yaml`, `27_progress_metric.yaml` | Yes | Charts, empty states |
| Voice log | `08_voice_log.yaml` | Yes | Mic permission |
| Food search (USDA / logging) | `10_search.yaml`, `32_food_search_modal.yaml` | Yes | **`(tabs)/search` is hidden** from the tab bar; both flows open **`FoodSearchModal` from Today** via the Search quick-log chip (`testID` `today-quick-log-search`). Network + USDA/OFF. |
| Discover | `11_discover.yaml` | Yes | Import CTA |
| Library | `12_library.yaml` | Yes | Saved sort/filter |
| Fasting | `13_fasting.yaml` | Yes | Timer |
| Weight tracker | `14_weight_tracker.yaml` | Yes | Charts |
| Meal nutrition detail | `15_meal_nutrition.yaml` | Yes | Needs logged meal |
| Shopping | `16_shopping.yaml` | Yes | From planner |
| Cook mode | `17_cook_mode.yaml` | Yes | Timer |
| Macro detail | `18_macro_detail.yaml` | Yes | Needs day with data |
| Notifications inbox | `20_notifications.yaml` | Yes | Open from **More → Notifications** (row is below the fold on small phones) |
| Create recipe | `21_create_recipe.yaml` | Yes | Image picker varies by OS |
| Barcode | `22_barcode_scanner.yaml` | Yes | Camera permission |
| Nutrition sources | `23_nutrition_sources.yaml` | **No** (external link) | Safari / in-app browser |
| Health sync | `24_health_sync.yaml` | Yes | **Real HealthKit only on native build**; Expo Go = warning only |
| Import shared URL | `25_import_shared.yaml` | Yes | Clipboard, network |
| Recipe verify | `26_recipe_verify.yaml` | **No** (needs recipe id) | Run with `-e RECIPE_ID=…` when you add env to flow |
| Onboarding | `09_onboarding.yaml` | **No** (long) | Full wizard; run before suite on clean install |
| Paywall | `19_paywall.yaml` | **No** (gated) | Subscription state |
| Notifications prompt | `28_notifications_prompt.yaml` | **No** | After onboarding only |
| More menu | `29_more_menu.yaml` | Yes | Sign out last |

## Template: add a human case

Copy a row into your tracker (Notion / Sheet / TestFlight note):

```text
TC-ID:        TC-EXAMPLE-01
@screen:      health-sync
Priority:     P1
Preconditions: iOS native build; Health has at least one dietary energy sample from MFP
Steps:
  1. Open More → Apple Health (or equivalent).
  2. Enable “Import meals from Health”.
  3. Tap Sync now.
Expected:
  - Either imported count > 0 OR a clear, accurate message (permission vs no data vs already imported).
Maestro:      apps/mobile/.maestro/24_health_sync.yaml (extend) or new file
```

## CI today

- **Web**: GitHub Actions runs Playwright smoke (`ci.yml` → `test` job).
- **Mobile**: Actions run **lint, typecheck, cross-boundary import checks, Vitest**, and **`npm run test:e2e:verify-suite`** (validates `config.yaml` flow files + `shared/*.yaml` references on disk — **no Simulator**).

Local belt before shipping mobile: **`npm run mobile:verify`** then **`npm run mobile:test:e2e`** (or `mobile:test:e2e:watch` while iterating).

To add **full Maestro** in CI later: use **`macos-latest`**, install Maestro + Xcode simulator, start Metro with test env, run `maestro test apps/mobile/.maestro/` with `E2E_*` from GitHub Secrets. Keep the suite shorter than local (subset of `config.yaml`) if runtime is a concern.

## testIDs (stability)

Prefer stable selectors in Maestro:

- `testID="health-sync-connect"` on primary buttons
- `testID="today-quick-log-search"` (and `voice` / `snap` / `scan`) on Today quick-log chips — Maestro should prefer these over label text
- `accessibilityLabel` unique per screen title

When a flow flakes on text, add a `testID` in RN and switch the YAML to `tapOn: { id: "…" }`.
