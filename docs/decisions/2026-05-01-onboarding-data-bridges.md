# Onboarding — re-add `data-bridges` step (Build-40)

**Date:** 2026-05-01
**Area:** Onboarding
**Status:** Resolved

## Context

The customer-lens audit on 2026-04-30 shrank the onboarding flow from 15
to 12 steps by moving `permissions`, `import`, and `recipes` off the
linear flow (see
`docs/decisions/2026-04-19-onboarding-redesign-scope.md` and the in-line
rationale in `src/lib/onboarding/state.ts`). The shrink was the right
call against the 15-step counter, which tested as the highest-friction
single signal.

A follow-up customer-lens pass over the shrunk flow surfaced a different
problem: three competitor-refugee personas (MFP, MacroFactor, Paprika)
were bouncing on day 1 because the post-shrink flow ended at the Reveal
"aha" with no path to bring their existing data with them. The empty
state on Today the next morning read as "I'm starting from scratch
again", which is exactly what these users were trying to avoid by
choosing Suppr over their existing tool.

## Decision

Re-introduce a single optional terminal step — `data-bridges` —
positioned AFTER Reveal, that bundles the bridges most personas land at
the door with:

1. **Manual targets** — paste-in 4-input form for users who already
   know their kcal / P / C / F (MFP / MacroFactor refugees). Persisted
   via the new `effectiveTargetsForPersist()` helper which OVERRIDES the
   BMR-computed targets when all four fields are set + finite + > 0.
2. **Apple Health** (mobile only) — wraps `requestHealthPermissions` →
   `syncHealthData(userId)`. On deny opens iOS Settings via
   `Linking.openURL("app-settings:")`. Web omits this card per
   `project_ios_only_no_android.md`.
3. **Notifications** — gentle reminders. Mobile lazy-imports
   `expo-notifications`; web uses `window.Notification.requestPermission`.
4. **Recipe URL** — preserves the legacy `import.tsx` parser flow
   (idle → parsing → done phases) as one card.

Each card is independently skippable. A "Maybe later" affordance lets
the user advance the empty path without touching anything.
`dataBridgeChosen` is the audit signal capturing which card they
actioned (or `"skip"`); `null` reads as "never touched the step".

This adds one step (12 → 13) but doesn't re-introduce the friction the
shrink was solving:
- The linear-flow body steps (signup → reveal) still ship at 12.
- `data-bridges` is fully optional — none of the four cards are required
  to advance.
- The progress bar stops growing at Reveal (Reveal is still the "aha" moment).

## Schema

`OnboardingState` gains five fields:

```ts
manualTargetsKcal: number | null;
manualTargetsProteinG: number | null;
manualTargetsCarbsG: number | null;
manualTargetsFatG: number | null;
dataBridgeChosen: "manual" | "apple-health" | "notifications" | "recipe" | "skip" | null;
```

`STEP_IDS` adds `"data-bridges"` after `"reveal"` (13th, terminal).
`canAdvance("data-bridges")` returns `true` always — every card is
optional.

## Persistence

`effectiveTargetsForPersist(state, computed)` is the new precedence
helper:

- All four manual fields set + finite + > 0 → synthesise a `V2Targets`
  (kcal + P/C/F; fiber via 14g/1000kcal heuristic).
- Otherwise → `computed` unchanged.

`buildProfileUpsertRow` consults it BEFORE the `weightSkipped`
null-targets branch, so a user who skipped weight AND set manual
targets writes concrete targets to `profiles` (the manual override
implies they know their numbers regardless of scale interaction).

## Analytics

Two new events registered on the canonical names list:

- `onboarding_data_bridge_chosen` — fires on each card action. Payload:
  `{ option: "manual" | "apple-health" | "notifications" | "recipe",
     url_provided?: boolean }`. Multiple emits per session expected.
- `onboarding_data_bridge_skipped` — fires when "Maybe later" is
  tapped. Payload: `{ reason: "card_tap" }`.

`onboarding_completed` payload extends with `data_bridge_chosen` (LAST
card actioned, captured for funnel slicing) and `manual_targets_set`
(boolean — whether the manual override was complete).

## Parity

| Card             | Web | Mobile |
| ---------------- | --- | ------ |
| Manual targets   | yes | yes    |
| Apple Health     | no  | yes    |
| Notifications    | yes | yes    |
| Recipe URL       | yes | yes    |
| Maybe later      | yes | yes    |

Apple Health is the only intentional divergence — there is no
HealthKit equivalent on web. Per
`feedback_mobile_decisions_apply_to_web.md` the parity rule allows a
carve-out where the platform genuinely cannot deliver the affordance.

## Tests

- `tests/unit/onboardingState.test.ts` — extended for 13 steps and the
  new `data-bridges` `canAdvance` cases.
- `tests/unit/onboardingDataBridgesPersist.test.ts` (NEW, 13 cases) —
  pins the `effectiveTargetsForPersist` precedence rule and the
  manual-override branch of `buildProfileUpsertRow`.
- `tests/unit/onboardingDataBridgesWeb.test.tsx` (NEW, 8 cases) —
  behaviour test for the web step (manual entry, partial entry, skip).
- `apps/mobile/tests/unit/onboardingDataBridges.test.tsx` (NEW, 5 cases)
  — behaviour test for the mobile step.

## Follow-ups

- Add a Settings → Health sync row that re-uses the same mobile card
  body (already wired; the data-bridges step is the on-ramp, Settings
  is the always-on home).
- Post-launch: nudge sequencing on Today to re-surface unused bridges
  (e.g. user skipped notifications → day-3 nudge). Tracked in
  `docs/planning/ongoing-backlog.md`.
