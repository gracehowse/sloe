-- Web Push subscriptions — server-side fan-out of browser pushes.
--
-- Owner: notifications / cron (weekly-recap). Mirror of the mobile
-- `profiles.expo_push_token` pattern but as a child table because the
-- Web Push contract is endpoint-scoped: a user can have several
-- browsers on several devices subscribed at once, each with a distinct
-- endpoint + key pair. `upsert` on `endpoint` refreshes the row for a
-- returning browser; we never orphan-copy.
--
-- RLS: only the owning user can read their own subscription rows
-- (useful for debugging / "sign me out of all browsers" flows); only
-- authenticated users can insert/update rows for themselves; the cron
-- uses the service-role client to fan out, which bypasses RLS by
-- design. No SELECT exposure beyond the owner.
--
-- Column notes:
--   endpoint  — the push service URL returned by PushManager.subscribe.
--               Primary uniqueness key — two subscriptions with the
--               same endpoint are logically the same browser.
--   p256dh    — the user's public key for payload encryption (ECDH
--               P-256). Required by Web Push Protocol.
--   auth      — the auth secret for payload encryption. Required.
--   user_agent — captured so the UI can later render a "revoke this
--               device" list without prompting the user again.
--   last_seen_at — bumped on every re-subscribe from the same browser
--                 so the cron can drop rows that haven't been seen in
--                 months (stale / wiped browsers).
--   created_at  — audit trail.

create table if not exists public.web_push_subscriptions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- One row per endpoint — re-subscribes from the same browser refresh
-- the existing row rather than duplicate.
create unique index if not exists web_push_subscriptions_endpoint_key
  on public.web_push_subscriptions (endpoint);

create index if not exists web_push_subscriptions_user_id_idx
  on public.web_push_subscriptions (user_id);

alter table public.web_push_subscriptions enable row level security;

-- Owner read.
create policy "web_push_subscriptions_owner_select"
  on public.web_push_subscriptions
  for select
  using (auth.uid() = user_id);

-- Owner insert (upsert path from the client helper).
create policy "web_push_subscriptions_owner_insert"
  on public.web_push_subscriptions
  for insert
  with check (auth.uid() = user_id);

-- Owner update (for `last_seen_at` bump on re-subscribe).
create policy "web_push_subscriptions_owner_update"
  on public.web_push_subscriptions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Owner delete (for unsubscribe from the client, and user-initiated
-- "revoke this device" flows later).
create policy "web_push_subscriptions_owner_delete"
  on public.web_push_subscriptions
  for delete
  using (auth.uid() = user_id);

-- Server-side cron / admin writes bypass RLS via the service-role key
-- (policies above are for authenticated client callers only). The
-- weekly-recap cron uses `getSupabaseAdminClient` which is already
-- privileged — no extra policy needed.

comment on table public.web_push_subscriptions is
  'Browser Web Push subscriptions — one row per endpoint. Consumed by server-side fan-out in /api/push/weekly-recap and any future push route.';
comment on column public.web_push_subscriptions.endpoint is
  'Unique push service endpoint URL returned by PushManager.subscribe.';
comment on column public.web_push_subscriptions.p256dh is
  'Subscriber public key for payload encryption (ECDH P-256, base64url).';
comment on column public.web_push_subscriptions.auth is
  'Subscriber auth secret for payload encryption (base64url).';
comment on column public.web_push_subscriptions.last_seen_at is
  'Bumped on every re-subscribe from the same browser. Cron can delete rows not seen in > 60 days.';
