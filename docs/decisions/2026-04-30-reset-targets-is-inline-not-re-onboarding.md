# Reset targets is inline, not a re-onboarding (Issue #16)

**Date:** 2026-04-30
**Area:** Settings / Onboarding / Mobile + Web
**Status:** Resolved
**Owners:** product-lead (decision), executor (implementation)

## Context

The mobile Settings → "Reset or start over" sheet exposed two destructive actions:

1. **Reset Plan (Keep My Data)** — copy said "defaults your goals while keeping your food log and saved recipes"
2. **Erase all app data** — copy said "sends you through onboarding again"

The actual code at [`SettingsBundleContent.tsx:540-566`](../../apps/mobile/components/settings/SettingsBundleContent.tsx#L540-L566) made *both* actions:

- Set `onboarding_completed: false`
- Call `clearStructuredMealPlans` (Reset also wiped the planner)
- Route to `/onboarding`

Reset Plan thus re-ran the full 15-step onboarding flow, contradicting its "Keep My Data" copy.

## Decision

**Reset targets is inline. Only Erase Everything re-runs onboarding.**

### Reset targets — new behaviour

- Sets `target_calories`, `target_protein`, `target_carbs`, `target_fat`, `target_fiber_g`, `target_water_ml` to `NUTRITION_DEFAULTS`
- Stamps `target_calories_source: "reset_default"` (Maintenance Recalibrate Rule 2 honour)
- Leaves `onboarding_completed: true` (the user is already onboarded)
- **Does not** clear the planner, food log, library, or any other data
- Closes the sheet and surfaces a toast: "Targets reset to defaults. Your calorie and macro goals are back to Suppr defaults. Edit them anytime." with an "Edit targets" action that deep-links to `/targets`

### Erase everything — unchanged behaviour, fixed routing

- Calls `nukeAllUserAppData(supabase, uid)` (server wipe)
- Clears mobile AsyncStorage health-import keys + **`suppr.onboarding-v2.state`** (issue #14 — without this the next session pre-fills with the deleted user's answers)
- On web, clears the equivalent `localStorage["suppr.onboarding-v2.state"]`
- Routes to **`/onboarding-v2`** (not the doomed legacy `/onboarding` — issue #13)

### Copy + button label changes

- "Reset Plan (Keep My Data)" → **Reset targets** (sub-caption: "Defaults your goals — keeps food log, planner, recipes")
- "Erase all app data" → **Erase everything** (sub-caption: "Wipes all data and sends you through setup again")
- Confirm dialog enumerates *all* deletion categories (food log, journal, library saves, shopping lists, imported recipes, synced activity) — issue #19. Title: "Erase everything?". Confirm button: "Erase everything".

## Why

Suppr's product principle is that targets are the spine of the app — recalibrating them should feel like a setting, not a reset of the user's relationship with the product. Punting a user who tapped a button literally labelled "Keep My Data" through a 15-step questionnaire is a contract violation.

Onboarding is a one-time surface; treating it as a recalibration tool inflates its job and degrades it for genuine first-runs. The right direction is to make the lightweight path actually lightweight.

If users later signal they want a guided recalibration ("walk me through goals + activity again"), that's a third explicit action — not an overload of Reset.

## Reconsider on

- Real signal that users tapping Reset *expect* a guided walkthrough — support tickets, session replays showing confusion at the inline toast, or >20% of Reset users immediately opening Settings to hand-edit targets.
- At N=1 today, ship the lighter path.

## Web parity (issue #15)

- `apps/mobile/lib/nukeAccountData.ts` moved to [`src/lib/account/nukeAccountData.ts`](../../src/lib/account/nukeAccountData.ts) so the web Settings page can import it
- `apps/mobile/constants/nutritionDefaults.ts` now re-exports from `src/constants/nutritionDefaults.ts` — both surfaces use the same defaults
- Web Settings now exposes both Reset targets + Erase everything actions, with the same confirm dialog copy

## Implementation pointers

- Mobile reset/erase handler: [`apps/mobile/components/settings/SettingsBundleContent.tsx`](../../apps/mobile/components/settings/SettingsBundleContent.tsx#L517-L601) (`handleResetPlan`)
- Web reset/erase handlers: [`src/app/components/Settings.tsx`](../../src/app/components/Settings.tsx) (`handleResetTargets`, `handleEraseEverything`)
- Tests: `apps/mobile/tests/unit/settingsBundleParity.test.ts` — five new assertions cover "Reset targets" label, no-clearStructuredMealPlans on Reset, /onboarding-v2 route, suppr.onboarding-v2.state clear, full erase delete-list copy

## Pending follow-ups

- Targets editor deep-link — `Edit targets` action on the Reset toast routes to `/targets` (mobile) / `/home?view=targets` (web). Verify the web destination renders correctly when targeted from the toast — if not, surface a planner task to add a dedicated route.
- Planner-clear on Reset — current decision: **no**. Reset targets does not clear the planner. If stale plans (built against old macro budgets) become a confusion source, reconsider — but document the user-visible "your planner still uses the old targets" risk explicitly.
