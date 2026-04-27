-- P0-4 (2026-04-25) — forward-compatibility hardening for the profiles
-- column lockdown trigger.
--
-- Context: the 2026-04-24 full-sweep verdict (T2) listed `subscription_status`,
-- `trial_started_at`, `trial_ends_at`, and `trial_days_given` as columns that
-- "must be locked down". The Opus-4.7 P0-4 audit took that at face value and
-- reported them as currently client-writable. Verification on 2026-04-25
-- confirms those columns DO NOT EXIST on `public.profiles` today and are not
-- written by any current Stripe or RevenueCat webhook path. The existing
-- trigger function (`profiles_tier_column_lockdown`, migration
-- 20260503100000) correctly covers every billing-sensitive column that
-- exists today: `user_tier`, `stripe_customer_id`.
--
-- This migration does NOT add a schema change. It re-creates the trigger
-- function with an enriched comment block enumerating the forward-banned
-- column names, so the next maintainer who adds `subscription_status`,
-- `trial_started_at`, `trial_ends_at`, `trial_days_given`, or any future
-- billing/entitlement column to `public.profiles` is forced to also add a
-- guard branch here. The same migration also raises a noticeable error
-- message at INSERT/UPDATE if anyone manages to write one of the
-- forward-banned column names by hand (e.g. via `to_jsonb(NEW) ? <name>`),
-- so the failure mode at runtime is loud rather than silent.
--
-- This is a comment + defensive runtime check only. No data is modified.
-- Apply via `supabase db push --linked` (NOT MCP apply_migration).
--
-- Policy reference: docs/decisions/2026-04-25-profiles-lockdown-forward-compat.md.

set search_path = public;

create or replace function public.profiles_tier_column_lockdown()
returns trigger
language plpgsql
security invoker
as $$
declare
  -- Forward-banned column names. If any of these appear on
  -- `public.profiles` in a future migration, the maintainer MUST add an
  -- explicit `if new.<col> is distinct from old.<col>` guard above and
  -- remove the column from this list. The runtime check below is a
  -- belt-and-braces fallback in case that update is forgotten.
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
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- Existing locked columns.
  if new.user_tier is distinct from old.user_tier then
    raise exception 'profiles.user_tier is not client-writable (T2: tier column lockdown). Tier changes must go through the server-side Stripe or RevenueCat webhooks.'
      using errcode = '42501';
  end if;

  if new.stripe_customer_id is distinct from old.stripe_customer_id then
    raise exception 'profiles.stripe_customer_id is not client-writable (T2: tier column lockdown).'
      using errcode = '42501';
  end if;

  -- Forward-compat fallback: if any future billing column lands on the
  -- table without being added to the explicit guards above, this loop
  -- catches a client-side mutation by comparing jsonb projections.
  -- Service-role calls already returned at the top; only anon /
  -- authenticated callers reach here.
  new_row := to_jsonb(new);
  old_row := to_jsonb(old);
  foreach banned in array forward_banned loop
    -- Only enforce when the column actually exists on the row payload.
    -- (jsonb '?' returns true when the key is present.)
    if new_row ? banned and (new_row -> banned) is distinct from (old_row -> banned) then
      raise exception 'profiles.% is not client-writable (P0-4: forward-compat billing-column lockdown). Add an explicit guard branch in profiles_tier_column_lockdown when this column is introduced.', banned
        using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$$;

comment on function public.profiles_tier_column_lockdown is
  'T2 + P0-4 (2026-04-25): rejects client-side UPDATE of profiles billing columns. Today blocks user_tier + stripe_customer_id explicitly. Forward-banned column names (subscription_status, trial_started_at, trial_ends_at, trial_days_given, billing_period_*, paid_through_at) are caught by the jsonb fallback if they are added to the table later without an explicit guard branch. Service-role writers bypass via auth.role() check. See docs/decisions/2026-04-25-profiles-lockdown-forward-compat.md.';
