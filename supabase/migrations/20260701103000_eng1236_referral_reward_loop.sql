-- ENG-1236: referral / invite-for-Pro growth loop.
--
-- Creates a server-owned referral code + redemption ledger and RPCs for
-- authenticated clients. This migration is defensive because older branches
-- had generated types for these tables before their table-creation migration
-- was present locally.

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  total_redeemed integer not null default 0,
  total_reward_days_granted integer not null default 0,
  flagged_at timestamptz,
  flagged_reason text
);

create unique index if not exists referrals_referrer_id_unique
  on public.referrals (referrer_id);

create unique index if not exists referrals_code_unique
  on public.referrals (upper(code));

create table if not exists public.referral_credits (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referee_id uuid not null references public.profiles(id) on delete cascade,
  referrer_days integer not null default 30,
  referee_days integer not null default 30,
  redeemed_at timestamptz not null default now(),
  reward_granted_at timestamptz not null default now()
);

create unique index if not exists referral_credits_referee_id_unique
  on public.referral_credits (referee_id);

create index if not exists referral_credits_referrer_id_idx
  on public.referral_credits (referrer_id, redeemed_at desc);

alter table public.referrals enable row level security;
alter table public.referral_credits enable row level security;

drop policy if exists referrals_select_own on public.referrals;
create policy referrals_select_own
  on public.referrals
  for select
  using ((select auth.uid()) = referrer_id);

drop policy if exists referral_credits_select_own on public.referral_credits;
create policy referral_credits_select_own
  on public.referral_credits
  for select
  using (
    (select auth.uid()) = referrer_id
    or (select auth.uid()) = referee_id
  );

create or replace function public.get_or_create_referral_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_attempt integer := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select code into v_code
    from public.referrals
   where referrer_id = v_uid
   limit 1;

  if v_code is not null then
    return upper(v_code);
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

    begin
      insert into public.referrals (referrer_id, code)
      values (v_uid, v_code)
      returning code into v_code;
      return upper(v_code);
    exception
      when unique_violation then
        if v_attempt >= 8 then
          raise;
        end if;
    end;
  end loop;
end;
$$;

create or replace function public.redeem_referral_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
  v_referral public.referrals%rowtype;
  v_credit public.referral_credits%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  if v_code = '' then
    return jsonb_build_object('status', 'invalid_code');
  end if;

  select * into v_referral
    from public.referrals
   where upper(code) = v_code
     and flagged_at is null
   limit 1;

  if v_referral.id is null then
    return jsonb_build_object('status', 'invalid_code');
  end if;

  if v_referral.referrer_id = v_uid then
    return jsonb_build_object('status', 'cannot_refer_self');
  end if;

  select * into v_credit
    from public.referral_credits
   where referee_id = v_uid
   limit 1;

  if v_credit.id is not null then
    return jsonb_build_object('status', 'already_redeemed');
  end if;

  begin
    insert into public.referral_credits (
      code,
      referrer_id,
      referee_id,
      referrer_days,
      referee_days
    )
    values (
      v_code,
      v_referral.referrer_id,
      v_uid,
      30,
      30
    )
    returning * into v_credit;
  exception
    when unique_violation then
      return jsonb_build_object('status', 'already_redeemed');
  end;

  update public.referrals
     set total_redeemed = total_redeemed + 1,
         total_reward_days_granted = total_reward_days_granted + 60
   where id = v_referral.id;

  return jsonb_build_object(
    'status', 'redeemed',
    'code', v_code,
    'referrer_days', v_credit.referrer_days,
    'referee_days', v_credit.referee_days,
    'redeemed_at', v_credit.redeemed_at
  );
end;
$$;

revoke all on function public.get_or_create_referral_code() from public;
revoke all on function public.redeem_referral_code(text) from public;
grant execute on function public.get_or_create_referral_code() to authenticated;
grant execute on function public.redeem_referral_code(text) to authenticated;

comment on table public.referrals is
  'ENG-1236: one shareable referral code per user for invite-for-Pro growth loop.';

comment on table public.referral_credits is
  'ENG-1236: immutable referral redemption ledger. referrer/referee days are the server-owned reward source.';

comment on function public.get_or_create_referral_code is
  'ENG-1236: authenticated referral-code mint/read RPC. Security definer so clients cannot insert arbitrary referral rows.';

comment on function public.redeem_referral_code(text) is
  'ENG-1236: authenticated referral redemption RPC with self-referral and duplicate-referee guards.';

notify pgrst, 'reload schema';
