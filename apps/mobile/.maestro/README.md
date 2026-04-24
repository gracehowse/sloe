# Maestro E2E Tests

These tests drive the real iOS Simulator or Android Emulator and verify user-visible behaviour.

## Mobile testing belt (belts and braces)

Run these in order before a release or large mobile PR:

1. **`npm run mobile:verify`** (repo root) — **ESLint** (errors fail), **TypeScript**, **Vitest** (`apps/mobile/tests/unit`), and **Maestro suite manifest** (every flow in `config.yaml` exists + `runFlow: shared/*.yaml` resolves). No Simulator required.
2. **`npm run mobile:test:e2e`** — Full **Maestro** suite against a running dev client + Metro (see [Running](#running)). Requires `E2E_*` and optional silent auth env in `apps/mobile/.env`.
3. **Manual-only flows** (not in `config.yaml`): `09_onboarding`, `19_paywall`, `23_nutrition_sources`, `26_recipe_verify`, `28_notifications_prompt` — run ad hoc when those surfaces change.

GitHub **CI** `mobile` job runs lint, typecheck, import-path guards, Vitest, and **`test:e2e:verify-suite`** so broken or renamed Maestro files fail the build even without Maestro installed on the runner.

## Release vs day-to-day runs

Default [`config.yaml`](./config.yaml) sets `continueOnFailure: true` so one flaky flow does not abort the whole ordered suite during iterative dev. **Before a store release**, run Maestro with **`continueOnFailure: false`**: copy `config.yaml` to e.g. `config.release.yaml`, flip that flag (keep the same `flowsOrder`), and run `maestro test .maestro --config config.release.yaml …`, **or** treat any non-zero per-flow result in CI as a blocker even when the driver exits 0 — do not ship with a known-red flow ignored.

## Human test cases ↔ Maestro

- **Traceability matrix (screen → case IDs → flows):** [`docs/qa/SCREEN_TEST_MATRIX.md`](../../docs/qa/SCREEN_TEST_MATRIX.md)
- **Who can “go in” and tap?** Only a **human** or **Maestro** on a simulator/device. Cursor agents **edit** flows and app code; they do not drive your phone unless you run Maestro/Expo in an environment the agent’s shell can reach (unusual).
- **Recommended workflow:** Write or paste human cases using the `TC-…` template in that doc → encode the stable path in YAML → add `@cases` comments at the top of the flow file → run `npm run test:e2e` before release.

## Metro (common pain with Maestro)

Maestro hits **`http://127.0.0.1:<port>/status`** on your Mac. That only works if Metro is **running and “packager-status:running”**.

| Problem | What to do |
|--------|------------|
| **`[maestro-e2e] Metro never became ready`** | Start Metro **before** `npm run test:e2e`. The runner **retries for ~30s** (cold Metro / big graph); first boot after `expo start` can still be slow — wait for Metro to finish bundling, then re-run. |
| Wrong working directory | Run Expo from **`apps/mobile`** (`cd apps/mobile && npx expo start`) or **`npm run mobile:dev`** from repo root (uses `--prefix apps/mobile`). Starting Expo from the monorepo root without the mobile package can break resolution / Metro root. |
| Port clash | `lsof -i :8081` — kill stale node, or `npm run start:maestro` (pins **8081**) or `npx expo start --port 8082` + set **`EXPO_DEV_SERVER_URL=exp://127.0.0.1:8082`** in `.env.local` / shell. |
| Stale bundler | `npm run start:clear --prefix apps/mobile` |
| Simulator “Could not connect” | Use **`exp://127.0.0.1:<port>`** for simulator Maestro (same machine). Physical device needs LAN or **`npx expo start --tunnel`** and the **`exp://`** URL Expo prints for tunnel. |
| **`CommandError: No development build (com.supprclub.supprapp) … is installed`** | This repo uses a **custom dev client**, not Expo Go. **One-time per simulator:** stop Metro, then from repo root run **`npm run mobile:ios:simulator`** (or `cd apps/mobile && npm run ios:simulator`). That runs `expo run:ios`, builds native `Suppr`, and installs it on the booted Simulator. After it launches once, **`npm run mobile:dev:maestro`** and pressing **`i`** works. Maestro flows target `appId: com.supprclub.supprapp`. |

## Prerequisites

1. **Java**: `brew install --cask temurin` (requires sudo)
2. **Maestro**: `curl -Ls "https://get.maestro.mobile.dev" | bash`
3. **iOS Simulator** or **Android Emulator** running
4. **Expo dev server** — from **`apps/mobile`**: `npx expo start` / `npm run start:maestro`, or repo root: **`npm run mobile:dev`**. Use the **`exp://…`** URL from the Metro terminal / QR (not a random LAN IP checked into git).

## Running

From **`apps/mobile`** (so `.maestro/` resolves), or from the **repo root** with **`npm run mobile:test:e2e`** / **`npm run mobile:test:e2e:watch`** (same scripts, `--prefix apps/mobile`).

```bash
# iOS Simulator + Metro on same machine (typical)
# Put E2E_EMAIL / E2E_PASSWORD in repo-root `.env.local` (or `apps/mobile/.env`) — `npm run test:e2e` loads them into the Maestro process.
# Optional: EXPO_DEV_SERVER_URL=exp://127.0.0.1:8081 if Metro is not on 8081

# Terminal 1: Metro must be running before Maestro (script checks http://127.0.0.1:<port>/status)
cd apps/mobile && npx expo start
# or from repo root:
npm run mobile:dev
# Pin port 8081 (matches default EXPO_DEV_SERVER_URL):
npm run mobile:dev:maestro

# First time only (Simulator): install the dev client, then use Metro + i:
#   npm run mobile:ios:simulator

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

## Stable selectors (prototype / tab bar drift)

- **Tab bar:** prefer `.*Today, tab.*`, `.*Discover, tab.*`, etc., over matching screen titles.
- **Today quick log:** chips expose `testID` `today-quick-log-search`, `today-quick-log-voice`, `today-quick-log-snap`, `today-quick-log-scan` (see `TodayQuickLogStrip.tsx`).

## Authentication

Flows use `shared/login.yaml`: **`EXPO_DEV_SERVER_URL`**, **`E2E_EMAIL`**, **`E2E_PASSWORD`** are passed to Maestro via `-e` by **`scripts/run-maestro-e2e.mjs`** (values come from repo-root **`.env.local`**, then **`apps/mobile/.env`**, then your shell). Do not commit real passwords; use a dedicated Supabase test user and local env only.

## Troubleshooting

| Symptom | What to check |
|--------|----------------|
| **`[maestro-e2e] Metro not ready`** | Start Expo first; port in **`EXPO_DEV_SERVER_URL`** must match Metro (default **8081**). |
| **`No development build … is installed`** (after pressing **i**) | Run **`npm run mobile:ios:simulator`** once to build/install the dev client on the Simulator (see Metro table above). |
| **`[maestro-e2e] Missing E2E_EMAIL`** | Set credentials in **repo root `.env.local`** or **`apps/mobile/.env`**, or `export` them in the shell. |
| **`login.yaml` times out** (`Today` never appears) | **`shared/login.yaml` now types into the login form** when `login-email` is visible (uses **`E2E_EMAIL` / `E2E_PASSWORD`** from Maestro `-e`). If you still see no typing: confirm Metro passed those env vars (`npm run test:e2e` loads `.env.local`). If login succeeds but timeout persists: Supabase user likely needs **`onboarding_completed=true`**. Optional: set **`EXPO_PUBLIC_E2E_AUTH_ENABLED`** + matching **`EXPO_PUBLIC_E2E_*`** in **`apps/mobile/.env`** so the app signs in **before** UI (no visible typing). |
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
| 10_search.yaml | Food search from Today (modal): query, submit, results or unavailable copy (tab route `search` is hidden) |
| 11_discover.yaml | Discover: search, filter pills, import CTA, recipe cards, scroll, import navigation |
| 12_library.yaml | Library: saved recipes, sort, search, empty state |
| 13_fasting.yaml | Intermittent fasting: timer ring, start/end fast, history |
| 14_weight_tracker.yaml | Weight tracker: weight/steps/water/body fat inputs, journey chart |
| 15_meal_nutrition.yaml | Meal nutrition detail: macro breakdown per logged meal |
| 16_shopping.yaml | Shopping list: items, check off, navigation from planner |
| 17_cook_mode.yaml | Cook mode: step-by-step nav, timer, completion |
| 18_macro_detail.yaml | Macro detail: per-meal breakdown for a specific macro |
| 19_paywall.yaml | Paywall: Pro trial timeline, CTA, continue free |
| 20_notifications.yaml | Notifications inbox (More → Notifications): empty state, mark all read, back |
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
