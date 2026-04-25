-- T15 — full-sweep 2026-04-24 Phase 2 condition.
--
-- Closes data-integrity §2 (partial-plan risk on backgrounded app) and
-- performance §F3 (14 serial RTTs on mobile plan save). The current
-- mobile persist path:
--   1. DELETE meal_plan_days for user+slot
--   2. for each day: INSERT meal_plan_days, then INSERT meal_plan_meals
-- runs as 1 + 7 + 7 = 15 separate round-trips per regenerate, with no
-- transaction wrapper — backgrounding the app between days 3 and 4
-- leaves the user with a partial plan and the shopping list already
-- purged.
--
-- Fix: a single Postgres function `save_meal_plan` that performs the
-- delete + all inserts in one statement transaction. The client makes
-- one RPC call. Atomic by construction (no partial-write window) and
-- collapses 15 RTTs to 1.
--
-- Security model: SECURITY INVOKER (default). The function runs under
-- the caller's role, so existing RLS policies on meal_plan_days and
-- meal_plan_meals continue to apply — no row can be written that the
-- caller doesn't own.
--
-- Schema contract for `p_plan` (jsonb):
--   [
--     {
--       "day": 1,
--       "meals": [
--         {
--           "slot_index": 0,
--           "name": "...",
--           "recipe_title": "...",
--           "recipe_id": null | "uuid",
--           "calories": 0,
--           "protein": 0,
--           "carbs": 0,
--           "fat": 0,
--           "portion_multiplier": 1,
--           "is_placeholder": false
--         },
--         ...
--       ]
--     },
--     ...
--   ]
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration).

set search_path = public;

create or replace function public.save_meal_plan(
  p_slot_id text,
  p_start_date date,
  p_plan jsonb
)
returns void
language plpgsql
security invoker
as $$
declare
  v_user_id uuid;
  v_day_record jsonb;
  v_day_id uuid;
  v_day_num int;
begin
  -- Reject unauthenticated callers immediately. RLS would reject the
  -- writes anyway; this is a clearer error.
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'save_meal_plan: not authenticated' using errcode = '42501';
  end if;

  -- Replace all meal_plan_days rows for this user+slot. Cascades to
  -- meal_plan_meals via the FK on plan_day_id.
  delete from public.meal_plan_days
    where user_id = v_user_id and slot_id = p_slot_id;

  -- An empty / null plan acts as a "clear" operation — the DELETE
  -- above is sufficient.
  if p_plan is null or jsonb_typeof(p_plan) <> 'array' then
    return;
  end if;

  -- Iterate plan days. Each iteration inserts the day row + (if
  -- meals[] is present) the meals for that day. The whole loop runs
  -- inside the function's implicit statement transaction, so a
  -- partial write — e.g. day 4 fails — rolls back days 1..3 too.
  for v_day_record in
    select value from jsonb_array_elements(p_plan) as t(value)
  loop
    v_day_num := (v_day_record->>'day')::int;
    if v_day_num is null or v_day_num < 1 or v_day_num > 7 then
      raise exception 'save_meal_plan: day must be in 1..7 (got %)', v_day_num
        using errcode = '22023';
    end if;

    insert into public.meal_plan_days (user_id, slot_id, day, start_date)
      values (v_user_id, p_slot_id, v_day_num, p_start_date)
      returning id into v_day_id;

    if v_day_record->'meals' is not null
       and jsonb_typeof(v_day_record->'meals') = 'array'
    then
      insert into public.meal_plan_meals (
        plan_day_id, slot_index, name, recipe_title, recipe_id,
        calories, protein, carbs, fat,
        portion_multiplier, is_placeholder
      )
      select
        v_day_id,
        coalesce(nullif(m->>'slot_index', '')::int, 0),
        coalesce(m->>'name', ''),
        coalesce(m->>'recipe_title', ''),
        m->>'recipe_id',
        coalesce(nullif(m->>'calories', '')::int, 0),
        coalesce(nullif(m->>'protein', '')::real, 0),
        coalesce(nullif(m->>'carbs', '')::real, 0),
        coalesce(nullif(m->>'fat', '')::real, 0),
        coalesce(nullif(m->>'portion_multiplier', '')::real, 1),
        coalesce(nullif(m->>'is_placeholder', '')::boolean, false)
      from jsonb_array_elements(v_day_record->'meals') as m;
    end if;
  end loop;
end;
$$;

comment on function public.save_meal_plan(text, date, jsonb) is
  'T15 (2026-04-24): atomic plan replace. One RPC call replaces 1 DELETE + 7 day-INSERTs + 7 meals-INSERTs (15 round-trips on mobile) with a single transactional statement. SECURITY INVOKER so existing RLS policies still apply. See docs/audits/2026-04-24-full-sweep.md §F3 + data-integrity §2.';

-- Grant execute to authenticated users so the function is callable
-- from the supabase-js anon client.
grant execute on function public.save_meal_plan(text, date, jsonb) to authenticated;
