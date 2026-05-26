-- target-recompute unification (2026-05-26) — add the lossless,
-- continuous pace source of truth to `public.profiles`.
--
-- Apply via `supabase db push --linked` — NOT via MCP apply_migration.
-- (MCP rewrites schema_migrations.version to wall-clock NOW(), drifting
--  from the deliberately-monotonic file timestamps. See CLAUDE.md.)
--
-- Why:
--   `plan_pace` is a 4-value preset enum (relaxed/steady/accelerated/
--   vigorous). Onboarding + the editor + the weekly check-in all compute
--   targets from a CONTINUOUS pace (kg/week), then snap to the nearest
--   preset for the legacy `plan_pace` column. That snap is lossy: a user
--   on 0.4 kg/week and one on 0.5 kg/week both persist as `steady`, so a
--   later recompute that reads `plan_pace` back can't reconstruct the
--   pace the user actually chose. `pace_kg_per_week` stores the exact
--   continuous value; `plan_pace` stays as the derived/snapped mirror for
--   legacy read sites (weeksToGoal, plan-option labels, etc.).
--
-- Nullable + no default: existing rows keep NULL (their `plan_pace`
-- preset remains the source of truth until their next recompute writes
-- the continuous value alongside the snapped preset). No backfill — a
-- snapped preset → continuous value would be a guess, and we never invent
-- nutrition inputs.
--
-- RLS: `profiles` already has row-owner RLS (a user can read/update only
-- their own row). Adding a column inherits the table policies; no new
-- policy is required.

alter table public.profiles
  add column if not exists pace_kg_per_week numeric;

-- Defence-in-depth (data-integrity nit 2026-05-26): pace is a magnitude
-- (direction is derived from goal), so reject negatives loudly rather than
-- silently storing a bad nutrition input. Guarded for idempotency.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_pace_kg_per_week_nonneg'
  ) then
    alter table public.profiles
      add constraint profiles_pace_kg_per_week_nonneg
      check (pace_kg_per_week is null or pace_kg_per_week >= 0);
  end if;
end $$;

comment on column public.profiles.pace_kg_per_week is
  'Lossless continuous goal pace in kg/week (always positive; direction derived from goal). Written by every post-onboarding target recompute alongside the snapped plan_pace preset. NULL for rows that predate the column or have never recomputed — read plan_pace as the fallback. target-recompute unification 2026-05-26.';
