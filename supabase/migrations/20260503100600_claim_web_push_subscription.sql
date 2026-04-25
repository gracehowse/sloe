-- T21 — full-sweep 2026-04-24 Phase 3 condition.
--
-- Closes data-integrity §3 / security §5 (audit 2026-04-24): the
-- `web_push_subscriptions.endpoint` column has a global UNIQUE index,
-- but a browser PushManager endpoint is browser-scoped, not user-
-- scoped. When User B signs into a browser previously used by User A:
--
--   1. Browser endpoint X is unchanged (PushManager subscriptions
--      survive the Supabase auth session change).
--   2. Client calls `subscribeToWebPush` for User B. The upsert with
--      `onConflict: "endpoint"` tries to UPDATE the existing row.
--   3. The UPDATE RLS policy checks `auth.uid() = user_id` against
--      the *existing* row → user_id is still A → policy rejects.
--   4. The row stays with User A's user_id. Cron fan-out keeps sending
--      A's weekly-recap push body to B's browser indefinitely.
--
-- That's a privacy leak: User B sees A's calorie deficit, goal, recap
-- headline in a notification on their own login.
--
-- Fix: a SECURITY DEFINER RPC `claim_web_push_subscription` that
-- atomically deletes any existing row with the endpoint (regardless
-- of current owner) then inserts a fresh row for the caller. One
-- function-body transaction = one row per endpoint, always owned by
-- the most recent claimant.
--
-- Why an RPC rather than a composite (user_id, endpoint) unique:
--   * Composite unique would let two users hold the *same* endpoint
--     simultaneously, so the cron would fan out BOTH users' bodies
--     to the same browser — the leak isn't fixed, it's doubled.
--   * The RPC enforces "current claimant only" by construction; no
--     race between delete-old and insert-new on the client side.
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration).

set search_path = public;

create or replace function public.claim_web_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'claim_web_push_subscription: not authenticated'
      using errcode = '42501';
  end if;

  if p_endpoint is null or length(trim(p_endpoint)) = 0 then
    raise exception 'claim_web_push_subscription: endpoint is required'
      using errcode = '22023';
  end if;
  if p_p256dh is null or length(trim(p_p256dh)) = 0 then
    raise exception 'claim_web_push_subscription: p256dh is required'
      using errcode = '22023';
  end if;
  if p_auth is null or length(trim(p_auth)) = 0 then
    raise exception 'claim_web_push_subscription: auth is required'
      using errcode = '22023';
  end if;

  -- Atomic claim: delete any existing row with this endpoint
  -- (could belong to another user OR to the same user re-subscribing
  -- after a cleanup), then insert a fresh row owned by the caller.
  -- The DELETE + INSERT execute inside the function's implicit
  -- statement transaction so the table is never empty for an
  -- endpoint that should be subscribed.
  delete from public.web_push_subscriptions
    where endpoint = p_endpoint;

  insert into public.web_push_subscriptions
    (user_id, endpoint, p256dh, auth, user_agent, last_seen_at)
  values
    (v_uid, p_endpoint, p_p256dh, p_auth, p_user_agent, now());
end;
$$;

revoke all on function public.claim_web_push_subscription(text, text, text, text) from public;
grant execute on function public.claim_web_push_subscription(text, text, text, text) to authenticated;

comment on function public.claim_web_push_subscription(text, text, text, text) is
  'T21 (2026-04-24): atomic claim of a Web Push endpoint by the calling user. Deletes any prior row with the same endpoint (defense against the cross-user leak when two users share a browser) then inserts the caller as the new owner. SECURITY DEFINER so the DELETE is not blocked by the previous owner''s RLS policy. See docs/audits/2026-04-24-full-sweep.md §A3 / §A5.';

NOTIFY pgrst, 'reload schema';
