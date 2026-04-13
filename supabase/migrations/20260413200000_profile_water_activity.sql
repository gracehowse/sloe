-- Add water and activity tracking to profiles for cross-device sync.
-- Both stored as JSONB: { "2026-04-13": 500, "2026-04-14": 750 }
-- Small datasets (max ~365 keys/year) that change frequently.

alter table profiles add column if not exists extra_water_by_day jsonb default '{}'::jsonb;
alter table profiles add column if not exists activity_burn_by_day jsonb default '{}'::jsonb;
