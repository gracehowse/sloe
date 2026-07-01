---
date: 2026-07-01
area: plan / leftovers
status: In progress (foundation shipped; UI wiring pending)
owner: Grace (ENG-958, category-leading growth)
linear: ENG-958 (parent ENG-1220)
---

# Cook once, eat twice — surface the leftovers engine as a Plan row action

## Decision

Expose Suppr's existing leftovers model (`leftoversPlanner`) as a deliberate,
warm **"Cook once, eat twice"** action on the Plan tab: from a cooked meal's row
menu, pick the later days you'll eat the leftovers; the recipe is placed as a
leftover on each chosen day (first compatible free slot), macros carried,
totals + shopping list following automatically. Default-ON (`cook_twice_leftovers_v1`,
ENG-1279 "always flag on") with the legacy Plan (no action) as the kill switch.

## Shipped (foundation — PR #673, merged)

- **`repeatMealAsLeftovers(plan, source, targetDays)`** in the shared
  `src/lib/nutrition/leftoversPlanner.ts` — the placement engine. Idempotent,
  never targets the source day, skips days with no compatible free slot
  (reported in `skippedDays`), recomputes totals incl. fibre. 7 tests.
- **Data-integrity fix:** web `MealPlanner.pickSwap` now calls
  `markLeftoversOnSwap` (mobile already did) so swapping a parent no longer
  orphans its leftovers → correct shopping list + totals.

## In this branch (`agent/claude/eng-958-cook-twice-ui`)

- Flag `cook_twice_leftovers_v1` registered **default-ON** in `REDESIGN_DEFAULT_ON`
  on both `src/lib/analytics/track.ts` and `apps/mobile/lib/analytics.ts`.
- **Web dialog** `src/app/components/suppr/plan-cook-twice-dialog.tsx` — the
  multi-select day picker (peer of `plan-move-meal-dialog.tsx`; tokens + states
  matched, filled-primary confirm CTA, disabled until a day is picked).

## Remaining wiring (precise insertion points)

**Web (`MealPlanner.tsx`, pinned 2726 — offset any growth by extracting the
dialog-mount block into a `PlanMealDialogs` child, the CLAUDE.md shrink pattern):**
1. Import `PlanCookTwiceDialog` + add `repeatMealAsLeftovers` to the existing
   `leftoversPlanner` import (line 60).
2. `cookTwiceFrom` state (peer of `moveFrom`, line 368).
3. A `"Cook twice…"` `DropdownMenuItem` after "Move to different slot" (line 2205),
   gated on `isFeatureEnabled("cook_twice_leftovers_v1") && !isPlaceholder`
   (`<Repeat2/>` icon).
4. Mount `<PlanCookTwiceDialog>` beside `PlanMoveMealDialog` (line ~2575);
   `onConfirm={(days) => { setMealPlan(prev => prev ? repeatMealAsLeftovers(prev, {day, slotIndex}, days).plan : prev); toast + setCookTwiceFrom(null); }}`.

**Mobile (`apps/mobile/app/(tabs)/planner.tsx`, pinned — offset likewise):**
5. New `PlanCookTwiceSheet` (peer of `MoveMealSheet`).
6. `"Cook once, eat twice…"` action in the `rowMenu` `ActionRow` list (~line 4594),
   gated on `hasRecipeOv && !meal.isLeftover && !meal.leftoverOf`.
7. Wire the handler through `setPlan` → `persistPlan`.
8. **Port leftover rendering to `PlanMealCardV3`** — a pre-existing gap: the V3
   card renders no leftover badge (legacy did). Add the `leftover` eyebrow +
   subdued treatment (theme tokens; never a warning colour) so placed leftovers
   are visible.

**Both:** flag-parity test (`cook_twice_leftovers_v1`, mirror
`weighInReminderFlagParity`); journey doc (`docs/journeys/meal-planning.md`);
web visual validation (drive Plan → Cook twice → SEE the leftover day); mobile
visual = Grace's sim.

## Why default-ON

The leftovers math is proven (ENG-1150 fibre, no-chain logic, 23 tests) and the
placement engine skips-not-guesses; the action is additive with a clean else.
PostHog `isFeatureDisabled` / removing from the set is the kill switch.
