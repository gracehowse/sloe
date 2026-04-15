-- Stable HealthKit quantity-sample UUID for apple_health imports (de-dupe / re-sync).
alter table nutrition_entries
  add column if not exists health_sample_id text;

create unique index if not exists idx_ne_user_health_sample_id
  on nutrition_entries (user_id, health_sample_id)
  where health_sample_id is not null;
