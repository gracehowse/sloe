-- T23 — full-sweep 2026-04-24 Phase 3 condition.
--
-- Closes audit §A6 (security #6 / integration-manager #2): the current
-- Stripe webhook deduplication is an in-memory `Set<string>` at module
-- scope (src/lib/stripe/webhookProcess.ts L95). On Vercel:
--   * Cold starts produce a fresh empty Set.
--   * Concurrent function instances each have their own Set.
--   * Stripe retries unacknowledged events for up to 72 hours.
-- So the same event.id can be re-processed across function lifetimes
-- with no record. Currently benign because tier writes are idempotent
-- (`SET tier = X`, not `+= 1`), but one un-idempotent handler away
-- from a real bug — and we want the same primitive in place when the
-- T6 RevenueCat webhook lands so dedup is uniform.
--
-- Fix: a small persistence table the webhook handler INSERTs into
-- before processing. Duplicate-key (23505) means "already processed,
-- skip handler"; any other error → log + process (fail-safe matches
-- current behaviour on fault).
--
-- Schema: just `event_id` as PK + `received_at` for retention pruning.
-- We don't store the event payload — that's still in Stripe's record.
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration).

set search_path = public;

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  received_at timestamptz not null default now()
);

-- Retention: Stripe stops retrying after 72 hours, so anything older
-- than ~7 days is safe to prune. The index supports that future cron.
create index if not exists stripe_webhook_events_received_at_idx
  on public.stripe_webhook_events (received_at);

-- RLS: only service-role writes / reads this. We deliberately add NO
-- policies for `authenticated` or `anon` so a JWT-bearing client
-- cannot probe whether a given event was processed (very minor info
-- leak on its own, but unnecessary surface). Service-role bypasses
-- RLS entirely.
alter table public.stripe_webhook_events enable row level security;

comment on table public.stripe_webhook_events is
  'T23 (2026-04-24): persisted Stripe webhook deduplication. INSERT-then-process pattern; duplicate-key (23505) = already handled. No client-facing RLS policies — service-role-only. Same primitive will back the T6 RevenueCat webhook.';
comment on column public.stripe_webhook_events.event_id is
  'Stripe event.id (e.g. evt_1Nq…). Primary key.';
comment on column public.stripe_webhook_events.received_at is
  'When the row was first inserted. Future cron prunes rows older than 7 days (Stripe retries cap at 72h).';
