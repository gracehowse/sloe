-- H10: Convert household_meals.date_key from text to date.
--
-- The column was originally typed as text storing 'YYYY-MM-DD' to stay
-- symmetric with older JSONB-derived date keys. Everything else in the
-- schema (nutrition_entries.date_key, etc.) uses the `date` type, and text
-- comparisons are both slower and error-prone ('2026-4-1' vs '2026-04-01').
--
-- Pre-flight: scan for any rows that don't match the canonical YYYY-MM-DD
-- shape. If we find any, RAISE EXCEPTION and abort — the cast would fail
-- anyway, but this gives an actionable error message before data mutation.

do $$
declare
  bad_count integer;
begin
  select count(*) into bad_count
  from public.household_meals
  where date_key !~ '^\d{4}-\d{2}-\d{2}$';

  if bad_count > 0 then
    raise exception
      'Cannot convert household_meals.date_key to date: % row(s) do not match YYYY-MM-DD. Fix data first.',
      bad_count;
  end if;
end $$;

alter table public.household_meals
  alter column date_key type date using date_key::date;

NOTIFY pgrst, 'reload schema';
