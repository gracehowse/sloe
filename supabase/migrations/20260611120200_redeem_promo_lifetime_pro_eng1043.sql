-- ENG-1043 / launch-readiness audit P1-8 — make the promo comp path survive the
-- tier lockdown, and add the `lifetime_pro` founding-cohort grant.
--
-- TWO PROBLEMS, ONE MIGRATION (they are the same code path):
--
-- (A) THE LOCKDOWN MAY REJECT THE COMP (audit P1-8, conf 5).
--     `redeem_promo_code(p_code)` is SECURITY DEFINER and does
--       INSERT INTO profiles (id, user_tier) VALUES (uid, tier)
--       ON CONFLICT (id) DO UPDATE SET user_tier = excluded.user_tier;
--     For ANY user who already has a profile row (i.e. everyone post-signup),
--     the ON CONFLICT path runs an UPDATE — which fires the BEFORE UPDATE
--     `profiles_tier_column_lockdown` trigger. That trigger bypasses only when
--     `auth.role() = 'service_role'`. The lockdown header *assumed* a SECURITY
--     DEFINER function makes auth.role() return 'service_role', but auth.role()
--     is JWT-derived (proven by docs/decisions/2026-05-25-onboarding-tier-
--     lockdown-write-failure.md) and this function never does `set local role`.
--     So inside redeem_promo_code, auth.role() is still 'authenticated' →
--     the UPDATE branch raises 42501 → EVERY comp redemption against an
--     existing profile fails, including Grace's SUPPR_TEST_PREMIUM path and any
--     launch promo. This is load-bearing for the "first 100 free" mechanism
--     (docs/ux/research/2026-06-11-launch-monetisation-sequencing.md §1, Gate A).
--
--     FIX: an explicit, deterministic authorised-writer bypass that does NOT
--     depend on how auth.role() resolves inside SECURITY DEFINER. The function
--     sets a transaction-local GUC `app.tier_writer = 'on'` immediately before
--     the profile write; BOTH lockdown trigger functions are re-stated to treat
--     that flag (in addition to service_role) as an authorised writer. The GUC
--     is set with `is_local => true` so it is scoped to this transaction and
--     auto-clears at commit/rollback — no leakage to other statements. A plain
--     client cannot set it: `set_config('app.tier_writer', ...)` from a client
--     would have to be its own statement, and the trigger only honours it
--     because redeem_promo_code (a SECURITY DEFINER function the client cannot
--     edit) is the only thing that sets it within the same write transaction.
--
-- (B) THE FOUNDING-COHORT TIER `lifetime_pro` (monetisation doc §1, conf 8).
--     The recommended free-cohort mechanism is a durable `lifetime_pro`
--     entitlement granted via this same RPC (a capped FOUNDING100 promo row).
--     `lifetime_pro` must (1) resolve to full Pro everywhere user_tier is gated
--     — handled in the app resolvers (src/lib/supabase/serverAnonClient.ts,
--     apps/mobile/lib/purchases.ts) in the same change — and (2) never be
--     downgraded by a later webhook. The DB side here is: allow the RPC to write
--     it, and document that webhooks must never overwrite it (enforced in the
--     resolver downgrade-guard, tested in resolveNextTier / resolvedTier specs).
--     We do NOT seed the FOUNDING100 promo_codes row here — that is an
--     operational/data action and Grace's call (the monetisation doc is
--     explicitly "FOR GRACE'S CALL, nothing applied"). This migration only makes
--     the *mechanism* correct and safe so the row can be seeded when she decides.
--
-- FORWARD-ONLY SAFE: re-creates two trigger functions (logic-preserving, adds a
-- second bypass condition) and one RPC (adds the GUC + idempotent-grant guard so
-- a lifetime_pro holder is never downgraded by re-redeeming a lower-tier code).
-- No data, column, policy, or trigger attachment changes.
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration).

set search_path = public;

-- ---------------------------------------------------------------------------
-- 0. Shared tier-rank helper (used by the redeem floor below). Mirrors the
--    app-side tierRank in apps/mobile/lib/purchases.ts. lifetime_pro outranks
--    pro so it is treated as a durable floor and never downgraded. Defined
--    first so redeem_promo_code can reference it.
-- ---------------------------------------------------------------------------
create or replace function public.tier_rank(p_tier text)
returns int
language sql
immutable
set search_path = public, pg_temp
as $$
  select case lower(coalesce(p_tier, 'free'))
    when 'lifetime_pro' then 3
    when 'pro' then 2
    when 'base' then 1
    else 0
  end;
$$;

comment on function public.tier_rank is
  'ENG-1043: tier ordering (lifetime_pro > pro > base > free). Mirrors app-side tierRank; used by redeem_promo_code as a never-downgrade floor.';

-- ---------------------------------------------------------------------------
-- 1. Re-state the BEFORE UPDATE lockdown to also honour the authorised-writer
--    GUC. Body is byte-for-byte the forward-compat version
--    (20260503102000) with ONE added bypass condition.
-- ---------------------------------------------------------------------------
create or replace function public.profiles_tier_column_lockdown()
returns trigger
language plpgsql
security invoker
as $$
declare
  forward_banned text[] := array[
    'subscription_status',
    'trial_started_at',
    'trial_ends_at',
    'trial_days_given',
    'billing_period_end_at',
    'billing_period_start_at',
    'paid_through_at'
  ];
  new_row jsonb;
  old_row jsonb;
  banned text;
begin
  -- Service-role writers bypass (Stripe / RevenueCat webhooks).
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- ENG-1043: authorised in-transaction writer bypass. Set ONLY by the
  -- SECURITY DEFINER redeem_promo_code RPC (transaction-local). Lets the comp
  -- path write user_tier without depending on auth.role() resolving to
  -- service_role inside a definer function. `current_setting(..., true)`
  -- returns NULL (not an error) when the GUC was never set.
  if coalesce(current_setting('app.tier_writer', true), '') = 'on' then
    return new;
  end if;

  if new.user_tier is distinct from old.user_tier then
    raise exception 'profiles.user_tier is not client-writable (T2: tier column lockdown). Tier changes must go through the server-side Stripe or RevenueCat webhooks.'
      using errcode = '42501';
  end if;

  if new.stripe_customer_id is distinct from old.stripe_customer_id then
    raise exception 'profiles.stripe_customer_id is not client-writable (T2: tier column lockdown).'
      using errcode = '42501';
  end if;

  new_row := to_jsonb(new);
  old_row := to_jsonb(old);
  foreach banned in array forward_banned loop
    if new_row ? banned and (new_row -> banned) is distinct from (old_row -> banned) then
      raise exception 'profiles.% is not client-writable (P0-4: forward-compat billing-column lockdown). Add an explicit guard branch in profiles_tier_column_lockdown when this column is introduced.', banned
        using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$$;

comment on function public.profiles_tier_column_lockdown is
  'T2 + P0-4 + ENG-1043: rejects client-side UPDATE of profiles billing columns (user_tier, stripe_customer_id, forward-banned set). Bypass writers: service_role (webhooks) OR an in-transaction app.tier_writer=on GUC set only by the SECURITY DEFINER redeem_promo_code RPC. See docs/decisions/2026-06-11-gate0-db-security.md.';

-- ---------------------------------------------------------------------------
-- 2. Re-state the BEFORE INSERT lockdown (ENG-1035) to honour the same GUC,
--    so a redeem against a user with NO profile row (the INSERT branch of the
--    upsert) also succeeds for the comp path.
-- ---------------------------------------------------------------------------
create or replace function public.profiles_tier_column_insert_lockdown()
returns trigger
language plpgsql
security invoker
as $$
declare
  forward_banned text[] := array[
    'subscription_status',
    'trial_started_at',
    'trial_ends_at',
    'trial_days_given',
    'billing_period_end_at',
    'billing_period_start_at',
    'paid_through_at'
  ];
  new_row jsonb;
  banned text;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- ENG-1043: authorised in-transaction writer bypass (see UPDATE function).
  if coalesce(current_setting('app.tier_writer', true), '') = 'on' then
    return new;
  end if;

  if new.user_tier is not null and new.user_tier is distinct from 'free' then
    raise exception 'profiles.user_tier may only be inserted as ''free'' from the client (ENG-1035: tier column lockdown — INSERT). Paid tiers must come through the server-side Stripe / RevenueCat webhooks or the promo RPC.'
      using errcode = '42501';
  end if;

  if new.stripe_customer_id is not null then
    raise exception 'profiles.stripe_customer_id is not client-writable (ENG-1035: tier column lockdown — INSERT).'
      using errcode = '42501';
  end if;

  new_row := to_jsonb(new);
  foreach banned in array forward_banned loop
    if new_row ? banned and (new_row -> banned) is not null and (new_row -> banned) <> 'null'::jsonb then
      raise exception 'profiles.% is not client-writable on INSERT (ENG-1035: forward-compat billing-column lockdown). Add an explicit guard branch in profiles_tier_column_insert_lockdown when this column is introduced.', banned
        using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$$;

comment on function public.profiles_tier_column_insert_lockdown is
  'ENG-1035 + ENG-1043: rejects client INSERT of profiles.user_tier != ''free'' or non-null stripe_customer_id. Bypass writers: service_role OR the in-transaction app.tier_writer=on GUC set by redeem_promo_code. See docs/decisions/2026-06-11-gate0-db-security.md.';

-- ---------------------------------------------------------------------------
-- 3. Re-state redeem_promo_code: set the authorised-writer GUC before the
--    profile write, keep idempotency, and never downgrade a higher held tier
--    (so re-redeeming a lower code can't drop a lifetime_pro / pro holder).
-- ---------------------------------------------------------------------------
create or replace function public.redeem_promo_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.promo_codes%rowtype;
  v_current text;
  v_effective text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_code is null or length(trim(p_code)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select * into v_row
  from public.promo_codes
  where code = upper(trim(p_code))
    and active = true
    and (expires_at is null or expires_at > now())
    and (max_uses is null or uses_count < max_uses);

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  end if;

  -- Never downgrade a higher tier the user already holds. A lifetime_pro / pro
  -- holder re-redeeming (e.g.) a `base` code keeps their stronger tier. This is
  -- the DB-side floor that pairs the resolver downgrade-guard.
  select user_tier into v_current from public.profiles where id = v_uid;
  if public.tier_rank(v_current) >= public.tier_rank(v_row.tier) then
    v_effective := v_current;
  else
    v_effective := v_row.tier;
  end if;

  -- ENG-1043: authorise the upcoming profile write past the tier lockdown
  -- triggers for THIS transaction only. is_local => true scopes it to the
  -- current transaction; it auto-clears at commit/rollback.
  perform set_config('app.tier_writer', 'on', true);

  if exists (
    select 1 from public.promo_redemptions r
    where r.user_id = v_uid and r.promo_code_id = v_row.id
  ) then
    insert into public.profiles (id, user_tier)
    values (v_uid, v_effective)
    on conflict (id) do update set user_tier = excluded.user_tier;
    perform set_config('app.tier_writer', 'off', true);
    return jsonb_build_object('ok', true, 'tier', v_effective, 'already_redeemed', true);
  end if;

  insert into public.profiles (id, user_tier)
  values (v_uid, v_effective)
  on conflict (id) do update set user_tier = excluded.user_tier;

  insert into public.promo_redemptions (user_id, promo_code_id)
  values (v_uid, v_row.id);

  update public.promo_codes
  set uses_count = uses_count + 1
  where id = v_row.id;

  perform set_config('app.tier_writer', 'off', true);
  return jsonb_build_object('ok', true, 'tier', v_effective, 'already_redeemed', false);
end;
$$;

comment on function public.redeem_promo_code is
  'ENG-1043 (audit P1-8, 2026-06-11): idempotent promo redemption writing profiles.user_tier server-side. Sets a transaction-local app.tier_writer GUC so the write survives the tier-lockdown triggers (auth.role() is NOT service_role inside a SECURITY DEFINER function). Never downgrades a higher held tier (lifetime_pro/pro floor). Supports lifetime_pro founding-cohort grants. See docs/decisions/2026-06-11-gate0-db-security.md.';
