-- ENG-1387 — server-side enforcement of the Free-tier meal-plan day cap
-- ======================================================================
-- Background (2026-07-05 money-path deep audit, entitlements §4): the
-- Free = 1-day plan cap was enforced ONLY client-side — web
-- (`src/app/components/MealPlanner.tsx`: `days = isFree ? 1 : planDays`)
-- and mobile (`apps/mobile/app/(tabs)/planner.tsx`: locked day chips +
-- clamp-to-1 effect). This RPC validated `day ∈ 1..7` but never read
-- tier, so any Free user calling `supabase.rpc('save_meal_plan', …)`
-- directly with their own JWT could persist a full 7-day plan — the
-- same client-only-gate bug class already fixed on `saves`
-- (20260426100000_saves_free_tier_cap.sql) and `recipes.published`
-- (20260426100100_recipes_publish_tier_gate.sql). This RPC is the only
-- write path into meal_plan_days / meal_plan_meals (call-site census
-- 2026-07-05: web AppDataContext, mobile planner ×2, onboarding
-- first-week seeder), so gating here closes the hole without touching
-- the identity-only RLS policies.
--
-- What changes vs the prior body (20260511100000_recipe_id_fk_cascade.sql §3):
--
--   1. Free-tier day cap: when `public.auth_profile_user_tier()` (the
--      SECURITY DEFINER helper from 20260520100000, reused for
--      consistency with the saves-cap policy) returns 'free', any plan
--      day > 1 raises 42501. Non-free tiers keep the existing 1..7
--      range. Missing profile row → helper returns 'free' → capped,
--      so new signups are covered from day one. The raise rolls back
--      the whole call including the leading DELETE, so a rejected
--      save preserves the user's existing cloud plan (matters for a
--      Pro→Free downgrade holding a legacy multi-day plan: their plan
--      becomes read-only rather than truncated).
--   2. `p_slot_id` null → 'default'. The client contract
--      (`src/lib/onboarding/onboardingFirstWeek.ts`: "null lets the
--      RPC pick") was never implemented — an explicit SQL NULL
--      bypasses the column default on `meal_plan_days.slot_id`
--      (text NOT NULL DEFAULT 'default') and raised 23502. See
--      ENG-1388 for the rest of the dead onboarding seed chain.
--   3. `SET search_path = public, pg_temp` is declared on the function
--      itself. CREATE OR REPLACE wipes proconfig, so without this the
--      20260516150000 ALTER FUNCTION hardening would be silently lost.
--   4. anon/PUBLIC EXECUTE revoked (class-B posture from
--      20260702126100_eng1307_rpc_execute_lockdown.sql — authed-only
--      client RPC; unauth callers only ever reached the 42501 guard,
--      now the surface is gone entirely).
--
-- Error contract for clients: 42501 + message containing
-- 'free tier is limited to 1-day plans'. Distinguish from the
-- unauthenticated 42501 by message. Web toasts / mobile alerts on this
-- (normal UI flows never trigger it — the client clamp fires first;
-- it is reachable on stale-cached-tier desync or a downgrade holding a
-- multi-day plan).
--
-- Onboarding interaction (deliberate, not a gap): the first-week
-- seeder (D-2026-04-27-14) would persist 7 days for Free signups
-- through this RPC, but that chain has never succeeded in production
-- (PostHog 2026-07-05: recipes_resolved = 0 on all 4 ever
-- onboarding_completed events; the null-slot 23502 would have stopped
-- it regardless). When ENG-1388 repairs seed resolution, the seeded
-- week's tier semantics must be decided against this gate — tracked
-- there, not silently deferred here.
--
-- Behaviour preserved from 20260511100000: atomic replace, 42501
-- unauth guard, 22023 day-range check, per-row recipe_id uuid cast
-- with NULL fallback, meals loop with EXCEPTION block.
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
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_slot_id text;
  v_is_free boolean;
  v_day_record jsonb;
  v_meal_record jsonb;
  v_day_id uuid;
  v_day_num int;
  v_recipe_id_text text;
  v_recipe_id_uuid uuid;
begin
  -- Reject unauthenticated callers immediately. RLS would reject the
  -- writes anyway; this is a clearer error.
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'save_meal_plan: not authenticated' using errcode = '42501';
  end if;

  -- ENG-1387/ENG-1388: honour the documented "null lets the RPC pick"
  -- contract — fall back to the canonical default slot instead of
  -- letting an explicit NULL bypass the column default and 23502.
  v_slot_id := coalesce(p_slot_id, 'default');

  -- ENG-1387: resolve the caller's tier once, before any write.
  -- SECURITY DEFINER helper (20260520100000) — same source of truth as
  -- the saves-cap RLS policy; missing profile row reads as 'free'.
  v_is_free := public.auth_profile_user_tier() = 'free';

  -- Replace all meal_plan_days rows for this user+slot. Cascades to
  -- meal_plan_meals via the FK on plan_day_id.
  delete from public.meal_plan_days
    where user_id = v_user_id and slot_id = v_slot_id;

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

    -- ENG-1387: Free tier persists at most a 1-day plan. Rollback of
    -- the whole call (including the DELETE above) preserves any
    -- existing cloud plan on rejection.
    if v_is_free and v_day_num > 1 then
      raise exception 'save_meal_plan: free tier is limited to 1-day plans (got day %)', v_day_num
        using errcode = '42501';
    end if;

    insert into public.meal_plan_days (user_id, slot_id, day, start_date)
      values (v_user_id, v_slot_id, v_day_num, p_start_date)
      returning id into v_day_id;

    if v_day_record->'meals' is not null
       and jsonb_typeof(v_day_record->'meals') = 'array'
    then
      for v_meal_record in
        select value from jsonb_array_elements(v_day_record->'meals') as t(value)
      loop
        -- Phase 1 (2026-05-11): per-row uuid cast with a graceful
        -- fallback. Pre-cast the column was text and stored the raw
        -- string; post-cast we need a real uuid or NULL. A malformed
        -- string (legacy build, drift) becomes NULL rather than
        -- aborting the whole plan save.
        v_recipe_id_text := v_meal_record->>'recipe_id';
        v_recipe_id_uuid := null;
        if v_recipe_id_text is not null and v_recipe_id_text <> '' then
          begin
            v_recipe_id_uuid := v_recipe_id_text::uuid;
          exception when invalid_text_representation then
            v_recipe_id_uuid := null;
          end;
        end if;

        insert into public.meal_plan_meals (
          plan_day_id, slot_index, name, recipe_title, recipe_id,
          calories, protein, carbs, fat,
          portion_multiplier, is_placeholder
        )
        values (
          v_day_id,
          coalesce(nullif(v_meal_record->>'slot_index', '')::int, 0),
          coalesce(v_meal_record->>'name', ''),
          coalesce(v_meal_record->>'recipe_title', ''),
          v_recipe_id_uuid,
          coalesce(nullif(v_meal_record->>'calories', '')::int, 0),
          coalesce(nullif(v_meal_record->>'protein', '')::real, 0),
          coalesce(nullif(v_meal_record->>'carbs', '')::real, 0),
          coalesce(nullif(v_meal_record->>'fat', '')::real, 0),
          coalesce(nullif(v_meal_record->>'portion_multiplier', '')::real, 1),
          coalesce(nullif(v_meal_record->>'is_placeholder', '')::boolean, false)
        );
      end loop;
    end if;
  end loop;
end;
$$;

comment on function public.save_meal_plan(text, date, jsonb) is
  'T15 (2026-04-24): atomic plan replace. Phase 1 (2026-05-11): recipe_id uuid cast with NULL fallback. ENG-1387 (2026-07-05): server-side Free-tier day cap — free callers are rejected (42501) for any day > 1, closing the client-only paywall gate; null p_slot_id now falls back to ''default''. SECURITY INVOKER so RLS still applies. See docs/product/tier-gates.md.';

-- Re-grant execute (CREATE OR REPLACE keeps the ACL, but re-granting
-- is idempotent and keeps intent visible next to the definition) and
-- remove the anon/PUBLIC surface per the eng1307 lockdown posture.
grant execute on function public.save_meal_plan(text, date, jsonb) to authenticated;
revoke execute on function public.save_meal_plan(text, date, jsonb) from public, anon;

notify pgrst, 'reload schema';
