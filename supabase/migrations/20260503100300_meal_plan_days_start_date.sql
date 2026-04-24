-- T7 — full-sweep 2026-04-24 Phase 2 condition.
--
-- Closes the plan calendar anchor bug (audit §C2, repo-auditor #1,
-- nutrition-engine #1, data-integrity #1, qa-lead #4): saving a plan
-- with a start offset of "next week" silently collapses onto today
-- because `meal_plan_days.day` stores 1..7 with no persisted anchor
-- and the resolver (`findPlanDayIdForCalendarDate`) iterates
-- `[0, 1, 7]` offsets, returning the first match.
--
-- Fix: add `start_date date` so every plan day carries the explicit
-- calendar date of day 1. The resolver then computes
-- `rowDate = start_date + (day - 1)` deterministically — no iteration,
-- no ambiguity.
--
-- Backfill strategy: for existing rows we cannot recover the user's
-- original save intent (the bug we're fixing ate that signal). Best-
-- effort: anchor every existing plan to its `created_at::date`. For
-- plans saved with the default (offset=0, this week) this is correct;
-- for plans saved "tomorrow" / "next week" the row's start_date will
-- be off by 1 or 7 days until the user regenerates. That's no worse
-- than the current state — the bug already misattributed these plans
-- to today.
--
-- After backfill the column is NOT NULL with a default of CURRENT_DATE
-- so any future insert that forgets to set it falls back to today
-- (safer than NULL — the resolver would otherwise have to branch).
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration).

set search_path = public;

alter table public.meal_plan_days
  add column if not exists start_date date;

-- Backfill — anchor existing rows to the day they were inserted.
-- `created_at` is non-null per the original table definition.
update public.meal_plan_days
  set start_date = created_at::date
  where start_date is null;

alter table public.meal_plan_days
  alter column start_date set not null;

alter table public.meal_plan_days
  alter column start_date set default current_date;

-- Index start_date for "today's plan day" lookups. Combined with the
-- existing `(user_id, slot_id, day)` unique constraint this also gives
-- us a cheap "plans that anchor on X" probe for future filters.
create index if not exists meal_plan_days_user_start_date_idx
  on public.meal_plan_days (user_id, slot_id, start_date);

comment on column public.meal_plan_days.start_date is
  'T7 (2026-04-24): calendar date of day 1 for this plan. Replaces the [0,1,7] offset-iteration in findPlanDayIdForCalendarDate which silently mapped next-week plans to today. Backfilled to created_at::date. See docs/audits/2026-04-24-full-sweep.md §C2 + docs/planning/sweep-2026-04-24-executor-backlog.md T7.';
