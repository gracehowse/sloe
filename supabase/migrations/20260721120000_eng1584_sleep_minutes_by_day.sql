-- ENG-1584: Add JSONB column for sleep data from Apple Health SleepAnalysis.
-- sleep_minutes_by_day: { "2026-07-19": 427 }  (minutes actually asleep per local
-- calendar day — HKCategoryValueSleepAnalysis Asleep/Core/Deep/REM only; excludes
-- InBed/Awake segments and merges overlapping multi-source intervals before
-- summing. See apps/mobile/lib/healthSyncSleep.ts for the aggregation logic and
-- apps/mobile/lib/healthSync.ts's `syncHealthData` for the write path — same
-- shape/precedent as the workouts_by_day / basal_burn_by_day columns added in
-- 20260416150000_workout_and_basal_burn_columns.sql.

alter table profiles
  add column if not exists sleep_minutes_by_day jsonb default '{}'::jsonb;

comment on column profiles.sleep_minutes_by_day is 'Per-day minutes actually asleep from Apple Health SleepAnalysis (ENG-1584); excludes in-bed/awake time';
