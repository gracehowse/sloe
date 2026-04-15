-- Per-meal micronutrients from imports / rich logging (sugar, sodium, etc.).
alter table nutrition_entries
  add column if not exists nutrition_micros jsonb not null default '{}'::jsonb;

comment on column nutrition_entries.nutrition_micros is 'Optional micronutrients map (e.g. sugarG, sodiumMg, saturatedFatG, cholesterolMg)';
