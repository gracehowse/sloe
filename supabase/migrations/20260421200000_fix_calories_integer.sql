-- C3: Widen `calories` columns from smallint (max 32767) to integer.
-- Single high-calorie entries (e.g. a whole pizza logged as one item, or a
-- week-long bulk meal plan entry) can exceed smallint's 32,767 ceiling and
-- silently fail to insert. Integer gives headroom (~2.1B) with negligible
-- storage cost at our row volumes.
--
-- Affected:
--   nutrition_entries.calories   smallint -> integer
--   meal_plan_meals.calories     smallint -> integer
--
-- Safe: smallint -> integer is a widening cast, no data loss, no USING needed.

alter table public.nutrition_entries
  alter column calories type integer;

alter table public.meal_plan_meals
  alter column calories type integer;

NOTIFY pgrst, 'reload schema';
