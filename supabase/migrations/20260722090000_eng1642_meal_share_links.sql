-- ============================================================================
-- 20260722090000_eng1642_meal_share_links.sql
-- ENG-1642 — Meal sharing v1: share a logged meal via link; recipient adds it
-- to their own log (MFP-parity).
--
-- Why: the F-154 per-meal share (ENG-25) is outbound text only — nothing lands
-- in the recipient's log. This adds the durable half: a `meal_shares` row is
-- an IMMUTABLE SNAPSHOT of one logged meal's items (macros + micros),
-- addressed by an unguessable token, served to recipients (including
-- anonymous visitors on the /m/<token> web landing) via a SECURITY DEFINER
-- RPC. The recipient re-logs the snapshot as brand-new nutrition_entries rows
-- they own — no cross-user read of nutrition_entries exists or is added here.
--
-- Privacy posture (carries ENG-25's pin): meal contents only — never the
-- sharer's targets, day budget, or any other diary content. The sharer's
-- display name is resolved LIVE from profiles at read time (ENG-154 dead-name
-- rule: never snapshot names).
--
-- Constraints:
--   * Token: 32 lowercase hex chars (gen_random_bytes(16) — 128 bits;
--     household invite codes are 6 bytes, sized up here because this token
--     gates an unauthenticated read).
--   * Expiry: 30 days (household_invites convention); checked at read time,
--     never a cron.
--   * Writes are mediated by RPCs (security definer) — no direct
--     insert / update / delete from clients.
--   * get_meal_share is the first anon-executable RPC in the schema —
--     deliberate: the /m/<token> landing must render for signed-out
--     recipients. It exposes exactly: title, meal_slot, items, shared_by
--     display name, created_at. Never created_by, never the raw row.
--   * Items are rebuilt server-side against a whitelist (see
--     create_meal_share) so a hand-rolled client call cannot smuggle
--     arbitrary JSON into an anon-readable payload.
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration) — Grace
-- runs this; Claude/MCP must NOT apply.
-- ============================================================================

create extension if not exists "pgcrypto" with schema extensions;

-- ── 1. Table ────────────────────────────────────────────────────────────────

create table if not exists public.meal_shares (
  id uuid primary key default gen_random_uuid(),
  token text not null check (token ~ '^[a-f0-9]{32}$'),
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) > 0 and length(title) <= 200),
  meal_slot text not null
    check (meal_slot in ('Breakfast', 'Lunch', 'Dinner', 'Snacks')),
  items jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz
);

create unique index if not exists meal_shares_token_unique
  on public.meal_shares (token);

-- Sharer-side listing (future "my shared links" management surface) + the
-- create-rate-limit window scan.
create index if not exists idx_meal_shares_created_by_created_at
  on public.meal_shares (created_by, created_at desc);

alter table public.meal_shares enable row level security;

-- Sharers can read their own shares (future management surface). Recipients
-- NEVER read the table directly — get_meal_share (security definer) is the
-- only recipient read path.
create policy "meal_shares_select_own"
  on public.meal_shares
  for select
  to authenticated
  using (created_by = auth.uid());

-- Lock the table down (ENG-1320 F5 convention): no anon access at all;
-- authenticated keeps SELECT (RLS-scoped to own rows) and nothing else.
revoke all on table public.meal_shares from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.meal_shares from authenticated;

-- ────────── RPCs ──────────

-- create_meal_share: snapshot one meal's items into a share row.
-- Returns a jsonb payload rather than throwing, so the mobile / web clients
-- can surface a friendly error without parsing pgrst error strings
-- (household-join convention).
--   status: 'created' | 'not_authenticated' | 'invalid_title' | 'invalid_slot'
--         | 'invalid_items' | 'rate_limited'
create or replace function public.create_meal_share(
  p_title text,
  p_meal_slot text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_title text;
  v_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_clean jsonb;
  v_micros jsonb;
  v_recipe_id uuid;
  v_token text;
  v_share_id uuid;
  v_expires_at timestamptz;
  v_attempt int := 0;
  v_recent int;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  v_title := nullif(trim(coalesce(p_title, '')), '');
  if v_title is null or length(v_title) > 200 then
    return jsonb_build_object('status', 'invalid_title');
  end if;

  if p_meal_slot is null
     or p_meal_slot not in ('Breakfast', 'Lunch', 'Dinner', 'Snacks') then
    return jsonb_build_object('status', 'invalid_slot');
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 40 then
    return jsonb_build_object('status', 'invalid_items');
  end if;

  -- Rate limit (ENG-1320 convention: count-over-window inside the RPC, no
  -- counter tables). 100 shares / 24h bounds abuse of anon-readable storage
  -- without ever touching a legitimate user. The advisory xact lock
  -- serializes concurrent creates per user so parallel calls can't all
  -- read v_recent < 100 before any of them insert (the ENG-1320 F4
  -- lock-then-count pattern; meal_shares has no parent row to lock, so a
  -- per-user advisory lock stands in).
  perform pg_advisory_xact_lock(hashtext('meal_share_create'), hashtext(v_uid::text));
  select count(*) into v_recent
  from public.meal_shares
  where created_by = v_uid
    and created_at > now() - interval '24 hours';
  if v_recent >= 100 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  -- Rebuild every item against a whitelist: this payload is served to anon
  -- via get_meal_share, so unknown keys are dropped, types are enforced, and
  -- numbers are bounded. recipe_id survives ONLY when it points at a
  -- published recipe (recipes RLS already exposes published rows to everyone,
  -- so a published id leaks nothing; a private id would).
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or jsonb_typeof(v_item->'recipe_title') <> 'string'
       or nullif(trim(v_item->>'recipe_title'), '') is null
       or length(v_item->>'recipe_title') > 200
       or jsonb_typeof(v_item->'calories') <> 'number'
       or jsonb_typeof(v_item->'protein') <> 'number'
       or jsonb_typeof(v_item->'carbs') <> 'number'
       or jsonb_typeof(v_item->'fat') <> 'number'
       or (v_item->>'calories')::numeric not between 0 and 20000
       or (v_item->>'protein')::numeric not between 0 and 5000
       or (v_item->>'carbs')::numeric not between 0 and 5000
       or (v_item->>'fat')::numeric not between 0 and 5000
    then
      return jsonb_build_object('status', 'invalid_items');
    end if;

    v_clean := jsonb_build_object(
      'recipe_title', trim(v_item->>'recipe_title'),
      'calories', v_item->'calories',
      'protein', v_item->'protein',
      'carbs', v_item->'carbs',
      'fat', v_item->'fat'
    );

    if jsonb_typeof(v_item->'fiber_g') = 'number'
       and (v_item->>'fiber_g')::numeric between 0 and 1000 then
      v_clean := v_clean || jsonb_build_object('fiber_g', v_item->'fiber_g');
    end if;
    if jsonb_typeof(v_item->'water_ml') = 'number'
       and (v_item->>'water_ml')::numeric between 0 and 20000 then
      v_clean := v_clean || jsonb_build_object('water_ml', v_item->'water_ml');
    end if;
    if jsonb_typeof(v_item->'portion_multiplier') = 'number'
       and (v_item->>'portion_multiplier')::numeric > 0
       and (v_item->>'portion_multiplier')::numeric <= 100 then
      v_clean := v_clean
        || jsonb_build_object('portion_multiplier', v_item->'portion_multiplier');
    end if;
    if jsonb_typeof(v_item->'source') = 'string'
       and length(v_item->>'source') <= 40 then
      v_clean := v_clean || jsonb_build_object('source', v_item->'source');
    end if;

    -- Micros: numeric values only, bounded key count (anon-served payload).
    if jsonb_typeof(v_item->'nutrition_micros') = 'object' then
      if (select count(*)
            from jsonb_object_keys(v_item->'nutrition_micros')) > 100 then
        return jsonb_build_object('status', 'invalid_items');
      end if;
      select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
        into v_micros
      from jsonb_each(v_item->'nutrition_micros') as e(key, value)
      where jsonb_typeof(e.value) = 'number'
        and length(e.key) <= 64
        -- Bound like every other numeric field: micros are anon-served and
        -- land in recipients' diaries — no negatives, no absurd magnitudes,
        -- and no multi-KB numeric literals bloating the snapshot.
        and (e.value)::numeric between 0 and 100000;
      if v_micros <> '{}'::jsonb then
        v_clean := v_clean || jsonb_build_object('nutrition_micros', v_micros);
      end if;
    end if;

    if jsonb_typeof(v_item->'recipe_id') = 'string' then
      begin
        v_recipe_id := (v_item->>'recipe_id')::uuid;
      exception when invalid_text_representation then
        v_recipe_id := null;
      end;
      if v_recipe_id is not null
         and exists (
           select 1 from public.recipes r
           where r.id = v_recipe_id and r.published = true
         ) then
        v_clean := v_clean || jsonb_build_object('recipe_id', v_recipe_id::text);
      end if;
    end if;

    v_items := v_items || jsonb_build_array(v_clean);
  end loop;

  -- Token: 128 bits, lowercase hex (household invite-code technique, sized
  -- up for an unauthenticated-guessable namespace). Retry on the freak
  -- collision (referral-code convention).
  loop
    v_attempt := v_attempt + 1;
    v_token := encode(extensions.gen_random_bytes(16), 'hex');
    begin
      insert into public.meal_shares (token, created_by, title, meal_slot, items)
      values (v_token, v_uid, v_title, p_meal_slot, v_items)
      returning id, expires_at into v_share_id, v_expires_at;
      exit;
    exception when unique_violation then
      if v_attempt >= 8 then
        raise;
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'status', 'created',
    'share_id', v_share_id,
    'token', v_token,
    'expires_at', v_expires_at
  );
end;
$$;

-- get_meal_share: recipient read path (anon + authenticated). Token-addressed;
-- returns only the share payload — never created_by. Display name resolved
-- live from profiles (ENG-154: never snapshot names).
--   status: 'ok' | 'invalid' | 'expired' | 'revoked'
create or replace function public.get_meal_share(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_token text;
  v_row public.meal_shares%rowtype;
  v_shared_by text;
  v_items jsonb;
begin
  v_token := lower(regexp_replace(coalesce(p_token, ''), '[^a-fA-F0-9]', '', 'g'));
  if length(v_token) <> 32 then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into v_row from public.meal_shares where token = v_token;
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;
  if v_row.revoked_at is not null then
    return jsonb_build_object('status', 'revoked');
  end if;
  if v_row.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  select nullif(trim(coalesce(p.display_name, '')), '')
    into v_shared_by
  from public.profiles p
  where p.id = v_row.created_by;

  -- Re-check recipe_id visibility at READ time: create-time validation
  -- alone would keep serving an id for up to 30 days after the recipe is
  -- unpublished/deleted (and a deleted id would fail the recipient's FK
  -- write on accept). Stale ids are stripped, the rest of the item stands.
  select coalesce(jsonb_agg(
           case
             when e.item ? 'recipe_id'
                  and not exists (
                    select 1 from public.recipes r
                    where r.id = (e.item->>'recipe_id')::uuid
                      and r.published = true
                  )
             then e.item - 'recipe_id'
             else e.item
           end
         ), '[]'::jsonb)
    into v_items
  from jsonb_array_elements(v_row.items) as e(item);

  return jsonb_build_object(
    'status', 'ok',
    'title', v_row.title,
    'meal_slot', v_row.meal_slot,
    'items', v_items,
    'shared_by', v_shared_by,
    'created_at', v_row.created_at
  );
end;
$$;

-- revoke_meal_share: sharer kills the link. v1 ships the RPC; the "my shared
-- links" management UI is the tracked follow-up ENG-1648 (not a silent
-- deferral).
--   status: 'revoked' | 'not_found' | 'not_authenticated'
create or replace function public.revoke_meal_share(p_share_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;
  update public.meal_shares
     set revoked_at = now()
   where id = p_share_id
     and created_by = v_uid
     and revoked_at is null;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  return jsonb_build_object('status', 'revoked');
end;
$$;

-- ── 3. Grants ───────────────────────────────────────────────────────────────

revoke all on function public.create_meal_share(text, text, jsonb) from public;
revoke all on function public.get_meal_share(text) from public;
revoke all on function public.revoke_meal_share(uuid) from public;

grant execute on function public.create_meal_share(text, text, jsonb)
  to authenticated;
grant execute on function public.revoke_meal_share(uuid) to authenticated;
-- Anon grant is DELIBERATE and reviewed (the /m/<token> landing renders for
-- signed-out recipients). Scope stays: token-addressed read of a
-- sharer-authored snapshot, nothing else.
grant execute on function public.get_meal_share(text) to anon, authenticated;

comment on table public.meal_shares is
  'ENG-1642 (2026-07-22): immutable snapshots of a logged meal, shared via unguessable token links (/m/<token>). Meal contents only — never targets/day budget (ENG-25 privacy pin). Writes via RPCs only.';
comment on function public.create_meal_share(text, text, jsonb) is
  'ENG-1642: snapshot one meal into a share link. Whitelist-rebuilds items server-side; 100/24h rate limit; recipe_id kept only when published.';
comment on function public.get_meal_share(text) is
  'ENG-1642: token-addressed recipient read (anon + authenticated). Returns payload + live sharer display_name; never created_by.';
comment on function public.revoke_meal_share(uuid) is
  'ENG-1642: sharer revokes a share link (management UI tracked as ENG-1648).';

notify pgrst, 'reload schema';

-- Verification (run after push):
--   select public.get_meal_share('00000000000000000000000000000000');
--     -- → {"status": "invalid"}
--   -- As an authenticated user:
--   select public.create_meal_share('Test meal', 'Dinner', '[]'::jsonb);
--     -- → {"status": "invalid_items"}
--   select public.create_meal_share('Test meal', 'Dinner',
--     '[{"recipe_title":"Chicken salad","calories":420,"protein":38,"carbs":12,"fat":24}]'::jsonb);
--     -- → {"status": "created", "token": "<32 hex>", ...}; then
--   select public.get_meal_share('<that token>');  -- → {"status": "ok", ...}
