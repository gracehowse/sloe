-- ENG-1106 — persist full nutrition_micros on saved-meal item rows so
-- re-logging a usual meal carries sugar/sodium and the full micro panel.

alter table public.user_saved_meal_items
  add column if not exists nutrition_micros jsonb not null default '{}'::jsonb;

comment on column public.user_saved_meal_items.nutrition_micros is
  'Snapshot of per-item micronutrients at save time (same keys as nutrition_entries.nutrition_micros). Empty object when none.';
