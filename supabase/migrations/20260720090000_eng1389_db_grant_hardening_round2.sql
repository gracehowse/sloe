-- ============================================================================
-- 20260720090000_eng1389_db_grant_hardening_round2.sql
--
-- ENG-1389 — live-DB security verification spike, hardening round 2.
--
-- Three small, independent defense-in-depth fixes flagged by the live Supabase
-- advisor + a manual grant audit (all verified read-only; NONE applied yet —
-- Grace runs `supabase db push --linked`, Claude/MCP must NOT apply, per
-- CLAUDE.md: MCP apply rewrites schema_migrations.version to NOW() and drifts).
--
--   SEC-08  Revoke the dormant client WRITE grants on the two webhook-
--           ingestion tables (revenuecat_events, stripe_webhook_events). Both
--           are service-role-only (INSERT by the webhook handlers in
--           src/lib/{revenuecat,stripe}/webhookProcess.ts) and already RLS
--           default-deny to anon/authenticated (RLS enabled, NO policies) — so
--           this is NOT currently exploitable, just unnecessary grant surface.
--           Supabase's bootstrap ALTER DEFAULT PRIVILEGES grants full CRUD to
--           anon/authenticated at CREATE time; neither table's original
--           migration (20260503100700 / 20260503100800) revoked it. Precedents:
--           recipe_claims (`revoke all` — 20260702120000) and the ENG-1320
--           referral F5 lockdown (`revoke insert, update, delete, truncate,
--           references, trigger` — 20260702126200). SELECT is deliberately
--           LEFT (RLS-inert; no client reads exist — grep-verified across
--           src/, app/, apps/) so the change is exactly the excess WRITE
--           surface the advisor flagged. REVOKE of a non-held privilege is a
--           no-op, so the six-privilege set is safe regardless of live state.
--
--   SEC-09  Add a per-user failed-attempt throttle to
--           household_join_by_invite_code (SECURITY DEFINER, authenticated-
--           executable). The invite code is 48-bit
--           (encode(extensions.gen_random_bytes(6),'hex') — 20260420100000),
--           so brute force is already infeasible, but a plaintext-code join
--           flow with no attempt cap is a defense-in-depth gap. The RPC is
--           called DIRECTLY from the web + mobile clients
--           (src/lib/household/householdClient.ts -> supabase.rpc), NOT through
--           a Next.js route — the app-layer src/lib/server/rateLimit.ts
--           (next/headers + Upstash) is architecturally OUT of the request
--           path, so the throttle MUST live in the DB to cover both platforms.
--           Modeled EXACTLY on the shipped ENG-1103 promo throttle
--           (promo_redeem_throttle — 20260614120000): a per-user primary-key
--           counter + rolling 60s window, 10 failed attempts/min, increment on
--           wrong-code guesses, reset on success.
--
--   NEW-A   Pin search_path on the trigger-only function
--           ingredient_image_aliases_touch_updated_at (advisor lint 0011
--           function_search_path_mutable). Identical treatment to the one its
--           direct sibling ingredient_images_touch_updated_at already got
--           (ENG-1307 class D — 20260702126100): set search_path = '' AND
--           revoke the RPC surface. Body touches only NEW + now(), so `= ''`
--           is safe (pg_catalog is always implicitly searched). Trigger firing
--           does not check the invoker's EXECUTE, so revoking only removes the
--           unnecessary rpc() surface.
--
-- Apply step (Grace runs this — Claude/MCP must NOT apply):
--   supabase db push --linked
--   then re-run the security advisor: SEC-08 clears the excess-grant note and
--   NEW-A clears lint 0011 for ingredient_image_aliases_touch_updated_at.
-- ============================================================================

begin;

-- ── SEC-08 — revoke dormant client WRITE grants on webhook-ingestion tables ──
-- Service-role-only tables (RLS default-deny to anon/authenticated). SELECT is
-- left in place (RLS-inert; no client reads — grep-verified). Six-privilege
-- write set matches the ENG-1320 referral F5 lockdown idiom.
revoke insert, update, delete, truncate, references, trigger
  on table public.revenuecat_events from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.stripe_webhook_events from anon, authenticated;

-- ── SEC-09 — per-user failed-attempt throttle for household join-by-code ─────
-- Rolling 60s window of failed (wrong-code) attempts per authenticated user.
-- Same primitive as ENG-1103 promo_redeem_throttle. Definer-only: RLS on with
-- NO client policies + an explicit revoke, so the dormant bootstrap CRUD grants
-- (the exact surface SEC-08 removes above) never accrue on this new table.
create table if not exists public.household_join_throttle (
  user_id uuid primary key references auth.users (id) on delete cascade,
  failed_count integer not null default 0 check (failed_count >= 0),
  window_started timestamptz not null default now()
);

alter table public.household_join_throttle enable row level security;
revoke all on table public.household_join_throttle from anon, authenticated;

comment on table public.household_join_throttle is
  'ENG-1389 SEC-09: per-user rolling-60s failed-attempt counter for household_join_by_invite_code (brute-force defense-in-depth on the 48-bit invite code). Definer-only; no client policies. Mirrors ENG-1103 promo_redeem_throttle.';

create or replace function public.household_join_by_invite_code(
  p_invite_code text,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_display text;
  v_household record;
  v_existing_membership record;
  v_member_count int;
  v_failed integer;
  v_window timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_invite_code is null or length(trim(p_invite_code)) = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'missing_code',
      'message', 'Invite code is required.'
    );
  end if;

  v_code := lower(trim(p_invite_code));
  v_display := nullif(trim(coalesce(p_display_name, '')), '');
  if v_display is not null and length(v_display) > 30 then
    v_display := substring(v_display from 1 for 30);
  end if;

  -- SEC-09 (ENG-1389): brute-force throttle. Read + roll the per-user window
  -- (mirrors ENG-1103 promo_redeem_throttle). 10 failed attempts / 60s.
  select failed_count, window_started
    into v_failed, v_window
  from public.household_join_throttle
  where user_id = v_uid;

  if not found then
    insert into public.household_join_throttle (user_id, failed_count, window_started)
    values (v_uid, 0, now())
    on conflict (user_id) do nothing;
    v_failed := 0;
    v_window := now();
  elsif v_window < now() - interval '60 seconds' then
    update public.household_join_throttle
       set failed_count = 0, window_started = now()
     where user_id = v_uid;
    v_failed := 0;
    v_window := now();
  end if;

  if coalesce(v_failed, 0) >= 10 then
    return jsonb_build_object(
      'ok', false,
      'error', 'rate_limited',
      'message', 'Too many attempts. Please wait a minute and try again.'
    );
  end if;

  -- 1) Is the caller already a member of some household?
  select hm.household_id, hm.role
    into v_existing_membership
  from public.household_members hm
  where hm.user_id = v_uid
  limit 1;

  -- 2) Look up the target household (bypassing RLS via security definer).
  --    T20: load disband + expiry context so we can return distinct codes.
  select h.id, h.name, h.disbanded_at, h.invite_code_expires_at
    into v_household
  from public.households h
  where lower(h.invite_code) = v_code
  limit 1;

  if v_household.id is null then
    -- Wrong code = the brute-force signal. Increment the windowed failure
    -- count (SEC-09) before returning the same error as before.
    insert into public.household_join_throttle (user_id, failed_count, window_started)
    values (v_uid, 1, now())
    on conflict (user_id) do update
      set failed_count = case
            when public.household_join_throttle.window_started < now() - interval '60 seconds' then 1
            else public.household_join_throttle.failed_count + 1
          end,
          window_started = case
            when public.household_join_throttle.window_started < now() - interval '60 seconds' then now()
            else public.household_join_throttle.window_started
          end;
    return jsonb_build_object(
      'ok', false,
      'error', 'invalid_code',
      'message', 'No household found with that invite code.'
    );
  end if;

  if v_household.disbanded_at is not null then
    return jsonb_build_object(
      'ok', false,
      'error', 'household_disbanded',
      'message', 'This household has been disbanded.'
    );
  end if;

  if v_household.invite_code_expires_at is not null
     and v_household.invite_code_expires_at <= now()
  then
    return jsonb_build_object(
      'ok', false,
      'error', 'invite_expired',
      'message', 'This invite code has expired. Ask the owner for a new one.'
    );
  end if;

  -- Idempotent: same user, same household -> success, no-op.
  if v_existing_membership.household_id is not null then
    if v_existing_membership.household_id = v_household.id then
      -- Legit success: clear the failure window.
      update public.household_join_throttle
         set failed_count = 0, window_started = now()
       where user_id = v_uid;
      return jsonb_build_object(
        'ok', true,
        'household_id', v_household.id,
        'household_name', v_household.name,
        'already_member', true
      );
    end if;
    return jsonb_build_object(
      'ok', false,
      'error', 'already_in_household',
      'message', 'Leave your current household first.'
    );
  end if;

  -- 3) Cap check (8 members, same as REST route).
  select count(*)
    into v_member_count
  from public.household_members
  where household_id = v_household.id;

  if v_member_count >= 8 then
    return jsonb_build_object(
      'ok', false,
      'error', 'household_full',
      'message', 'This household has reached the maximum of 8 members.'
    );
  end if;

  -- 4) Insert the membership row and link the profile atomically.
  insert into public.household_members (household_id, user_id, role, display_name)
  values (v_household.id, v_uid, 'member', v_display);

  update public.profiles
     set household_id = v_household.id
   where id = v_uid;

  -- Success: clear the failure window.
  update public.household_join_throttle
     set failed_count = 0, window_started = now()
   where user_id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'household_id', v_household.id,
    'household_name', v_household.name,
    'already_member', false
  );
exception
  when unique_violation then
    -- Race: another device just joined. Treat as idempotent success if we
    -- ended up in the right household, else surface as conflict.
    if exists (
      select 1 from public.household_members
      where user_id = v_uid and household_id = v_household.id
    ) then
      return jsonb_build_object(
        'ok', true,
        'household_id', v_household.id,
        'household_name', v_household.name,
        'already_member', true
      );
    end if;
    return jsonb_build_object(
      'ok', false,
      'error', 'already_in_household',
      'message', 'Leave your current household first.'
    );
end;
$$;

-- create or replace preserves the existing ACL (authenticated EXECUTE from
-- 20260503100500; anon revoked by ENG-1307 20260702126100). Re-affirm the
-- authenticated grant so a fresh replay after the default-privilege flip keeps
-- it; NEVER re-grant anon.
grant execute on function public.household_join_by_invite_code(text, text) to authenticated;

comment on function public.household_join_by_invite_code(text, text) is
  'ENG-1389 SEC-09: adds a per-user failed-attempt throttle (household_join_throttle: 10 wrong-code guesses / 60s -> rate_limited) on top of the T20 disbanded/expiry filters. DB-layer because the RPC is called directly from web+mobile clients, bypassing the Next.js app-layer rate limiter. Mirrors ENG-1103 promo_redeem_throttle.';

-- ── NEW-A — pin search_path on the trigger-only touch_updated_at fn ──────────
-- Advisor lint 0011 (function_search_path_mutable). Same fix its sibling
-- ingredient_images_touch_updated_at got in ENG-1307 class D (20260702126100).
revoke execute on function public.ingredient_image_aliases_touch_updated_at() from public, anon, authenticated;
alter function public.ingredient_image_aliases_touch_updated_at() set search_path = '';

commit;

notify pgrst, 'reload schema';

-- ============================================================================
-- Verification (run after push):
--   1. SEC-08 grants:
--        select grantee, privilege_type from information_schema.role_table_grants
--        where table_schema='public'
--          and table_name in ('revenuecat_events','stripe_webhook_events')
--          and grantee in ('anon','authenticated') order by table_name, grantee;
--        -- expect: SELECT only (no INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER).
--   2. SEC-09 throttle:
--        - household_join_throttle exists, RLS on, NO policies, anon/authenticated
--          hold nothing.
--        - 11 wrong-code calls within 60s from one account -> the 11th returns
--          {ok:false,error:'rate_limited'}; a valid join resets failed_count.
--   3. NEW-A:
--        select proname, proconfig,
--               has_function_privilege('anon', oid, 'execute')          as anon_exec,
--               has_function_privilege('authenticated', oid, 'execute') as auth_exec
--        from pg_proc where proname='ingredient_image_aliases_touch_updated_at';
--        -- expect proconfig {search_path=""}, anon_exec=false, auth_exec=false;
--        -- the BEFORE UPDATE trigger still fires (updated_at stays fresh).
-- ============================================================================
