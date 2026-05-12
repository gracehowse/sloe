# Reset plan — simpler Lose It-style flow

**Date:** 2026-05-11
**Status:** Resolved
**Area:** Mobile settings, onboarding
**PR:** [#228](https://github.com/gracehowse/Suppr/pull/228)

## Context

Build-47 TestFlight feedback (Grace): "Reset plan doesn't walk you through
'onboarding' again to reconfigure your preferences again like it should.
Similar to Lose It — start and refresh plan — options — use old plan, start
new plan."

The prior Settings flow had two destructive choices:

1. **Reset targets** (inline) — wiped `target_calories` / macros to
   `NUTRITION_DEFAULTS` but kept the user's profile state (goal,
   weight, height, dietary, etc.) untouched. No re-onboarding. Surfaced a
   "Targets reset to defaults" toast and bounced to `/targets`.
2. **Erase everything** — nuclear wipe via `nukeAllUserAppData` + force
   onboarding from scratch.

This was wrong for the user's mental model. "Reset plan" in
MyFitnessPal / Lose It means "I want to redo my plan because my
weight / goals changed" — not "wipe my numeric targets but preserve
the goal that produced them." A user resetting their plan almost
always wants to re-answer the goal questions.

## Decision

Replace the two-branch model with a single Lose It-style flow:

```
Settings → Refresh my plan
  → walks through canonical /onboarding (15-step v2 flow)
  → at the end, one-shot Alert: "Keep my logs and weight history?"
       Keep → routes back to Today, all data intact
       Clear → wipes nutrition_entries + daily_targets + goal_history
                + profile JSONB log columns (weight_kg_by_day,
                  steps_by_day, activity_*, fasting_sessions,
                  adaptive_tdee*)
                → routes back to Today

Settings → Erase everything (unchanged)
  → nuclear wipe via nukeAllUserAppData
```

The "Erase everything" path stays as the nuclear option for genuine
"delete my data and start over" intent.

## Mechanics

1. **Settings** (`apps/mobile/components/settings/SettingsBundleContent.tsx`)
   - `handleRefreshPlan`: sets `profiles.onboarding_completed = false`,
     clears `suppr.onboarding-v2.state` AsyncStorage draft, writes
     `suppr.reset-plan-pending-prompt` AsyncStorage flag, routes to
     `/onboarding`.
   - `handleNukeEverything`: unchanged from the prior `handleResetPlan(true)`.

2. **Onboarding completion** (`apps/mobile/components/onboarding/mobile-flow.tsx`)
   - `handleComplete` reads `suppr.reset-plan-pending-prompt` after
     `persistOnboarding`. If set, surfaces the Keep / Clear Alert and
     clears the flag. Handoff query is
     `?onboarding_complete=1&refresh=1` (no `firstRun`) so Today skips
     the first-run polish.

3. **Scoped wipe helper** (`src/lib/account/nukeAccountData.ts`)
   - New `clearLogsAndWeightHistory(supabase, userId)`. Wipes logs +
     weight / steps / fasting history. **Preserves** saves, private
     recipes, meal_plans, shopping_items, and the freshly-set
     onboarding targets / body stats.

## Why not just call `nukeAllUserAppData` on Clear?

`nukeAllUserAppData` resets profile target_calories to NUTRITION_DEFAULTS
and nullifies weight_kg / height_cm / sex / dob / goal / dietary. After
a refresh-plan run, those fields were JUST set by the onboarding pass
that completed moments ago. Calling the nuclear helper would undo the
user's fresh answers. Hence the scoped helper.

## Tests pinned

- `tests/unit/clearLogsAndWeightHistory.test.ts` (5 cases) — scoped
  wipe contract: what's cleared, what's preserved, missing-table
  tolerance, error surfacing.
- `apps/mobile/tests/unit/settingsBundleParity.test.ts` — new modal
  contract (`Refresh my plan` / `Erase everything`; reset-plan flag
  written).
- `apps/mobile/tests/unit/onboardingNoPaywallShock.test.ts` — branched
  `homeQs` (`firstRun=1` first-time, `refresh=1` re-run).

## Open follow-ups

- TestFlight smoke: Settings → Refresh my plan → onboarding → Keep /
  Clear → Today on both. Build 48 will include this.
- Web parity (`src/app/(authed)/settings`): the web Settings page
  currently still has the old "Reset targets / Erase everything"
  buttons via the shared `nukeAllUserAppData`. Web doesn't have a
  /onboarding flow that supports re-runs, so the simpler Lose It
  flow is mobile-only by design until the web onboarding can be
  re-entered. Logged as a sync-enforcer carve-out.
