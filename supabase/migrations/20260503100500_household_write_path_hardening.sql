-- T20 — full-sweep 2026-04-24 Phase 3 condition.
--
-- Closes two cross-household exploit surfaces flagged by data-integrity
-- §A4 + security §3 / §4 (audit 2026-04-24):
--
-- (a) `household_meals` UPDATE WITH CHECK (set in 20260425100100) is
--     identical to USING — `added_by = auth.uid() OR household_id in
--     (owned)`. A creator stays `added_by = auth.uid()` while flipping
--     `household_id` to a household they don't own AND don't belong to,
--     polluting another household's meal list. The fix: AND the WITH
--     CHECK clauses (membership AND attribution), and add a BEFORE
--     UPDATE trigger that flat-out rejects mutations to `added_by` /
--     `household_id` (defense-in-depth — the trigger holds even if
--     RLS is later misconfigured by a subsequent migration).
--
-- (b) `household_join_by_invite_code` RPC (20260422100000) bypasses
--     RLS via SECURITY DEFINER and never filters `disbanded_at IS NULL`
--     or the optional `invite_code_expires_at`. Stale codes can rejoin
--     a soft-deleted household; expired codes from a long-ago invite
--     still work on mobile (the web `/api/household/join` route does
--     check expiry; the RPC is the bypass). Fix: add both filters and
--     return distinct error codes (`household_disbanded` /
--     `invite_expired`) so the UI can render the right message.
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration).

set search_path = public;

-- ────────── 1. Tighten household_meals UPDATE WITH CHECK ──────────

drop policy if exists "Creator or owner can update meals" on public.household_meals;

create policy "Creator or owner can update meals"
  on public.household_meals for update
  to authenticated
  using (
    -- Who can SEE a row to update it: original creator or owner of
    -- the destination household.
    added_by = auth.uid()
    or household_id in (select id from public.households where owner_id = auth.uid())
  )
  with check (
    -- T20: AND'd. The post-update row must satisfy BOTH:
    --   * `added_by` is still the caller (immutability), AND
    --   * `household_id` is still a household the caller belongs to
    --     (no cross-household relocation).
    added_by = auth.uid()
    and household_id in (select public.auth_household_ids())
  );

-- ────────── 2. Immutability trigger (defense-in-depth) ──────────

create or replace function public.household_meals_immutable_attribution()
returns trigger
language plpgsql
as $$
begin
  -- The service role bypasses this guard for admin / migration use.
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.added_by is distinct from old.added_by then
    raise exception 'household_meals.added_by is immutable (T20)'
      using errcode = '42501';
  end if;
  if new.household_id is distinct from old.household_id then
    raise exception 'household_meals.household_id is immutable (T20)'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists household_meals_immutable_attribution_trg on public.household_meals;

create trigger household_meals_immutable_attribution_trg
before update on public.household_meals
for each row
execute function public.household_meals_immutable_attribution();

comment on trigger household_meals_immutable_attribution_trg on public.household_meals is
  'T20 (2026-04-24): rejects mutations to added_by and household_id from anon / authenticated callers. Service role bypasses for migration / admin use. Defense-in-depth on top of the AND-tightened UPDATE policy.';

-- ────────── 3. Harden household_join_by_invite_code ──────────

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
  v_household record;
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

  v_code := lower(trim(p_invite_code));
  v_display := nullif(trim(coalesce(p_display_name, '')), '');
  if v_display is not null and length(v_display) > 30 then
    v_display := substring(v_display from 1 for 30);
  end if;

  select hm.household_id, hm.role
    into v_existing_membership
  from public.household_members hm
  where hm.user_id = v_uid
  limit 1;

  -- T20: load household with disband + expiry context. We fetch a
  -- record so we can return distinct error codes for "no such code"
  -- vs "code matched but household disbanded" vs "code matched but
  -- expired".
  select h.id, h.name, h.disbanded_at, h.invite_code_expires_at
    into v_household
  from public.households h
  where lower(h.invite_code) = v_code
  limit 1;

  if v_household.id is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'invalid_code',
      'message', 'No household found with that invite code.'
    );
  end if;

  if v_household.disbanded_at is not null then
    return jsonb_build_object(
      'ok', false,
      'error', 'household_disbanded',
      'message', 'This household has been disbanded.'
    );
  end if;

  if v_household.invite_code_expires_at is not null
     and v_household.invite_code_expires_at <= now()
  then
    return jsonb_build_object(
      'ok', false,
      'error', 'invite_expired',
      'message', 'This invite code has expired. Ask the owner for a new one.'
    );
  end if;

  -- Idempotent: same user, same household → success, no-op.
  if v_existing_membership.household_id is not null then
    if v_existing_membership.household_id = v_household.id then
      return jsonb_build_object(
        'ok', true,
        'household_id', v_household.id,
        'household_name', v_household.name,
        'already_member', true
      );
    end if;
    return jsonb_build_object(
      'ok', false,
      'error', 'already_in_household',
      'message', 'Leave your current household first.'
    );
  end if;

  -- Cap check (8 members, same as REST route).
  select count(*)
    into v_member_count
  from public.household_members
  where household_id = v_household.id;

  if v_member_count >= 8 then
    return jsonb_build_object(
      'ok', false,
      'error', 'household_full',
      'message', 'This household has reached the maximum of 8 members.'
    );
  end if;

  insert into public.household_members (household_id, user_id, role, display_name)
  values (v_household.id, v_uid, 'member', v_display);

  update public.profiles
     set household_id = v_household.id
   where id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'household_id', v_household.id,
    'household_name', v_household.name,
    'already_member', false
  );
exception
  when unique_violation then
    if exists (
      select 1 from public.household_members
      where user_id = v_uid and household_id = v_household.id
    ) then
      return jsonb_build_object(
        'ok', true,
        'household_id', v_household.id,
        'household_name', v_household.name,
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

comment on function public.household_join_by_invite_code(text, text) is
  'T20 (2026-04-24): adds disbanded_at + invite_code_expires_at filters to close the mobile-side bypass that let users rejoin ghost households / use stale codes. Returns distinct error codes (household_disbanded, invite_expired) so the UI can render the right message.';

NOTIFY pgrst, 'reload schema';
