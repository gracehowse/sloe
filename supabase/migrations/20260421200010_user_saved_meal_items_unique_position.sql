-- H8: Enforce unique (saved_meal_id, position) on user_saved_meal_items.
--
-- The original table (20260421120000_user_saved_meals.sql) deliberately
-- omitted this constraint because re-ordering was out of scope. We now want
-- deterministic ordering and safe upserts keyed on position — callers must
-- allocate a unique position per item within a combo. Existing rows created
-- before this migration may have duplicates; the DO block is an existence
-- guard that skips adding the constraint if it's already in place, but does
-- NOT silently tolerate duplicate data. If the ALTER fails with
-- `duplicate key value violates unique constraint`, that's a real data
-- integrity issue that must be resolved before re-running.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_saved_meal_items_saved_meal_id_position_key'
      and conrelid = 'public.user_saved_meal_items'::regclass
  ) then
    alter table public.user_saved_meal_items
      add constraint user_saved_meal_items_saved_meal_id_position_key
      unique (saved_meal_id, position);
  end if;
end $$;

NOTIFY pgrst, 'reload schema';
