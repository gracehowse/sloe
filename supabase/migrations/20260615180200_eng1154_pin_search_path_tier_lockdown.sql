-- ENG-1154: pin search_path on the Gate-0 profiles tier-lockdown trigger functions.
--
-- Apply path: stage this migration and have Grace run `supabase db push --linked`.
-- Do NOT apply committed migrations through Supabase MCP `apply_migration` or the
-- Dashboard "Save as migration" flow; those rewrite schema_migrations.version to
-- wall-clock time and drift from file timestamps.
--
-- This migration intentionally does not drop/recreate triggers. CREATE OR REPLACE
-- FUNCTION keeps the existing profiles_tier_column_lockdown_trg and
-- profiles_tier_column_insert_lockdown_trg bindings intact while adding the
-- immutable search_path clause required by the Supabase security advisor.

create or replace function public.profiles_tier_column_lockdown()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
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
  'T2 + P0-4 + ENG-1043: rejects client-side UPDATE of profiles billing columns (user_tier, stripe_customer_id, forward-banned set). Bypass writers: service_role (webhooks) OR an in-transaction app.tier_writer=on GUC set only by the SECURITY DEFINER redeem_promo_code RPC. See docs/decisions/2026-06-11-gate0-db-security.md. + search_path pinned (ENG-1154)';

create or replace function public.profiles_tier_column_insert_lockdown()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
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
  'ENG-1035 + ENG-1043: rejects client INSERT of profiles.user_tier != ''free'' or non-null stripe_customer_id. Bypass writers: service_role OR the in-transaction app.tier_writer=on GUC set by redeem_promo_code. See docs/decisions/2026-06-11-gate0-db-security.md. + search_path pinned (ENG-1154)';

notify pgrst, 'reload schema';
