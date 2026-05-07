-- F-111 (TestFlight `AGthJykAoNdxEYKsRoLWf-c`, 2026-05-06):
-- "Clicking add to add someone to your household doesn't actually work."
--
-- Until now `households.invite_code` was the only join mechanism — the
-- inviter copy-pasted a 6-char code to the invitee out-of-band; the
-- "+ Add" button on the Household settings page was a dead navigation
-- to the Plan tab. The repo-auditor confirmed Scenario C (button has
-- no underlying flow on either platform).
--
-- This migration adds the missing piece: `household_invites` so the
-- inviter can target a specific email, and the invitee sees the
-- pending invitation in-app on their next /household visit. No email
-- delivery in v1 — we use auth.email() lookup so the moment the
-- invitee opens Suppr they see "X invited you to their household —
-- Accept / Decline." Email delivery is a follow-up.
--
-- Constraints:
--   - One pending invite per (household_id, invitee_email) — repeat
--     "send invite" updates the existing row rather than fanning out.
--   - 30-day expiry; expired rows are visible to the inviter as
--     "expired" but cannot be accepted.
--   - Owners can create + cancel invites; everyone can accept their
--     own pending invites.

create extension if not exists "pgcrypto" with schema extensions;

create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null check (length(invitee_email) > 0 and length(invitee_email) <= 254),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  accepted_at timestamptz,
  declined_at timestamptz,
  cancelled_at timestamptz,
  unique (household_id, invitee_email)
);

create index if not exists idx_household_invites_email_pending
  on public.household_invites (invitee_email)
  where status = 'pending';

create index if not exists idx_household_invites_household
  on public.household_invites (household_id);

alter table public.household_invites enable row level security;

-- The owner of the household can read all invites for their household,
-- so the Settings sheet can show "Invites you've sent". An invitee
-- can read invites addressed to their email, so /household can show
-- "Invitations for you". Other users see nothing.
create policy "owner reads household invites"
  on public.household_invites for select
  to authenticated
  using (
    household_id in (select id from public.households where owner_id = auth.uid())
  );

create policy "invitee reads invites for their email"
  on public.household_invites for select
  to authenticated
  using (
    -- auth.email() is the canonical helper; the JWT also carries the
    -- email claim. Match case-insensitively to handle the "Gmail
    -- treats addresses as case-insensitive" reality.
    lower(invitee_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );

-- Writes are mediated by RPCs (security definer) — no direct insert /
-- update / delete from clients. This keeps the email-match logic and
-- household-membership upsert atomic and bypassable-only via the
-- audited functions below.

-- ────────── RPCs ──────────

-- household_invite_send: owner-only. Idempotent — repeat sends to the
-- same email update the existing row's `created_at` + reset status to
-- pending if it had been declined / expired. Returns the invite row.
create or replace function public.household_invite_send(
  p_household_id uuid,
  p_invitee_email text
)
returns public.household_invites
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_inviter uuid := auth.uid();
  v_normalised_email text;
  v_invite public.household_invites;
begin
  if v_inviter is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Verify the caller owns the target household.
  if not exists (
    select 1 from public.households h
    where h.id = p_household_id and h.owner_id = v_inviter
  ) then
    raise exception 'not_household_owner' using errcode = '42501';
  end if;

  v_normalised_email := lower(trim(p_invitee_email));
  if v_normalised_email = '' or v_normalised_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;

  -- Don't invite the inviter themselves.
  if v_normalised_email = lower(coalesce((auth.jwt() ->> 'email'), '')) then
    raise exception 'cannot_invite_self' using errcode = '22023';
  end if;

  insert into public.household_invites (
    household_id, inviter_user_id, invitee_email, status, created_at, expires_at
  ) values (
    p_household_id, v_inviter, v_normalised_email, 'pending', now(), now() + interval '30 days'
  )
  on conflict (household_id, invitee_email) do update set
    status = 'pending',
    inviter_user_id = excluded.inviter_user_id,
    created_at = now(),
    expires_at = now() + interval '30 days',
    accepted_at = null,
    declined_at = null,
    cancelled_at = null
  returning * into v_invite;

  return v_invite;
end;
$$;

grant execute on function public.household_invite_send(uuid, text) to authenticated;

-- household_invite_accept: invitee accepts. Verifies the JWT email
-- matches the invite, then upserts into household_members. Atomic.
create or replace function public.household_invite_accept(
  p_invite_id uuid
)
returns public.household_members
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text := lower(coalesce((auth.jwt() ->> 'email'), ''));
  v_invite public.household_invites;
  v_member public.household_members;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_invite
  from public.household_invites
  where id = p_invite_id
    and lower(invitee_email) = v_user_email
    and status = 'pending'
    and expires_at > now()
  for update;

  if not found then
    -- Either: bad invite_id, email mismatch, already actioned, or expired.
    raise exception 'invite_not_actionable' using errcode = '42704';
  end if;

  -- Upsert household_members; user might already be a member from a
  -- previous invite-code join. The unique (household_id, user_id)
  -- constraint enforces idempotence.
  insert into public.household_members (household_id, user_id, role)
  values (v_invite.household_id, v_user_id, 'member')
  on conflict (household_id, user_id) do update set
    role = excluded.role
  returning * into v_member;

  update public.household_invites
  set status = 'accepted', accepted_at = now()
  where id = p_invite_id;

  return v_member;
end;
$$;

grant execute on function public.household_invite_accept(uuid) to authenticated;

-- household_invite_decline: invitee declines. Soft-state only — the
-- row stays for the inviter's audit log.
create or replace function public.household_invite_decline(
  p_invite_id uuid
)
returns public.household_invites
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_email text := lower(coalesce((auth.jwt() ->> 'email'), ''));
  v_invite public.household_invites;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  update public.household_invites
  set status = 'declined', declined_at = now()
  where id = p_invite_id
    and lower(invitee_email) = v_user_email
    and status = 'pending'
  returning * into v_invite;

  if v_invite is null then
    raise exception 'invite_not_actionable' using errcode = '42704';
  end if;

  return v_invite;
end;
$$;

grant execute on function public.household_invite_decline(uuid) to authenticated;

-- household_invite_cancel: owner cancels their own outgoing invite.
create or replace function public.household_invite_cancel(
  p_invite_id uuid
)
returns public.household_invites
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_inviter uuid := auth.uid();
  v_invite public.household_invites;
begin
  if v_inviter is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  update public.household_invites
  set status = 'cancelled', cancelled_at = now()
  where id = p_invite_id
    and household_id in (
      select id from public.households where owner_id = v_inviter
    )
    and status = 'pending'
  returning * into v_invite;

  if v_invite is null then
    raise exception 'invite_not_actionable' using errcode = '42704';
  end if;

  return v_invite;
end;
$$;

grant execute on function public.household_invite_cancel(uuid) to authenticated;
