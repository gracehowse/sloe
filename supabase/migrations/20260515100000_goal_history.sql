-- F-149 (2026-05-11) — `goal_history` table for effective-date-stamped
-- goal/activity/target changes.
--
-- Why this exists:
--   `daily_targets` snapshots the user's targets per day on first food
--   log of that day. Days the user did not log have no snapshot, so the
--   read path falls back to the CURRENT profile values — and when the
--   user later changes their goal, past unlogged days display the NEW
--   target ("you went over your goal" on days you didn't have that
--   goal). The `backfillDailyTargetsFromProfile` band-aid catches retunes
--   via the two named UI paths (mobile GoalPaceRetuneSheet + web Settings
--   handleActivityLevelConfirm), but any other profile-update surface
--   leaves the drift in place.
--
-- This table records every meaningful change to goal-related fields
-- with an `effective_from` date. The read path can then answer "what
-- goal/target was in force on day D?" by finding the most-recent row
-- where `effective_from <= D`. Pure history — rows are immutable,
-- inserts only.
--
-- Failure mode if migration not applied yet: the read path silently
-- falls back to the existing snapshot + current-profile flow (no rows
-- are written and the SELECT returns empty). No user-visible regression.

create table if not exists public.goal_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- The first day this goal/target combination was in force (inclusive).
  -- Local date the change was saved by the user. Read path: "find the
  -- most-recent row where effective_from <= queried_date".
  effective_from date not null,
  -- Goal-shape fields (mirror profiles columns at write time).
  goal text,
  plan_pace text,
  activity_level text,
  target_calories integer,
  target_protein_g integer,
  target_carbs_g integer,
  target_fat_g integer,
  target_fiber_g integer,
  maintenance_tdee integer,
  -- Where the change came from. Closed set; reject anything else so
  -- the write helper is the only path that touches this table.
  source text not null check (
    source in (
      'settings_save',
      'goal_retune',
      'onboarding',
      'admin'
    )
  ),
  recorded_at timestamptz not null default now()
);

-- Read pattern is "most-recent row where effective_from <= D for user".
-- Descending index gives O(1) per query for any reasonable user.
create index if not exists goal_history_user_effective_from_idx
  on public.goal_history (user_id, effective_from desc);

-- Lookup-by-id (rare but free given the PK).
-- Recorded_at index for audit queries.
create index if not exists goal_history_user_recorded_at_idx
  on public.goal_history (user_id, recorded_at desc);

alter table public.goal_history enable row level security;

-- Users read their own history.
create policy goal_history_select_own
  on public.goal_history
  for select
  using (auth.uid() = user_id);

-- Users insert their own history. The write helper enforces
-- "only insert when the goal-shape actually changed" — RLS just
-- gates the user_id match.
create policy goal_history_insert_own
  on public.goal_history
  for insert
  with check (auth.uid() = user_id);

-- No UPDATE or DELETE policies — history is immutable. If we ever need
-- to delete a row (e.g. user requests account purge), the auth.users
-- cascade handles it.

comment on table public.goal_history is
  'F-149: effective-date-stamped goal/target changes. Insert-only append log. Read path: most-recent row where effective_from <= queried_date is the effective goal for that day.';
