# Maestro E2E Tests

These tests drive the real iOS Simulator or Android Emulator and verify user-visible behaviour.

**Cursor agents (interactive UI checks):** use the **`ios-simulator` MCP** server + IDB instead of asking for dragged screenshots. Setup: `docs/testing/agent-eyes-and-hands.md`, navigation map: `sitemap.md`, verify: `npm run agent:verify-tools` from repo root.

## Mobile testing belt (belts and braces)

Run these in order before a release or large mobile PR:

1. **`npm run mobile:verify`** (repo root) — **ESLint** (errors fail), **TypeScript**, **Vitest** (`apps/mobile/tests/unit`), and **Maestro suite manifest** (every flow in `config.yaml` exists + `runFlow: shared/*.yaml` resolves). No Simulator required.
2. **`npm run mobile:test:e2e`** — Full **Maestro** suite against a running dev client + Metro (see [Running](#running)). Requires `E2E_*` and optional silent auth env in repo-root **`.env.local`**.
3. **`npm run mobile:test:screens:diff`** — Visual-regression layer over the suite. Compares `apps/mobile/screenshots/latest/` (produced by step 2) against the committed `screenshots/baseline/`. Catches layout shift, contrast drift, z-index regressions that text-only assertions miss. See [Visual regression — screenshot diff](#visual-regression--screenshot-diff). First-time setup needs `npm run mobile:test:screens:update-baseline` after a clean step-2 run.
4. **Sub-page visual baseline** (not in `config.yaml`): `00z_sweep_deeplinks.yaml` — deeplinks + log sheet + recipe detail → `screenshots/latest/deeplink-*.png`. Run `npm run test:sweep:deeplinks` then `npm run test:screens:diff`. See [`docs/testing/VISUAL_REGRESSION.md`](../../docs/testing/VISUAL_REGRESSION.md).
5. **Manual-only flows** (not in `config.yaml`): `09_onboarding`, `19_paywall`, `23_nutrition_sources`, `26_recipe_verify`, `eng_1066_verify_swap_fixture`, `eng_772_editable_eaten_at`, `28_notifications_prompt` — run ad hoc when those surfaces change.

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
# Put E2E_EMAIL / E2E_PASSWORD in repo-root `.env.local` — `npm run test:e2e` loads them into the Maestro process.
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


### Hydration sentinels for visual evidence

Visual-sweep flows must wait for data-driven screens to expose their hidden
`*-hydrated` testID before the first `takeScreenshot`. Waiting only for the
screen container (for example `screen-today`) can capture pre-hydration
skeletons, transient join-load states, or stale dev-client bundle output that
looks like a real design regression. Current sentinels are `today-hydrated`,
`planner-hydrated`, `discover-hydrated`, and `progress-hydrated`; add a matching
non-user-facing wrapper testID before introducing screenshots for another
data-driven surface.

`npm run mobile:test:dark-sweep` also terminates the app after pre-warming Metro
so Maestro launches against the freshly compiled bundle instead of reusing a
running stale JS bundle.

## Visual regression — screenshot diff

Maestro flows assert text visibility, not how the screen *looks*. A button can overlap a macro card by 3 px and every `assertVisible` still passes. The screenshot-diff layer closes that gap on the daily-loop surfaces.

**What's wired:**

- `02_today_screen.yaml`, `33_meal_journal.yaml`, `25_import_shared.yaml` call `takeScreenshot: screenshots/latest/<name>` at deliberate moments (default state, scrolled, sheet open, etc.). Maestro runs from `apps/mobile/`, so these land at `apps/mobile/screenshots/latest/<name>.png`.
- `scripts/maestro-screenshot-diff.mjs` compares `screenshots/latest/` against `screenshots/baseline/` using `pixelmatch`, writes per-shot diffs, and emits `screenshots/diff/report.html` (side-by-side baseline / latest / diff). Exits non-zero if any shot's differing pixels exceed `--threshold` (default 0.1%).
- `screenshots/baseline/` is committed; `screenshots/latest/` and `screenshots/diff/` are gitignored.

**First run (one-time):**

```bash
# 1. Run the suite to produce screenshots/latest/.
npm run mobile:test:e2e

# 2. Eyeball each PNG under apps/mobile/screenshots/latest/. If they look right,
#    promote to baseline:
npm run mobile:test:screens:update-baseline

# 3. Commit the new baselines.
git add apps/mobile/screenshots/baseline/
git commit -m "test(mobile): seed screenshot baselines for today/journal/import"
```

**Per-release / per-PR:**

```bash
npm run mobile:test:e2e            # populates screenshots/latest/
npm run mobile:test:screens:diff   # writes screenshots/diff/report.html
open apps/mobile/screenshots/diff/report.html
```

A `FAIL` row means the diff exceeded the threshold — open the report and look at the diff PNG. Three classes of regression caught here that text assertions miss: layout shift (e.g. ring label clipping inner macros), contrast / colour drift (token rename gone wrong), and z-index regressions (sheet under FAB).

**When to update the baseline:** any time a deliberate visual change ships on Today, the meal journal, the LogSheet, or import. Workflow: ship the change → run the suite → review the diffs → if they match the intent, run `npm run mobile:test:screens:update-baseline` and commit.

**Tuning:** flag `--threshold=0.005` (0.5%) on the diff command if anti-aliasing on a noisy device produces false positives, or `--tolerance=0.05` to make pixelmatch stricter per-pixel. Defaults are tuned for iPhone 15 Simulator.

**Caveats:**

- Different simulator / device == different pixel dimensions == `SIZE MISMATCH`. Standardise on one Simulator (recommend iPhone 15, Light mode, default text size) for the baseline. Document it in your CI config when this graduates.
- Don't bake date-of-week or auth-tier-dependent content into shots. Day-strip is fine (we screenshot the whole header), but a "Day 47 streak" pip will diff every day. The current shots avoid this.

## Stable selectors

- **Tab bar (post 6→4 IA collapse, 2026-04-27):** the four visible tab labels are `Today`, `Recipes`, `Plan`, `You`. Match via stable testIDs — `tapOn: { id: "tab-today" }`, `tab-recipes`, `tab-plan`, `tab-you` (set as `tabBarButtonTestID` in `(tabs)/_layout.tsx`). The older `.*Today, tab.*` regex relied on iOS VoiceOver appending a `, tab` suffix; iOS 26 dropped that. The legacy labels `Discover, tab` / `Progress, tab` / `More, tab` no longer exist either — they collapsed into Recipes/You sub-tab pills.
- **Sub-tab pills (`SubTabPill`):** `Recipes` lands on Library by default, with sub-tab pills `Library` and `Discover` (see `RecipesSubTabHeader.tsx`). `You` lands on Progress by default, with sub-tab pills `Progress` and `Settings` (see `YouSubTabHeader.tsx` — the legacy `More` pill was removed in the Group G IA collapse, 2026-04-28). Match a sub-tab via testID — `tapOn: { id: "subtab-discover" }`, `subtab-library`, `subtab-settings`, `subtab-progress`, `subtab-plan`, `subtab-shopping` (the convention is `subtab-{id}`, set on the `SubTabPill` Pill primitive). Text-based matching via `text: "^Discover$"` works but is timing-sensitive when the pill bar mounts; prefer the testID. Maestro's `tapOn` does **not** support `accessibilityRole` as a property — use `text:` (regex) or `id:` (testID) only.
- **`/more` is currently UI-orphaned** (Group G IA collapse, 2026-04-28). The Settings consolidation is mid-flight; many sections (stat pills, Goals & Targets, Connections / Apple Health, Daily Targets, Create Recipe, Help & Information, Legal, Danger Zone) still live on `/(tabs)/more` but have no sub-tab pill or row pointing there. Flows for those sections deeplink via `openLink: suppr:///more` until the migration into `/settings` lands. Once Group G batches B-E ship, those flows should switch to `tapOn: { id: "subtab-settings" }`.
- **Centered raised Log button (global tab bar):** the canonical Log entry point. 2026-04-30: moved from a side-positioned FAB (right:18 / bottom:100) into the global `<SupprTabBar>` as a centered raised 56pt circular Plus button between the Recipes and Plan tabs (Cal AI / Lifesum convention). Match via `tapOn: { id: "today-log-fab" }` — testID was retained from the old FAB so existing flows keep working without edits. The button is global to all four tabs; tapping it from any tab routes to Today with `?openLog=1`, which opens the canonical LogSheet. See `LogTabBarButton.tsx` + `SupprTabBar.tsx`. The legacy `LogFab.tsx` component is preserved (deferred deletion) but is no longer rendered.
- **LogSheet (opens from the raised Log button):** root has `testID="log-sheet-root"`, backdrop `testID="log-sheet-backdrop"`, search row `testID="log-sheet-search-row"`. Right-edge icons via accessibility labels: `Scan barcode` / `Voice log` / `Photo log` (`Voice log (Pro)` and `Photo log (Pro)` when locked for Free / Base tier). Footer `Or add manually` and `Close log sheet` are accessibility-labelled. See `LogSheet.tsx`.
- **Discover Import CTA:** `testID="discover-import-cta"` on the "Import from TikTok, Instagram..." row (added 2026-04-29 because the longer visible text made `tapOn: text:` brittle). See `(tabs)/discover.tsx`.
- **Legacy `TodayQuickLogStrip.tsx`** is imported but no longer rendered in `(tabs)/index.tsx` (line 164). Treat as dead code pending decision (delete vs. re-wire) — do **not** rely on the `today-quick-log-*` testIDs.

## Authentication

Flows use `shared/login.yaml`: **`EXPO_DEV_SERVER_URL`**, **`E2E_EMAIL`**, **`E2E_PASSWORD`** are passed to Maestro via `-e` by **`scripts/run-maestro-e2e.mjs`** (values come from repo-root **`.env.local`**, then your shell). Do not commit real passwords; use a dedicated Supabase test user and local env only.

## Troubleshooting

| Symptom | What to check |
|--------|----------------|
| **`[maestro-e2e] Metro not ready`** | Start Expo first; port in **`EXPO_DEV_SERVER_URL`** must match Metro (default **8081**). |
| **`No development build … is installed`** (after pressing **i**) | Run **`npm run mobile:ios:simulator`** once to build/install the dev client on the Simulator (see Metro table above). |
| **`[maestro-e2e] Missing E2E_EMAIL`** | Set credentials in **repo root `.env.local`**, or `export` them in the shell. |
| **`login.yaml` times out** (`Today` never appears) | **`shared/login.yaml` now types into the login form** when `login-email` is visible (uses **`E2E_EMAIL` / `E2E_PASSWORD`** from Maestro `-e`). If you still see no typing: confirm Metro passed those env vars (`npm run test:e2e` loads `.env.local`). If login succeeds but timeout persists: Supabase user likely needs **`onboarding_completed=true`**. Optional: set **`EXPO_PUBLIC_E2E_AUTH_ENABLED`** + matching **`EXPO_PUBLIC_E2E_*`** in **repo-root `.env.local`** so the app signs in **before** UI (no visible typing). |
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
| 02_today_screen.yaml | Calorie ring, macro cards, quick-log buttons, ring toggle, scroll, voice/search quick-log · 📸 screenshots: `today-01-loaded`, `today-02-scrolled`, `today-03-voice-{upsell,sheet}`, `today-04-search-modal` |
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
| 25_import_shared.yaml | Import shared recipe: idle state, URL input, source grid, clipboard · 📸 screenshots: `import-01-discover`, `import-02-idle` |
| 26_recipe_verify.yaml | Recipe verify: ingredient list, nutrition facts, portion editing, confirm |
| 27_progress_metric.yaml | Progress metric detail: calorie/protein/streak deep dive, day breakdown |
| 28_notifications_prompt.yaml | Notification prompt: enable/skip flow (post-onboarding) |
| 29_more_menu.yaml | Profile/More: all settings sections, widget picker, week start, reset modal, sign out |
| 36_health_sync_mfp_import.yaml | **DEVICE-ONLY (ENG-874)** — MFP → Apple Health → Suppr meal import: connect, enable import, Sync Now, assert meal on Today. Needs a physical iPhone + live MFP/Health data; **not** in `config.yaml`. Runbook: `docs/testing/health-sync-device-runbook.md` |

**Suite vs files:** `npm run test:e2e` runs the ordered list in **`.maestro/config.yaml`** only. Flows not in the config run manually: **00_connect** (manual Expo URL), **09_onboarding** (long wizard), **19_paywall** (gated/flaky), **23_nutrition_sources** (external link), **26_recipe_verify** (needs specific recipe state), **28_notifications_prompt** (post-onboarding only), and **36_health_sync_mfp_import** (physical iPhone + live MFP→Health only — see ENG-874). Run manually: `maestro test .maestro/09_onboarding.yaml -e …`.

## CI integration

Add to GitHub Actions:
```yaml
- name: Install Maestro
  run: curl -Ls "https://get.maestro.mobile.dev" | bash
- name: Run Maestro tests
  run: ~/.maestro/bin/maestro test apps/mobile/.maestro/ --no-ansi
```

## Per-PR validation flows (`.maestro/validation/`)

Different from the regression suite above: these flows are short,
testID-driven, and run against a known-seeded fixture. Built for the
"validate this PR end-to-end before flag rollout" loop.

| Flow | Validates | Seed |
|---|---|---|
| `validation/today_snacks_v2.yaml` | PR #246 — flag `today_log_usual_row_v2` Snacks header relayout | `npm run e2e:seed:today-snacks` |

### Why testIDs not text

Text-based `tapOn`/`assertVisible` for RN modal layers on iOS 26 fail
silently — Maestro's view-hierarchy probe can return false even when the
element is plainly on screen, and on certain RN trees the probe raises
`kAXErrorInvalidUIElement`. Validation flows resolve every element by
`testID`, which is stable across builds, accessibility-tree quirks, and
locale. Components touched in a PR must carry a `testID` on the
asserted element before the validation flow can be written.

testID contract for `TodayMealsSection`:

```
today-slot-{Slot}                       container
today-slot-header-{Slot}                clickable header row
today-slot-chevron-{Slot}               collapse/expand chevron
today-log-usual-pill-in-header-{Slot}   chip (flag-off / legacy)
today-log-usual-row-{Slot}              v2 dedicated row (flag-on)
today-log-usual-pill-{Slot}             v2 row pill (flag-on)
```

Mirrored on web (`src/app/components/suppr/today-meals-section.tsx`)
with the same names so a single Playwright/Maestro contract works on
both surfaces.

### Maestro reliability scaffolding

Run `npm run e2e:today-snacks` (which chains `maestro:reset` → seed →
flow). The chain:

1. **`scripts/maestro-reset.sh`** kills `maestro-driver-iosUITests-Runner`,
   `maestro.cli.AppKt`, and the `xcodebuild` child from stale sessions
   (the most common cause of "Maestro hangs / steps skip silently").
   Then ensures the iPhone 17 Pro / iOS 26.4 sim is booted and
   terminates a previous Suppr instance. Set `MAESTRO_SIM` to override
   the sim name.

2. **`scripts/e2e-seed-today-snacks.ts`** (service-role, scoped to
   `E2E_EMAIL`) wipes prior `E2E:` fixtures and inserts:
   - 1 `user_saved_meals` row with a deliberately long name and
     `default_meal_slot='Snacks'`.
   - 2 `user_saved_meal_items` children.
   - 2 `nutrition_entries` rows for today with `name='Snacks'`.

   Idempotent. Refuses to run against any email outside the allowed
   domain list (`hotmail.co.uk`, `outlook.com`, `test.suppr.club`).

3. **`apps/mobile/.maestro/validation/today_snacks_v2.yaml`** asserts
   the 6 PR-plan checks via testIDs and writes screenshots to
   `.maestro/artifacts/today_snacks_v2/`.

### Suggested Bash allowlist additions

For an agent driving these flows, add the following to
`.claude/settings.local.json` so the routine cleanup + run steps don't
hit permission walls (the agent cannot add these itself):

```json
"Bash(bash scripts/maestro-reset.sh*)",
"Bash(./scripts/maestro-reset.sh*)",
"Bash(npx tsx scripts/e2e-seed-today-snacks.ts*)",
"Bash(pkill -u graceturner -f maestro-driver-iosUITests-Runner*)",
"Bash(pkill -u graceturner -f maestro.cli.AppKt*)",
"Bash(pkill -u graceturner -f maestro_xctestrunner_xcodebuild_output*)",
"Bash(/Users/graceturner/.maestro/bin/maestro test apps/mobile/.maestro/validation/*)",
"Bash(npm run e2e:today-snacks*)",
"Bash(xcrun simctl terminate * com.supprclub.supprapp)",
"Bash(xcrun simctl launch * com.supprclub.supprapp)"
```
