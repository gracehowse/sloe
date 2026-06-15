-- ENG-1103 — deactivate guessable SUPPR_TEST_PREMIUM in prod + per-user
-- failed-attempt throttle on redeem_promo_code (launch-readiness audit P1-1).
--
-- The test promo granted Pro to anyone who typed a public string via an
-- un-rate-limited RPC. Deactivate the row (dev seed can re-insert locally).

update public.promo_codes
set active = false
where code = 'SUPPR_TEST_PREMIUM';

-- Rolling 60s window of failed redemption attempts per authenticated user.
create table if not exists public.promo_redeem_throttle (
  user_id uuid primary key references auth.users (id) on delete cascade,
  failed_count integer not null default 0 check (failed_count >= 0),
  window_started timestamptz not null default now()
);

alter table public.promo_redeem_throttle enable row level security;

-- Only the SECURITY DEFINER RPC touches this table; no client policies.

create or replace function public.redeem_promo_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.promo_codes%rowtype;
  v_current text;
  v_effective text;
  v_failed integer;
  v_window timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_code is null or length(trim(p_code)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  -- ENG-1103: max 10 failed attempts per user per 60s window.
  select failed_count, window_started
  into v_failed, v_window
  from public.promo_redeem_throttle
  where user_id = v_uid;

  if not found then
    insert into public.promo_redeem_throttle (user_id, failed_count, window_started)
    values (v_uid, 0, now())
    on conflict (user_id) do nothing;
    v_failed := 0;
    v_window := now();
  elsif v_window < now() - interval '60 seconds' then
    update public.promo_redeem_throttle
    set failed_count = 0, window_started = now()
    where user_id = v_uid;
    v_failed := 0;
    v_window := now();
  end if;

  if coalesce(v_failed, 0) >= 10 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  select * into v_row
  from public.promo_codes
  where code = upper(trim(p_code))
    and active = true
    and (expires_at is null or expires_at > now())
    and (max_uses is null or uses_count < max_uses);

  if not found then
    insert into public.promo_redeem_throttle (user_id, failed_count, window_started)
    values (v_uid, 1, now())
    on conflict (user_id) do update
    set
      failed_count = case
        when public.promo_redeem_throttle.window_started < now() - interval '60 seconds' then 1
        else public.promo_redeem_throttle.failed_count + 1
      end,
      window_started = case
        when public.promo_redeem_throttle.window_started < now() - interval '60 seconds' then now()
        else public.promo_redeem_throttle.window_started
      end;
    return jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  end if;

  -- Success path — reset the failure window.
  update public.promo_redeem_throttle
  set failed_count = 0, window_started = now()
  where user_id = v_uid;

  select user_tier into v_current from public.profiles where id = v_uid;
  if public.tier_rank(v_current) >= public.tier_rank(v_row.tier) then
    v_effective := v_current;
  else
    v_effective := v_row.tier;
  end if;

  perform set_config('app.tier_writer', 'on', true);

  if exists (
    select 1 from public.promo_redemptions r
    where r.user_id = v_uid and r.promo_code_id = v_row.id
  ) then
    insert into public.profiles (id, user_tier)
    values (v_uid, v_effective)
    on conflict (id) do update set user_tier = excluded.user_tier;
    perform set_config('app.tier_writer', 'off', true);
    return jsonb_build_object('ok', true, 'tier', v_effective, 'already_redeemed', true);
  end if;

  insert into public.profiles (id, user_tier)
  values (v_uid, v_effective)
  on conflict (id) do update set user_tier = excluded.user_tier;

  insert into public.promo_redemptions (user_id, promo_code_id)
  values (v_uid, v_row.id);

  update public.promo_codes
  set uses_count = uses_count + 1
  where id = v_row.id;

  perform set_config('app.tier_writer', 'off', true);
  return jsonb_build_object('ok', true, 'tier', v_effective, 'already_redeemed', false);
end;
$$;

comment on function public.redeem_promo_code is
  'ENG-1043 + ENG-1103: idempotent promo redemption with tier-lockdown bypass (app.tier_writer GUC), never-downgrade floor, and per-user failed-attempt throttle (10/min).';
