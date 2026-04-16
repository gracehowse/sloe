# Maestro E2E Tests

These tests drive the real iOS Simulator or Android Emulator and verify user-visible behaviour.

## Prerequisites

1. **Java**: `brew install --cask temurin` (requires sudo)
2. **Maestro**: `curl -Ls "https://get.maestro.mobile.dev" | bash`
3. **iOS Simulator** or **Android Emulator** running
4. **App running** via `npx expo start` or a dev build

## Running

```bash
# Run all tests
maestro test .maestro/

# Run a single test
maestro test .maestro/01_navigation.yaml

# Run with recording (saves video)
maestro record .maestro/01_navigation.yaml
```

## Authentication

Tests use `shared/login.yaml` to authenticate with the test account before running.
The login flow handles both already-authenticated and login-required states.
Test credentials are in `shared/login.yaml` — update them if the test account changes.

## Test files

| File | What it tests |
|------|--------------|
| 01_navigation.yaml | All 5 tabs load and respond |
| 02_today_screen.yaml | Calorie ring, macro cards, quick-log buttons, ring toggle |
| 03_meal_plan.yaml | Generate plan, verify meals + macros, shopping list button |
| 04_profile_settings.yaml | Reorganised sections, targets, legal links, export |
| 05_recipe_detail.yaml | Open recipe, ingredients, Start Cooking, Log to journal |
| 06_burn_detail.yaml | Tap burn card, verify detail sections |
| 07_progress.yaml | Stats grid, charts, weight journey |
| 08_voice_log.yaml | Voice button opens text input fallback |
| 09_onboarding.yaml | Full onboarding wizard: goal, basic info, activity, plan, strategy, dietary, summary |
| 10_search.yaml | Food search tab: query input, USDA results |
| 11_discover.yaml | Discover tab: search, filter pills, import CTA, recipe cards |
| 12_library.yaml | Library: saved recipes, sort, search, empty state |
| 13_fasting.yaml | Intermittent fasting: timer ring, start/end fast, history |
| 14_weight_tracker.yaml | Weight tracker: weight/steps/water/body fat inputs, journey chart |
| 15_meal_nutrition.yaml | Meal nutrition detail: macro breakdown per logged meal |
| 16_shopping.yaml | Shopping list: items, check off, navigation from planner |
| 17_cook_mode.yaml | Cook mode: step-by-step nav, timer, completion |
| 18_macro_detail.yaml | Macro detail: per-meal breakdown for a specific macro |
| 19_paywall.yaml | Paywall: Pro trial timeline, CTA, continue free |
| 20_notifications.yaml | Notifications inbox: empty state, mark all read, unread badge |

## CI integration

Add to GitHub Actions:
```yaml
- name: Install Maestro
  run: curl -Ls "https://get.maestro.mobile.dev" | bash
- name: Run Maestro tests
  run: ~/.maestro/bin/maestro test apps/mobile/.maestro/ --no-ansi
```
