-- ============================================================================
-- 20260721140000_eng1490_stripe_subscription_event_versions.sql
--
-- ENG-1490 finding #2 — Stripe webhook stale/out-of-order tier-clobber.
--
-- `src/lib/stripe/webhookProcess.ts` dedupes incoming webhooks purely on
-- `event.id` (T23, `stripe_webhook_events` — 20260503100700). That guards
-- against exact redelivery of the SAME event, but Stripe explicitly does
-- NOT guarantee delivery order
-- (https://stripe.com/docs/webhooks#event-ordering): a `customer.
-- subscription.*` event embeds a point-in-time snapshot of the
-- subscription as of when Stripe generated it, and a chronologically
-- OLDER-but-distinct event can be delivered AFTER a newer one (retry
-- backoff, network jitter, concurrent dispatch). Because
-- `updateProfileTierServiceRole` only floor-protects `lifetime_pro`, a
-- plain pro→free downgrade has no protection against a late-arriving
-- stale `active` snapshot re-granting Pro after the user was correctly
-- downgraded.
--
-- Fix: track the highest `event.created` (Stripe's Unix-seconds event
-- timestamp, not `received_at`/wall-clock) successfully applied per
-- Stripe subscription ID. Before applying a tier change from a
-- `customer.subscription.*` event, the handler compares the incoming
-- event's `created` against this table; older-than-last-applied events
-- are skipped (but still count as "processed" for T23 purposes — no
-- retry storm). This is a SEPARATE, additional guard alongside the
-- existing event.id dedup, not a replacement for it.
--
-- `checkout.session.completed` does NOT need this guard: it re-fetches
-- the subscription live via `stripe.subscriptions.retrieve` rather than
-- trusting the webhook payload's embedded snapshot, so it always reflects
-- Stripe's current truth at processing time.
--
-- Schema mirrors the existing `stripe_webhook_events` / ENG-1389
-- `household_join_throttle` idiom: service-role-only, RLS enabled with NO
-- client policies, write grants to anon/authenticated revoked up front
-- (rather than needing a follow-up hardening migration like
-- `stripe_webhook_events` did in 20260720090000).
--
-- Verified against live prod schema (read-only `execute_sql`, NOT
-- `apply_migration`) before writing this file — no pre-existing
-- subscription-version-tracking table or column exists on `profiles` or
-- elsewhere to reuse.
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration, per
-- CLAUDE.md — MCP rewrites schema_migrations.version to wall-clock NOW()
-- and drifts from this file's deliberately-ordered timestamp).
-- ============================================================================

set search_path = public;

create table if not exists public.stripe_subscription_event_versions (
  subscription_id text primary key,
  last_event_created timestamptz not null,
  last_event_id text,
  updated_at timestamptz not null default now()
);

alter table public.stripe_subscription_event_versions enable row level security;
revoke all on table public.stripe_subscription_event_versions from anon, authenticated;

comment on table public.stripe_subscription_event_versions is
  'ENG-1490 #2 (2026-07-21): highest Stripe event.created successfully applied per subscription_id, guarding customer.subscription.* handlers against stale-but-distinct out-of-order webhook redelivery clobbering a newer tier state. Additional to (not a replacement for) the event.id-based T23 dedup in stripe_webhook_events. Service-role-only; no client-facing RLS policies.';
comment on column public.stripe_subscription_event_versions.subscription_id is
  'Stripe subscription ID (sub_…). Primary key.';
comment on column public.stripe_subscription_event_versions.last_event_created is
  'The `event.created` timestamp (Stripe Unix-seconds event time, converted to timestamptz) of the most recent customer.subscription.* event whose tier decision was applied. A newly-arrived event with an older event.created than this is stale and must be skipped.';
comment on column public.stripe_subscription_event_versions.last_event_id is
  'Stripe event.id of the last-applied event, for debugging/audit only — not used in the staleness comparison.';
comment on column public.stripe_subscription_event_versions.updated_at is
  'Row last-write wall-clock time (distinct from last_event_created, which is Stripe''s event timestamp).';
