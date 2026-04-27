# Decision log: meal_plans schema fix — start_date column choice (T7, retroactive 2026-04-25)

**Date:** 2026-04-24 (decision); 2026-04-25 (doc backfilled per P1-17)
**Status:** Resolved (shipped as commit `9e3b64a`)
**Trigger:** T7 / Phase 2 condition #7 of [2026-04-24 full-sweep ship verdict](./2026-04-24-full-sweep-ship-verdict.md). `findPlanDayIdForCalendarDate` had a "first-match-offset" bug — when a user generated multiple multi-day plans across different start dates, the calendar lookup didn't know which plan a given date belonged to. The lookup returned the first match by ordinal day-number, producing wrong-recipe-on-this-date renders.

---

## Decision

**Add `start_date date NOT NULL` to `meal_plan_days`** (NOT a parent `meal_plans` table).

Migration: `supabase/migrations/20260503100300_meal_plan_days_start_date.sql` (and a related `meal_plan_days_start_date_idx` for fast lookups).

`findPlanDayIdForCalendarDate` now reads `meal_plan_days.start_date` directly to disambiguate which plan owns a given calendar date.

## Rationale

Two architectures considered:

- **A. New parent `meal_plans` table** with `id`, `user_id`, `start_date`, `days_count`, etc. `meal_plan_days` becomes a child via FK.
- **B. Add `start_date` directly to `meal_plan_days`.**

We chose **B** because:
1. Every existing `meal_plan_days` row already represents a specific day of a specific plan. The plan's `start_date` is functionally a property of that day's row (along with the day-ordinal). Promoting it to a column avoids a join on every read.
2. Multi-plan support today is "user generates a new 7-day plan; old plans are de-facto archived." There's no UI affordance to switch between plans (named-slot switcher is mobile P2-23). A parent table optimizes for a feature we don't ship.
3. The named-slot switcher (when it ships) reads from `user_plan_templates` (a separate, pre-existing table for saved-template plans), not from a hypothetical `meal_plans`. No future code path needs the parent shape.
4. Forward-only compatibility: adding a column is reversible (`ALTER TABLE ... DROP COLUMN`); creating a parent table with FK migration is more complex to undo if we change our minds.

The audit's other concern — "calendar anchor ambiguity" when multiple plans coexist — is solved at the lookup layer in `src/lib/mealPlan/planCalendarAnchor.ts` (read `start_date`, compute the day offset, match unambiguously). Tests in `tests/unit/planCalendarAnchor.test.ts` were rewritten as part of T7 to reflect correct behaviour.

## Alternatives considered

- **Parent `meal_plans` table (Option A).** Rejected per above. Added complexity without a feature requirement.
- **Compute `start_date` from the lowest `created_at` of the `meal_plan_days` rows in the same plan group.** Rejected. Brittle — clock drift, manual edits, or backfill operations could shift the inferred anchor.
- **Add a `plan_id` column without a parent table.** Rejected. Same data with an extra hop; doesn't enable any read pattern that `start_date` doesn't.

## Implementation

- Migration: [`supabase/migrations/20260503100300_meal_plan_days_start_date.sql`](../../supabase/migrations/20260503100300_meal_plan_days_start_date.sql).
- Lookup helper: [`src/lib/mealPlan/planCalendarAnchor.ts`](../../src/lib/mealPlan/planCalendarAnchor.ts).
- Tests: `tests/unit/planCalendarAnchor.test.ts` (rewritten — was previously pinning the bug).
- Save RPC (related): T15 `save_meal_plan` atomic RPC at `supabase/migrations/20260503100400_save_meal_plan_rpc.sql`.

## Platforms affected

- **Web:** `MealPlanner` component reads via the lookup helper.
- **Mobile:** `apps/mobile/app/(tabs)/planner.tsx` reads via the same shared helper.
- **Supabase:** new column on existing table, idempotent migration.

## Revisit when

- A multi-plan UI ships (P2-23 mobile slot switcher, plus a web equivalent). Confirm the lookup helper still disambiguates correctly when the user has 5+ active plans.
- Plan generation grows beyond 7 days. The current `start_date + day_index` math holds for any duration, but the UI assumptions in `MealPlanner` may not.
- A user-requested feature requires plan-level metadata (e.g. "rename this plan", "duplicate plan to another week"). At that point, promote to a parent table.
