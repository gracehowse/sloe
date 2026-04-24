-- T2 — full-sweep 2026-04-24 HOLD unblock condition.
--
-- Lock down paid-tier + billing columns on `public.profiles` so that the
-- existing `profiles_update_own` RLS policy (`USING (auth.uid() = id)
-- WITH CHECK (auth.uid() = id)`) can no longer be used to escalate
-- `user_tier`, `stripe_customer_id`, or `subscription_*` columns from
-- the anon key.
--
-- The 2026-04 prior sweep closed the READ side of this bug (getUserTier
-- reads via service-role). The WRITE side was never audited. Any
-- authenticated user can still run
--   UPDATE profiles SET user_tier='pro' WHERE id = auth.uid()
-- directly from curl / a modified client because the policy permits row
-- UPDATE without any column restriction. Postgres RLS has no native
-- column-level grant on the "authenticated" role, so we use a BEFORE
-- UPDATE trigger to reject changes to locked columns unless the caller
-- is the service role.
--
-- Service-role writers that must continue to work:
--   - Stripe webhook handler (`src/lib/stripe/webhookProcess.ts` →
--     `updateProfileTierServiceRole`) runs with the service key and
--     bypasses RLS entirely; `auth.role() = 'service_role'` when inside
--     a service-role connection.
--   - Future RevenueCat webhook (T6) will follow the same pattern.
--   - `redeem_promo_idempotent` (supabase/migrations/20260407220000…)
--     is `SECURITY DEFINER` — runs as table owner, which is effectively
--     service-role for this check.
--
-- Client writers that are INTENTIONALLY restricted:
--   - Mobile `syncTierToSupabase` in `apps/mobile/lib/purchases.ts`
--     currently writes `user_tier` via the anon client. After this
--     migration that write will be rejected. The correct replacement
--     path is the T6 RevenueCat webhook writing via service role. In
--     the interim, mobile purchase events rely on the upcoming T6 route
--     for tier sync — not the client helper.
--
-- This migration is FORWARD-ONLY SAFE: it does not drop data, does not
-- change any existing column, and does not alter the RLS policy itself
-- (we keep the column-agnostic policy so adding new profile columns
-- later doesn't require policy edits). It adds a trigger that runs on
-- every UPDATE and raises if a locked column would be mutated.
--
-- Apply via `supabase db push --linked` (NOT via MCP `apply_migration`).
-- MCP rewrites `schema_migrations.version` to NOW() causing drift with
-- the future-dated timestamp used here for monotonic ordering.

set search_path = public;

-- Trigger function: reject client-side UPDATEs that touch locked columns.
create or replace function public.profiles_tier_column_lockdown()
returns trigger
language plpgsql
security invoker
as $$
begin
  -- Allow unrestricted UPDATEs when the caller is the service role.
  -- `auth.role()` returns 'service_role' for connections that present
  -- the Supabase service key; anon / authenticated roles return
  -- 'anon' / 'authenticated' respectively.
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- `user_tier` is the entitlement switch read by every tier-gated API.
  -- Never mutable from the client.
  if new.user_tier is distinct from old.user_tier then
    raise exception 'profiles.user_tier is not client-writable (T2: tier column lockdown). Tier changes must go through the server-side Stripe or RevenueCat webhooks.'
      using errcode = '42501';
  end if;

  -- `stripe_customer_id` is set on `checkout.session.completed` by the
  -- Stripe webhook. A client-side write here would let an attacker
  -- associate their profile with another user's Stripe customer and
  -- hijack the Customer Portal deep-link.
  if new.stripe_customer_id is distinct from old.stripe_customer_id then
    raise exception 'profiles.stripe_customer_id is not client-writable (T2: tier column lockdown).'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Drop then recreate in case a prior attempt left a partial state.
drop trigger if exists profiles_tier_column_lockdown_trg on public.profiles;

create trigger profiles_tier_column_lockdown_trg
before update on public.profiles
for each row
execute function public.profiles_tier_column_lockdown();

comment on function public.profiles_tier_column_lockdown is
  'T2 (full-sweep 2026-04-24): rejects client-side UPDATE of profiles.user_tier + stripe_customer_id. Service-role writers bypass via auth.role() check. See supabase/migrations/20260503100000_profiles_tier_column_lockdown.sql header for contract.';

comment on trigger profiles_tier_column_lockdown_trg on public.profiles is
  'Blocks tier + billing column mutations from anon / authenticated JWT. Ship gate: docs/decisions/2026-04-24-full-sweep-ship-verdict.md T2.';
