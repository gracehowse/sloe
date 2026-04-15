-- Add JSONB columns for workout and resting (basal) energy data from Apple Health.
-- workouts_by_day: { "2026-04-15": [{ "type": "Walking", "minutes": 76, "calories": 155, "source": "Apple Watch" }] }
-- basal_burn_by_day: { "2026-04-15": 1396 }  (kcal)

alter table profiles
  add column if not exists workouts_by_day jsonb default '{}'::jsonb,
  add column if not exists basal_burn_by_day jsonb default '{}'::jsonb;

comment on column profiles.workouts_by_day is 'Per-day workout list from Apple Health / Health Connect';
comment on column profiles.basal_burn_by_day is 'Per-day resting (basal) energy burned in kcal from Apple Health';
