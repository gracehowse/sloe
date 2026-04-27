# Decision log: mobile named-slot switcher UI — already shipped (P2-23, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved — was already shipped before P2-23 surveyed it
**Trigger:** P2-23 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). Audit said web had a pill-row switcher for T7 named multi-day plans; mobile had no equivalent UI even though shared CRUD helpers existed.

---

## Decision

**No code change required.** Mobile planner already ships the switcher at `apps/mobile/app/(tabs)/planner.tsx` lines 244–259 (state via `useMealPlanSlots` hook) + lines 1350–1395 (horizontal-scroll pill row UI with switch-on-press + long-press for rename / delete).

The shared CRUD helpers at `src/lib/mealPlan/namedSlots.ts` are consumed by both platforms; the hook at `apps/mobile/hooks/use-meal-plan-slots.ts` wraps them for React Native state. Web equivalent is in `src/app/components/MealPlanner.tsx`. No drift.

The audit was wrong. Updating §6 of the audit to reflect actual state.

## Rationale

Audit correction. The slot switcher shipped as part of T7 (multi-day plan calendar anchor) work in the 2026-04-24 sweep; mobile's port was prototype-port work the same week.

## Audit correction

`docs/audits/2026-04-25-opus47-codebase-review.md` UX-agent §6 row #5 ("Mobile named-slot switcher missing") is stale. Mobile has it. Updating the row.

## Related artefacts

- [Mobile planner](../../apps/mobile/app/\(tabs\)/planner.tsx) (lines 244–259, 1350–1395)
- [Mobile hook](../../apps/mobile/hooks/use-meal-plan-slots.ts)
- [Shared CRUD](../../src/lib/mealPlan/namedSlots.ts)
- [Web planner](../../src/app/components/MealPlanner.tsx)
- [T7 meal_plans schema fix](./2026-04-24-meal-plans-schema-fix.md)

## Revisit when

- A new slot lifecycle action is added (e.g. duplicate slot, archive slot). Add to `src/lib/mealPlan/namedSlots.ts` first; both platforms consume the shared CRUD.
- Slot count regularly exceeds 5 → horizontal scroll becomes unwieldy; consider a vertical sheet picker.
