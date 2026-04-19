-- F-2 · Daily target snapshot (TestFlight build 10 feedback `AEyOuUJrB4l`,
-- 2026-04-19 15:17Z).
--
-- Problem: when a user changed `activity_level` / `plan_pace` / `goal` on
-- their profile, every past day's "% of goal" bar on Progress
-- recalculated against the *new* target — so days they hit cleanly at
-- the old target read as "over budget" after the edit. Feedback screenshot
-- showed Mon-Fri sitting at 121-162% of a 1,125 kcal target for a user
-- who'd just demoted herself from moderate → sedentary.
--
-- Fix: snapshot the current target on the first write of each local day.
-- Past rows stay frozen. Future rows get the new target from the day of
-- the edit onward. We do NOT backfill historical rows — the whole point
-- is that past days don't move.
--
-- Shape: one row per user per date. `on conflict (user_id, date_key) do
-- nothing` means only the first write per day lands — subsequent logs
-- see the lock already in place.
--
-- Call sites (all platforms use the shared
-- `src/lib/nutrition/dailyTargetSnapshot.ts` helper):
--   - Web: `src/context/appData/useNutritionJournalState.ts` after a
--     successful `nutrition_entries.insert`.
--   - Mobile: the log-food paths in `apps/mobile/app/(tabs)/index.tsx`,
--     `.../barcode.tsx`, `.../planner.tsx`, `apps/mobile/app/recipe/[id].tsx`.
--
-- Read sites (all use `src/lib/nutrition/dailyTargetRead.ts` to resolve
-- past-day targets with fallback to the current profile target):
--   - `apps/mobile/app/(tabs)/progress.tsx` (Calories this week bars +
--     day list).
--   - `apps/mobile/app/progress-metric.tsx` (per-day % of goal rows).
--   - `src/app/components/ProgressDashboard.tsx` (web equivalent).
--   - `src/app/components/ProgressMetricDetail.tsx` (web per-day rows).
--
-- Today's live view is deliberately NOT changed: today always resolves
-- to the current profile target.

create table if not exists public.daily_targets (
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key date not null,
  target_calories integer,
  target_protein_g integer,
  target_carbs_g integer,
  target_fat_g integer,
  target_fiber_g integer,
  activity_level text,
  plan_pace text,
  goal text,
  maintenance_tdee integer,
  created_at timestamptz not null default now(),
  primary key (user_id, date_key)
);

create index if not exists daily_targets_user_date_desc_idx
  on public.daily_targets (user_id, date_key desc);

alter table public.daily_targets enable row level security;

-- Drop-and-recreate guards for idempotent re-runs — `create policy if not
-- exists` isn't supported on older Postgres versions we target.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'daily_targets'
      and policyname = 'Users can read own daily targets'
  ) then
    create policy "Users can read own daily targets"
      on public.daily_targets for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'daily_targets'
      and policyname = 'Users can insert own daily targets'
  ) then
    create policy "Users can insert own daily targets"
      on public.daily_targets for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'daily_targets'
      and policyname = 'Users can update own daily targets'
  ) then
    create policy "Users can update own daily targets"
      on public.daily_targets for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end$$;

notify pgrst, 'reload schema';
