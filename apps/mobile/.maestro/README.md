# Maestro E2E Tests

These tests drive the real iOS Simulator or Android Emulator and verify user-visible behaviour.

## Prerequisites

1. **Java**: `brew install --cask temurin` (requires sudo)
2. **Maestro**: `curl -Ls "https://get.maestro.mobile.dev" | bash`
3. **iOS Simulator** or **Android Emulator** running
4. **Expo dev server** — from repo root or `apps/mobile`: `npx expo start` (or `npm run start` in `apps/mobile`). Use the **`exp://…`** URL from the Metro terminal / QR (not a random LAN IP checked into git).

## Running

From **`apps/mobile`** (so `.maestro/` resolves), or from the **repo root** with **`npm run mobile:test:e2e`** / **`npm run mobile:test:e2e:watch`** (same scripts, `--prefix apps/mobile`).

```bash
# iOS Simulator + Metro on same machine (typical)
# Put E2E_EMAIL / E2E_PASSWORD in repo-root `.env.local` (or `apps/mobile/.env`) — `npm run test:e2e` loads them into the Maestro process.
# Optional: EXPO_DEV_SERVER_URL=exp://127.0.0.1:8081 if Metro is not on 8081

# Terminal 1: Metro must be running before Maestro (script checks http://127.0.0.1:<port>/status)
npx expo start

# Terminal 2:
npm run test:e2e

# Re-run the full suite whenever you save a `.yaml` under `.maestro/` (Maestro’s `--continuous` does not support multi-flow workspaces):
npm run test:e2e:watch

# Or call Maestro directly (same -e flags required for login.yaml)
maestro test .maestro/ \
  -e EXPO_DEV_SERVER_URL='exp://192.168.1.42:8081' \
  -e E2E_EMAIL="$E2E_EMAIL" \
  -e E2E_PASSWORD="$E2E_PASSWORD"

# Single flow
maestro test .maestro/01_navigation.yaml -e EXPO_DEV_SERVER_URL='exp://127.0.0.1:8081' -e E2E_EMAIL='...' -e E2E_PASSWORD='...'

# Record a video while debugging
maestro record .maestro/01_navigation.yaml -e EXPO_DEV_SERVER_URL='exp://127.0.0.1:8081' -e E2E_EMAIL='...' -e E2E_PASSWORD='...'
```

**Physical device:** Metro must be reachable from the phone. Often `exp://<your-mac-lan-ip>:8081`, or use `npx expo start --tunnel` and the **`exp://`** URL Expo prints for tunnel mode.

## Authentication

Flows use `shared/login.yaml`: **`EXPO_DEV_SERVER_URL`**, **`E2E_EMAIL`**, **`E2E_PASSWORD`** are passed to Maestro via `-e` by **`scripts/run-maestro-e2e.mjs`** (values come from repo-root **`.env.local`**, then **`apps/mobile/.env`**, then your shell). Do not commit real passwords; use a dedicated Supabase test user and local env only.

## Troubleshooting

| Symptom | What to check |
|--------|----------------|
| **`[maestro-e2e] Metro not ready`** | Start Expo first; port in **`EXPO_DEV_SERVER_URL`** must match Metro (default **8081**). |
| **`[maestro-e2e] Missing E2E_EMAIL`** | Set credentials in **repo root `.env.local`** or **`apps/mobile/.env`**, or `export` them in the shell. |
| **Second `npm run test:e2e` “does nothing” / no new output** | Maestro still runs a full pass; output can look similar if the app state is unchanged. Use **`npm run test:e2e:watch`** to auto re-run after you save flow YAML under `.maestro/`. Only flows listed in **`.maestro/config.yaml`** run (not every YAML file). |
| **`Continuous mode is not supported when running multiple flows`** | Expected for `maestro test .maestro/ --continuous`. Use **`npm run test:e2e:watch`** (file watcher + full suite) instead. |
| **`ENOSPC`** during `expo prebuild` / install | Disk full — free space on the volume (`df -h .`); preflight warns when free space is very low. |
| Hangs on `openLink` / never sees `Sign In` | Wrong **`EXPO_DEV_SERVER_URL`** (must match Metro: port **8081** unless you changed it). Simulator: try `exp://127.0.0.1:8081`. Device: LAN IP or tunnel URL. |
| Stuck on **Continue** (Expo Go) | `login.yaml` dismisses **Continue** first; cold reinstall Expo Go if the sheet never appears. |
| Login fails / “Enter your…” | Wrong **`E2E_EMAIL` / `E2E_PASSWORD`**, or account not registered / email confirmation required in Supabase. |
| `appId: host.exp.Exponent` errors | Flows target **Expo Go**. A standalone dev build needs its **bundle id** in each flow’s `appId`. |
| Java warnings on macOS | Install Temurin JDK; newer macOS may need `java` on `PATH` for Maestro. |

## Test files

| File | What it tests |
|------|--------------|
| 01_navigation.yaml | All 5 tabs load and respond; rapid tab switching regression |
| 02_today_screen.yaml | Calorie ring, macro cards, quick-log buttons, ring toggle, scroll, voice/search quick-log |
| 03_meal_plan.yaml | Generate plan, verify meals + macros, shopping list button |
| 04_profile_settings.yaml | Reorganised sections, targets, legal links, export |
| 05_recipe_detail.yaml | Recipe: ingredients, macros, portions, save, Start Cooking, Log to journal |
| 06_burn_detail.yaml | Tap burn card, verify detail sections |
| 07_progress.yaml | Stats grid, charts, weight journey, time range selector, empty state |
| 08_voice_log.yaml | Voice button opens text input fallback |
| 09_onboarding.yaml | Full onboarding wizard: goal, basic info, activity, plan, strategy, dietary, summary |
| 10_search.yaml | Food search tab: query input, USDA results |
| 11_discover.yaml | Discover: search, filter pills, import CTA, recipe cards, scroll, import navigation |
| 12_library.yaml | Library: saved recipes, sort, search, empty state |
| 13_fasting.yaml | Intermittent fasting: timer ring, start/end fast, history |
| 14_weight_tracker.yaml | Weight tracker: weight/steps/water/body fat inputs, journey chart |
| 15_meal_nutrition.yaml | Meal nutrition detail: macro breakdown per logged meal |
| 16_shopping.yaml | Shopping list: items, check off, navigation from planner |
| 17_cook_mode.yaml | Cook mode: step-by-step nav, timer, completion |
| 18_macro_detail.yaml | Macro detail: per-meal breakdown for a specific macro |
| 19_paywall.yaml | Paywall: Pro trial timeline, CTA, continue free |
| 20_notifications.yaml | Notifications inbox: empty state, mark all read, unread badge |
| 21_create_recipe.yaml | Create recipe: form fields, image, ingredients, meal type, publish toggle, validation |
| 22_barcode_scanner.yaml | Barcode scanner: permission prompt, scanner UI, navigation |
| 23_nutrition_sources.yaml | Nutrition sources info: USDA, Open Food Facts, FatSecret, disclaimer |
| 24_health_sync.yaml | Health sync: feature list, nutrition import/export, connect button, Expo Go warning |
| 25_import_shared.yaml | Import shared recipe: idle state, URL input, source grid, clipboard |
| 26_recipe_verify.yaml | Recipe verify: ingredient list, nutrition facts, portion editing, confirm |
| 27_progress_metric.yaml | Progress metric detail: calorie/protein/streak deep dive, day breakdown |
| 28_notifications_prompt.yaml | Notification prompt: enable/skip flow (post-onboarding) |
| 29_more_menu.yaml | Profile/More: all settings sections, widget picker, week start, reset modal, sign out |

**Suite vs files:** `npm run test:e2e` runs the ordered list in **`.maestro/config.yaml`** only. Flows not in the config run manually: **00_connect** (manual Expo URL), **09_onboarding** (long wizard), **19_paywall** (gated/flaky), **23_nutrition_sources** (external link), **26_recipe_verify** (needs specific recipe state), **28_notifications_prompt** (post-onboarding only). Run manually: `maestro test .maestro/09_onboarding.yaml -e …`.

## CI integration

Add to GitHub Actions:
```yaml
- name: Install Maestro
  run: curl -Ls "https://get.maestro.mobile.dev" | bash
- name: Run Maestro tests
  run: ~/.maestro/bin/maestro test apps/mobile/.maestro/ --no-ansi
```
