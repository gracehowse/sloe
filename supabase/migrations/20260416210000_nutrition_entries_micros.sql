-- Per-meal micronutrients from imports / rich logging (sugar, sodium, etc.).
-- NOTE: if sodium/sugar become filterable targets, migrate these to dedicated columns
-- (jsonb reads can't be indexed cheaply for range/threshold queries and will not scale
-- once "find days where sodium > X" or "show high-sugar meals" become user-facing filters).
alter table nutrition_entries
  add column if not exists nutrition_micros jsonb not null default '{}'::jsonb;

comment on column nutrition_entries.nutrition_micros is 'Optional micronutrients map (e.g. sugarG, sodiumMg, saturatedFatG, cholesterolMg). If sodium/sugar become filterable targets, migrate to dedicated columns for index performance.';
