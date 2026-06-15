-- ENG-1177 — user-configurable meal slots (count + numbered labels).
alter table public.profiles
  add column if not exists meal_slot_config jsonb;

comment on column public.profiles.meal_slot_config is
  'User meal-slot preset: classic | four_meals | six_meals + optional custom labels.';
