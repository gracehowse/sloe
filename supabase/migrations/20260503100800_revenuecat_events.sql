-- T6 — full-sweep 2026-04-24 Phase 2 condition.
--
-- Closes audit §A2 (security #2 / integration-manager #4 / monetisation
-- #2 / docs-keeper #2 / product-memory #4): mobile cancellations,
-- refunds, billing-issue holds, and grace-period transitions never
-- reach Supabase. The `syncTierToSupabase` client path is the only
-- writer of `profiles.user_tier` from mobile, and `resolveNextTier`'s
-- downgrade-blocked guard explicitly refuses to write a tier
-- downgrade from the client. Net effect: a Pro user who cancels on
-- their device retains Pro entitlement in Supabase indefinitely
-- (until they re-launch on a fresh install). Refund-after-cancel ⇒
-- free Pro forever.
--
-- Fix: a server-side webhook endpoint that RevenueCat POSTs to on
-- every billing event. The endpoint verifies the bearer secret,
-- INSERTs the event into `revenuecat_events` (idempotent on event_id),
-- then dispatches by event type to update `profiles.user_tier` via
-- service role — bypasses the client downgrade guard because it's
-- the authoritative source-of-truth path.
--
-- Same primitive as `stripe_webhook_events` (T23) — INSERT-then-process
-- with 23505 = already-handled. RC delivers events at-least-once.
--
-- Schema:
--   event_id    — RC event UUID. Primary key for dedup.
--   event_type  — INITIAL_PURCHASE / RENEWAL / CANCELLATION /
--                 EXPIRATION / PRODUCT_CHANGE / BILLING_ISSUE /
--                 UNCANCELLATION / NON_RENEWING_PURCHASE / TRANSFER /
--                 SUBSCRIPTION_PAUSED / TEMPORARY_ENTITLEMENT_GRANT.
--   app_user_id — the value the mobile client sets via
--                 `Purchases.logIn(userId)`. In Suppr that's the
--                 Supabase auth uuid as a string. Stored separately
--                 from `user_id` so we can audit unmapped events.
--   user_id     — resolved at INSERT time when app_user_id parses as
--                 a uuid. Null when the event references an anonymous
--                 RC id we can't map (logged + ignored).
--   payload     — full event body for forensic replay. Keeps the door
--                 open for the "reducer" pattern from the 2026-04-24
--                 Phase 2 architecture decision if/when we need to
--                 recompute tier deterministically.
--
-- RLS enabled with NO public policies — service-role only, same as
-- stripe_webhook_events. Clients must never read or write this table.
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration).

set search_path = public;

create table if not exists public.revenuecat_events (
  event_id text primary key,
  event_type text not null,
  app_user_id text not null,
  user_id uuid,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create index if not exists revenuecat_events_user_id_idx
  on public.revenuecat_events (user_id) where user_id is not null;

create index if not exists revenuecat_events_received_at_idx
  on public.revenuecat_events (received_at);

alter table public.revenuecat_events enable row level security;

comment on table public.revenuecat_events is
  'T6 (2026-04-24): persisted RevenueCat webhook events. INSERT-then-process pattern; duplicate-key (23505) = already handled. No client-facing RLS policies — service-role only. Sister table to stripe_webhook_events (T23, same primitive).';
comment on column public.revenuecat_events.event_id is 'RevenueCat event UUID (event.id). Primary key for idempotency.';
comment on column public.revenuecat_events.event_type is 'RC event type: INITIAL_PURCHASE / RENEWAL / CANCELLATION / EXPIRATION / PRODUCT_CHANGE / BILLING_ISSUE / etc.';
comment on column public.revenuecat_events.app_user_id is 'Whatever the mobile client passed to Purchases.logIn(). In Suppr that''s the Supabase auth uuid as text.';
comment on column public.revenuecat_events.user_id is 'Resolved Supabase auth uuid when app_user_id parses as one; null for anonymous-only RC ids.';
comment on column public.revenuecat_events.payload is 'Full event body for forensic replay. Keeps "reducer over events" architecture viable if needed.';
