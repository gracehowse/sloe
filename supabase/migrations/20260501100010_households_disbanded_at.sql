-- Household Netflix-model v1 (2026-05-01) — soft-delete column.
--
-- When the last member leaves a household we don't want to hard-delete
-- immediately: `household_meals` are referenced in other users' meal
-- history and logging provenance. Flag the household as disbanded,
-- hide it from all reads, and let a background job hard-delete after
-- 30 days (retention window; separate migration will add the job).
--
-- All read paths must filter `disbanded_at is null`. RLS is the
-- backstop: the "Household members can read" policy continues to
-- require live membership; disbanded households with no members will
-- return nothing anyway. The column exists so the UI can show
-- "Household disbanded" for the grace period and so recovery is
-- trivial (set the column back to null).

alter table public.households
  add column if not exists disbanded_at timestamptz;

create index if not exists idx_households_disbanded
  on public.households (disbanded_at)
  where disbanded_at is not null;

NOTIFY pgrst, 'reload schema';
