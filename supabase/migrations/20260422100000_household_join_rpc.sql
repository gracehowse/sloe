-- Household join-by-invite-code RPC (2026-04-18, mobile household port).
--
-- Why this RPC exists:
--   Mobile was calling the Next.js `/api/household/join` route with a
--   relative URL, which never works inside React Native (no origin →
--   fetch throws or resolves to garbage). The mobile client has been
--   ported to direct Supabase calls under RLS — but join-by-code is the
--   one operation RLS cannot express:
--
--     * `households` SELECT is restricted to current members.
--     * An authenticated user who is NOT yet a member therefore cannot
--       look up a household by its invite_code to validate it.
--
--   `INSERT INTO household_members (…)` RLS policy only checks
--   `user_id = auth.uid()`, so without server-side validation a malicious
--   client could insert itself into any household it guessed the id of.
--
--   This security-definer function runs with the privileges of the
--   function owner (postgres) but only exposes the one narrow operation
--   to authenticated callers: "given an invite code, atomically add me
--   to that household if I'm not already in one and the cap isn't hit,
--   then link my profile."
--
-- Behaviour notes:
--   * Returns a `jsonb` payload rather than throwing, so the mobile /
--     web clients can surface a friendly error without parsing pgrst
--     error strings.
--   * Enforces the same 8-member cap as the legacy REST route
--     (`app/api/household/join/route.ts`).
--   * Trims the invite code and upper/lower-cases as stored (the
--     table stores hex from `encode(gen_random_bytes(6), 'hex')` —
--     lower-case — so we compare lower-cased input).
--   * Idempotent-friendly: if the user is already a member of THIS
--     household it returns `{ ok: true, already_member: true }` so
--     retries from a flaky network don't error.
--
-- This file is `CREATE OR REPLACE` + `IF NOT EXISTS`-free on the grant
-- line is intentional — re-running the migration must be safe.

create or replace function public.household_join_by_invite_code(
  p_invite_code text,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_display text;
  v_household_id uuid;
  v_household_name text;
  v_existing_membership record;
  v_member_count int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_invite_code is null or length(trim(p_invite_code)) = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'missing_code',
      'message', 'Invite code is required.'
    );
  end if;

  -- Normalise: codes are stored as lowercase hex; be generous on input.
  v_code := lower(trim(p_invite_code));
  v_display := nullif(trim(coalesce(p_display_name, '')), '');
  if v_display is not null and length(v_display) > 30 then
    v_display := substring(v_display from 1 for 30);
  end if;

  -- 1) Is the caller already a member of some household?
  select hm.household_id, hm.role
    into v_existing_membership
  from public.household_members hm
  where hm.user_id = v_uid
  limit 1;

  -- 2) Look up the target household (bypassing RLS via security definer).
  select h.id, h.name
    into v_household_id, v_household_name
  from public.households h
  where lower(h.invite_code) = v_code
  limit 1;

  if v_household_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'invalid_code',
      'message', 'No household found with that invite code.'
    );
  end if;

  -- Idempotent: same user, same household → success, no-op.
  if v_existing_membership.household_id is not null then
    if v_existing_membership.household_id = v_household_id then
      return jsonb_build_object(
        'ok', true,
        'household_id', v_household_id,
        'household_name', v_household_name,
        'already_member', true
      );
    end if;
    return jsonb_build_object(
      'ok', false,
      'error', 'already_in_household',
      'message', 'Leave your current household first.'
    );
  end if;

  -- 3) Cap check (8 members, same as REST route).
  select count(*)
    into v_member_count
  from public.household_members
  where household_id = v_household_id;

  if v_member_count >= 8 then
    return jsonb_build_object(
      'ok', false,
      'error', 'household_full',
      'message', 'This household has reached the maximum of 8 members.'
    );
  end if;

  -- 4) Insert the membership row and link the profile. Both in one
  --    atomic function call so a mid-flow failure doesn't leave the
  --    user half-joined.
  insert into public.household_members (household_id, user_id, role, display_name)
  values (v_household_id, v_uid, 'member', v_display);

  update public.profiles
     set household_id = v_household_id
   where id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'household_id', v_household_id,
    'household_name', v_household_name,
    'already_member', false
  );
exception
  when unique_violation then
    -- Race: another device just joined. Treat as idempotent success if
    -- we ended up in the right household, else surface as conflict.
    if exists (
      select 1 from public.household_members
      where user_id = v_uid and household_id = v_household_id
    ) then
      return jsonb_build_object(
        'ok', true,
        'household_id', v_household_id,
        'household_name', v_household_name,
        'already_member', true
      );
    end if;
    return jsonb_build_object(
      'ok', false,
      'error', 'already_in_household',
      'message', 'Leave your current household first.'
    );
end;
$$;

grant execute on function public.household_join_by_invite_code(text, text) to authenticated;

NOTIFY pgrst, 'reload schema';
