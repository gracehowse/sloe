-- ENG-1490 finding #3: track first-trial timestamp per user to stop the
-- 7-day Pro trial from being farmable via repeat checkout (Checkout mints a
-- fresh Stripe Customer each time, so there was no prior-trial-eligibility
-- check at all).
--
-- Apply path: stage this migration and have Grace run `supabase db push
-- --linked`. Do NOT apply committed migrations through Supabase MCP
-- `apply_migration` or the Dashboard "Save as migration" flow; those rewrite
-- schema_migrations.version to wall-clock time and drift from file
-- timestamps.
--
-- `trial_started_at` is already forward-compat-protected as client-non-
-- writable by the profiles_tier_column_lockdown / _insert_lockdown trigger
-- functions' `forward_banned` array (see
-- supabase/migrations/20260503102000_profiles_lockdown_forward_compat.sql,
-- carried forward through the ENG-1154 search_path pin). Adding the column
-- here is sufficient — the existing jsonb-fallback guard in both trigger
-- functions picks it up automatically; no trigger changes needed.

alter table public.profiles
  add column if not exists trial_started_at timestamptz;

comment on column public.profiles.trial_started_at is
  'ENG-1490: set once, server-side only (Stripe webhook), the first time a subscription for this user is observed in `trialing` status. Never overwritten (WHERE trial_started_at IS NULL guard in webhookProcess.ts). Checked by app/api/stripe/checkout/route.ts to withhold trial_period_days on any subsequent checkout, regardless of how many Stripe Customer objects the user has since minted.';

notify pgrst, 'reload schema';
