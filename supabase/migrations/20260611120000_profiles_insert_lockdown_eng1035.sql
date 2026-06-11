-- ENG-1035 / launch-readiness audit P0-1 — close the tier-escalation hole.
--
-- THE BUG (confirmed, conf 8): the `profiles_tier_column_lockdown` trigger
-- protects `user_tier` + `stripe_customer_id` from client UPDATEs, but it is
-- attached `BEFORE UPDATE` only (migrations 20260503100000 + the forward-compat
-- restate 20260503102000). The INSERT path is wide open:
--   * `profiles_insert_own` checks only identity (`WITH CHECK auth.uid() = id`),
--     with NO column restriction
--     (20260516150000_perf_rls_initplan_wrap_auth_calls.sql:221-222), and
--   * `profiles_delete_own` lets a user delete their own row
--     (20260419100001_profiles_delete_own.sql).
-- So any authenticated user can, straight from the client anon key:
--     DELETE FROM profiles WHERE id = auth.uid();
--     INSERT INTO profiles (id, user_tier) VALUES (auth.uid(), 'pro');
-- — granting themselves Pro for free, or associating an arbitrary
-- `stripe_customer_id` (re-opening the Customer-Portal hijack vector the
-- UPDATE lockdown was written to close). With the planned free founding
-- cohort layered on top, the same hole lets anyone forge `lifetime_pro`
-- (see docs/ux/research/2026-06-11-launch-monetisation-sequencing.md §4) —
-- which is why this is the #1 free-launch gate, not merely a paywall dodge.
--
-- WHY THE UPDATE FUNCTION CANNOT BE REUSED FOR INSERT:
-- on INSERT, `OLD` is NULL, so every `new.col IS DISTINCT FROM old.col` check
-- fires for any non-null value — including the DEFAULT 'free'. Brand-new
-- signups rely on the INSERT path NOT firing the trigger (the 2026-05-25
-- write-failure doc, line 57: "the BEFORE-UPDATE trigger does not fire on
-- INSERT" — that is exactly what lets a default-row signup succeed). So the
-- INSERT guard must compare against the ALLOWED DEFAULTS ('free' /
-- NULL stripe_customer_id), not against OLD.
--
-- THE FIX: a dedicated BEFORE INSERT trigger that rejects any non-service_role
-- INSERT where the inserted `user_tier` is anything other than 'free', or where
-- `stripe_customer_id` is non-null. It runs the SAME forward-compat jsonb loop
-- as the UPDATE path so any future billing column lands locked on INSERT too
-- (a non-null/non-default value of a forward-banned column is rejected).
--
-- Service-role writers (Stripe webhook, RevenueCat webhook, the SECURITY
-- DEFINER `redeem_promo_code` — see the paired migration
-- 20260611120200_redeem_promo_lifetime_pro_eng1043.sql) bypass via the same
-- `auth.role() = 'service_role'` check the UPDATE function uses, so the comp /
-- webhook tier grants are unaffected.
--
-- FORWARD-ONLY SAFE: adds a function + a BEFORE INSERT trigger; touches no data,
-- no column, no existing policy or trigger.
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration — MCP rewrites
-- schema_migrations.version to NOW(), drifting from the future-dated filename
-- prefix used for monotonic ordering).

set search_path = public;

-- Trigger function: reject client-side INSERTs that set a privileged tier or
-- pre-associate a billing identity. Mirrors the UPDATE lockdown's role bypass
-- and forward-compat fallback, but compares against the allowed INSERT defaults
-- rather than OLD (which is NULL on INSERT).
create or replace function public.profiles_tier_column_insert_lockdown()
returns trigger
language plpgsql
security invoker
as $$
declare
  -- Same forward-banned set as the UPDATE lockdown
  -- (20260503102000_profiles_lockdown_forward_compat.sql). If any of these
  -- columns is added to public.profiles later, a client INSERT that sets it to
  -- a non-null value is rejected here too. Keep this array in lockstep with the
  -- UPDATE function's `forward_banned` (pinned by
  -- tests/unit/profilesInsertLockdown.test.ts).
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
  -- Service-role writers (Stripe / RevenueCat webhooks, SECURITY DEFINER
  -- redeem_promo_code running as service_role) bypass entirely. anon /
  -- authenticated JWTs fall through to the guards below.
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- `user_tier` may only ever be the free default on a client INSERT. Any other
  -- value (pro, base, lifetime_pro, …) must come from a server-side writer.
  -- NULL is allowed because the column DEFAULT 'free' fills it post-trigger;
  -- comparing the explicit value catches `... (id, user_tier) VALUES (uid,'pro')`.
  if new.user_tier is not null and new.user_tier is distinct from 'free' then
    raise exception 'profiles.user_tier may only be inserted as ''free'' from the client (ENG-1035: tier column lockdown — INSERT). Paid tiers must come through the server-side Stripe / RevenueCat webhooks or the promo RPC.'
      using errcode = '42501';
  end if;

  -- A client must never pre-set a Stripe customer association on INSERT.
  if new.stripe_customer_id is not null then
    raise exception 'profiles.stripe_customer_id is not client-writable (ENG-1035: tier column lockdown — INSERT).'
      using errcode = '42501';
  end if;

  -- Forward-compat fallback: any future billing column set to a non-null value
  -- by a client INSERT is rejected. Service-role already returned above.
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

drop trigger if exists profiles_tier_column_insert_lockdown_trg on public.profiles;

create trigger profiles_tier_column_insert_lockdown_trg
before insert on public.profiles
for each row
execute function public.profiles_tier_column_insert_lockdown();

comment on function public.profiles_tier_column_insert_lockdown is
  'ENG-1035 (launch-readiness audit P0-1, 2026-06-11): rejects client-side INSERT of profiles.user_tier != ''free'' or non-null stripe_customer_id (closes the DELETE-then-INSERT tier-escalation bypass left open because the UPDATE lockdown does not fire on INSERT). Service-role writers bypass via auth.role(). Brand-new default-row signups still succeed. Mirrors the forward-compat jsonb loop of profiles_tier_column_lockdown. See supabase/migrations/20260611120000_profiles_insert_lockdown_eng1035.sql + docs/decisions/2026-06-11-gate0-db-security.md.';

comment on trigger profiles_tier_column_insert_lockdown_trg on public.profiles is
  'Blocks tier + billing column escalation via row re-INSERT from anon / authenticated JWT (ENG-1035 / audit P0-1). Pairs with profiles_tier_column_lockdown_trg (BEFORE UPDATE).';
