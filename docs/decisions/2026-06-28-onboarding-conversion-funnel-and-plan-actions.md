# Onboarding conversion funnel + Plan v3 action sheet (ENG-1233 / ENG-1241 / ENG-1238)

**Date:** 2026-06-28  
**Status:** Resolved  
**Area:** Onboarding, Plan  

## Problem

Three Linear tickets were marked as worked but had no user-visible deliverable — the silent-deferral trap:

- **ENG-1241** — onboarding upgrade step: flag only, no step UI
- **ENG-1233** — conversion funnel: flag only, no first-log step
- **ENG-1238** — Plan per-meal action sheet: v3 path had no ⋯ menu

## Decision

Ship the real surfaces behind `onboarding_conversion_funnel_v1` (default-ON per Grace 2026-06-01 rule):

1. **After `data-bridges`:** `upgrade` (skippable Pro trial) → `first-log` (guided first win) → completion
2. **When flag OFF:** skip both steps; `data-bridges` remains terminal (legacy path)
3. **Plan v3:** `plan-card-opt` (⋯) on `PlanMealCardV3` opens the per-meal action sheet (mobile: legacy `rowMenu`; web: `PlanMealActionDialog`)

## Analytics

- `onboarding_trial_choice` — `{ choice: "trial" | "free", platform }`
- `onboarding_first_log_prompt` — `{ choice: "breakfast" | "coffee" | "search" | "skip", platform }`

## Follow-ups

- Wire first-log chip selection to open Today log sheet with slot pre-selected (currently records choice only)
- RevenueCat trial start from onboarding upgrade CTA (mobile paywall / web pricing)
- Extract mobile `rowMenu` into `PlanMealActionSheet.tsx` to shrink pinned `planner.tsx`

## Addendum (2026-07-02 — launch-blocker review, PR #692)

The step order shipped above (`upgrade` → `first-log`) was reordered to
**`first-log` → `upgrade` (terminal)** in the same PR, in response to
launch-blocker review the day after this doc was written. Rationale
(captured in `src/lib/onboarding/state.ts`'s `STEP_IDS` comment, which is
the canonical citation going forward):

- `first-log` (ENG-1233) is the ACTIVATION step; `upgrade` (ENG-1241) is
  the MONETISE step — activate first, ask for money last.
- Making `upgrade` terminal is what lets "skip lands straight on Today, no
  detour through any other screen" hold literally: "Continue on Free" runs
  the completion handler directly; "Start free trial" routes into the
  paywall, which itself lands on Today. Neither path re-enters another
  onboarding step.
- Both steps stay flag-gated behind `onboarding_conversion_funnel_v1`
  together, so the legacy data-bridges-terminal flow is unaffected when
  the flag is off.

No separate decision doc was ever written for this reorder — a source
comment in `state.ts` cited a
`docs/decisions/2026-07-01-onboarding-see-pro-eng1241.md` that doesn't
exist on disk. This addendum is that missing record, backfilled 2026-07-21
(ENG-1605) from the PR #692 commit history once the broken citation was
found.

## Addendum (2026-07-22 — ENG-1459, inline paywall collapse)

The terminal `upgrade` step described above kept a two-surface shape even
after becoming terminal: a static price callout plus a *separate*
modal/route (`UpgradePaywallDialog` on web, `/paywall?from=onboarding` on
mobile) that "Start free trial" opened. ENG-1459 collapses that into one
inline screen behind a new flag, `onboarding_upgrade_inline_paywall_v1`
(DEFAULT-OFF pending a sim/web visual check): the step renders the
paywall's own sell content directly, in place of opening the second
surface. "Continue on Free" keeps running the same terminal `complete()`
path described above; nothing about the funnel's step order, its
default-ON gate (`onboarding_conversion_funnel_v1`), or its terminal-step
semantics changes. Full detail: `docs/journeys/onboarding-to-first-log.md`
§7 and the ENG-1459 commit's legal-preservation checklist.
