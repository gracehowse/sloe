-- ENG-1130 — named meal-plan slot metadata (ids, names, active selection).
-- Plan bodies stay in meal_plan_days keyed by slot_id; this column syncs
-- the slot registry across devices without stuffing full DayPlan[] JSONB.
alter table public.profiles
  add column if not exists meal_plan_slots jsonb not null default '{"slots":[],"active_slot_id":null}'::jsonb;

comment on column public.profiles.meal_plan_slots is
  'Named meal-plan slot registry: { slots: [{ id, name }], active_slot_id }. Plan bodies live in meal_plan_days.';
