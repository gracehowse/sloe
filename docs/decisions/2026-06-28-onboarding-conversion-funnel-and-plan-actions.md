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
