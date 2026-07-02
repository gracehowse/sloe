-- ENG-1306 (b) — atomic per-day upserts for the body-metric JSONB maps.
-- Stage this migration for `supabase db push --linked`; do not apply via MCP.
--
-- Problem: every writer of `profiles.weight_kg_by_day` /
-- `profiles.body_fat_pct_by_day` (manual weigh-in on web + mobile, HealthKit
-- sync) did a client-side read-modify-write of the WHOLE map. Two concurrent
-- writers (HealthKit sync racing a manual weigh-in, or two devices) each read
-- the full map and the last UPDATE clobbers the other's day keys — silent
-- weigh-in loss.
--
-- Fix: a single RPC that patches only the caller's day keys server-side
-- (jsonb key-level upsert), under the profile row lock, so concurrent
-- writers merge instead of clobber. Patch semantics per key:
--   * number  → upsert that day
--   * null    → delete that day (mobile "delete weigh-in")
-- Scalars (`weight_kg`, `body_fat_pct`) are derived server-side from the
-- merged map (newest finite positive day value) — the same rule every client
-- computed locally — so the "current weight" pill can never disagree with the
-- map after a merge.
--
-- SECURITY INVOKER on purpose: the function only touches the caller's own
-- profiles row (id = auth.uid()) and runs under the existing profiles RLS
-- (clients already update these columns directly today).

create or replace function public.upsert_body_metric_days(
  p_weight_patch jsonb default null,
  p_body_fat_patch jsonb default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_weight jsonb;
  v_bf jsonb;
  v_key text;
  v_val jsonb;
  v_weight_scalar double precision;
  v_bf_scalar double precision;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  if p_weight_patch is null and p_body_fat_patch is null then
    raise exception 'empty_patch';
  end if;

  -- Validate patch shape before touching the row: day keys must be
  -- YYYY-MM-DD; values must be JSON numbers or null (null = delete key).
  for v_key, v_val in
    select key, value from jsonb_each(coalesce(p_weight_patch, '{}'::jsonb))
    union all
    select key, value from jsonb_each(coalesce(p_body_fat_patch, '{}'::jsonb))
  loop
    if v_key !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'invalid_day_key: %', v_key;
    end if;
    if jsonb_typeof(v_val) not in ('number', 'null') then
      raise exception 'invalid_patch_value_for: %', v_key;
    end if;
  end loop;

  -- Row lock — serialises concurrent patches on the same profile so each
  -- merge sees the previous writer's keys.
  select coalesce(weight_kg_by_day, '{}'::jsonb),
         coalesce(body_fat_pct_by_day, '{}'::jsonb)
    into v_weight, v_bf
    from public.profiles
   where id = v_user
   for update;

  if not found then
    raise exception 'profile_not_found';
  end if;

  if p_weight_patch is not null then
    -- Key-level upsert: delete null-valued keys, merge the rest.
    v_weight := (v_weight
      - array(select key from jsonb_each(p_weight_patch) where value = 'null'::jsonb))
      || jsonb_strip_nulls(p_weight_patch);
    -- Prune to the newest 400 day keys (MAX_WEIGHT_JSONB_DAYS parity with
    -- the app-side pruneWeightKgByDay).
    v_weight := (
      select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
      from (
        select key, value from jsonb_each(v_weight) order by key desc limit 400
      ) newest
    );
    -- Newest finite positive day value = the scalar "current weight".
    select (value #>> '{}')::double precision
      into v_weight_scalar
      from jsonb_each(v_weight)
     where jsonb_typeof(value) = 'number'
       and (value #>> '{}')::double precision > 0
     order by key desc
     limit 1;
  end if;

  if p_body_fat_patch is not null then
    v_bf := (v_bf
      - array(select key from jsonb_each(p_body_fat_patch) where value = 'null'::jsonb))
      || jsonb_strip_nulls(p_body_fat_patch);
    -- MAX_BODY_FAT_JSONB_DAYS parity (src/lib/progress/bodyCompositionTrends.ts).
    v_bf := (
      select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
      from (
        select key, value from jsonb_each(v_bf) order by key desc limit 400
      ) newest
    );
    select (value #>> '{}')::double precision
      into v_bf_scalar
      from jsonb_each(v_bf)
     where jsonb_typeof(value) = 'number'
       and (value #>> '{}')::double precision > 0
     order by key desc
     limit 1;
  end if;

  update public.profiles
     set weight_kg_by_day = case when p_weight_patch is not null then v_weight else weight_kg_by_day end,
         weight_kg = case when p_weight_patch is not null then v_weight_scalar else weight_kg end,
         body_fat_pct_by_day = case when p_body_fat_patch is not null then v_bf else body_fat_pct_by_day end,
         body_fat_pct = case when p_body_fat_patch is not null and v_bf_scalar is not null then v_bf_scalar else body_fat_pct end
   where id = v_user;

  return jsonb_build_object(
    'weight_kg_by_day', v_weight,
    'body_fat_pct_by_day', v_bf,
    'weight_kg', v_weight_scalar,
    'body_fat_pct', v_bf_scalar
  );
end;
$$;

revoke all on function public.upsert_body_metric_days(jsonb, jsonb) from public, anon;
grant execute on function public.upsert_body_metric_days(jsonb, jsonb) to authenticated;
