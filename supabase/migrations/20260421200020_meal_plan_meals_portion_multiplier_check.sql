-- H9: Enforce portion_multiplier > 0 on meal_plan_meals.
--
-- A zero or negative portion multiplier makes no nutritional sense and
-- silently zeros out / negates all downstream macro math. user_saved_meal_items
-- already has the same check (see 20260421120000_user_saved_meals.sql). This
-- migration aligns meal_plan_meals with that invariant.
--
-- Guarded with a DO block so re-runs are safe.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'meal_plan_meals_portion_multiplier_positive'
      and conrelid = 'public.meal_plan_meals'::regclass
  ) then
    alter table public.meal_plan_meals
      add constraint meal_plan_meals_portion_multiplier_positive
      check (portion_multiplier > 0);
  end if;
end $$;

NOTIFY pgrst, 'reload schema';
