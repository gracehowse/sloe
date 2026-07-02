-- ============================================================================
-- 20260702126200_eng1320_referral_drift_and_fraud_controls.sql
--
-- ENG-1320 — referral migration drift + missing fraud controls (ENG-1236
-- fast-follow). Live state re-verified read-only on 2026-07-02.
--
-- BACKGROUND
--   public.referrals / public.referral_credits were created OUT-OF-BAND
--   before 20260701103000_eng1236_referral_reward_loop.sql landed, so that
--   migration's `create table if not exists` silently no-oped: the schema it
--   declares never materialised. 20260701103000 IS recorded in live
--   schema_migrations (no re-timestamp needed), but live ≠ file:
--
--     live FKs                → auth.users(id)   (file says public.profiles(id))
--     reward_granted_at       → nullable, no default (file says not null default now())
--     no_self_referral CHECK  → exists live, absent from the file
--     duplicate indexes       → unique_referee ≡ referral_credits_referee_id_unique,
--                               referral_credits_referrer_idx ⊂ referral_credits_referrer_id_idx,
--                               referrals_referrer_unique ≡ referrals_referrer_id_unique
--     referrals_code_unique   → live: UNIQUE constraint on raw (code);
--                               fresh replay: unique index on upper(code) —
--                               SAME NAME, different objects. The redeem
--                               lookup filters upper(code), which live can
--                               only answer with a seq scan.
--
--   Editing the applied 20260701103000 file would be invisible (db push
--   skips applied versions), so every correction below is an explicit,
--   idempotent statement that converges BOTH a fresh replay and the live DB
--   onto one target schema.
--
-- TARGET SCHEMA DECISIONS
--   * FKs point at auth.users(id) (live wins): profiles.id is itself an FK
--     to auth.users(id) with cascade, so the guarantees are equivalent, and
--     rewriting live FKs to profiles would be churn with zero security value.
--   * reward_granted_at stays NULLABLE with NO default (live wins): null =
--     "reward not yet granted". The file's `not null default now()` would
--     stamp a grant time on insert even though NO entitlement-grant path
--     exists yet — see ENG-1320 for the grant-or-remove-the-claim decision
--     (blocked on legal-reviewer sign-off for the landing copy).
--   * One canonical case-insensitive unique index on upper(code), matching
--     the redeem lookup.
--
-- FRAUD CONTROLS (all from data that already exists — no new tracking)
--   F1  Per-referrer reward cap: first 10 redemptions earn the referrer 30
--       days each (300 max); after that the referee still receives their
--       promised days but the referrer earns 0 — farming yields nothing.
--   F2  Velocity throttle: a 6th redemption of one code inside 24h flags the
--       code (flagged_at/flagged_reason already existed for this) and
--       rejects with status 'rate_limited'; flagged codes stop redeeming
--       until manually reviewed.
--   F3  Alias self-referral guard: normalises the referrer/referee emails
--       already held in auth.users (strip +tags everywhere; strip dots and
--       fold googlemail→gmail for Gmail) and rejects a match as
--       'cannot_refer_self'. Email sign-up needs no confirmation, so
--       grace+1@… farming a code minted by grace@… is otherwise free.
--   F4  DB-level backstop: the live no_self_referral CHECK is added to the
--       migration lineage, and the redeem RPC locks the referrals row
--       (FOR UPDATE) so concurrent redemptions cannot race past F1/F2.
--   F5  Defense-in-depth grants: the dormant anon/authenticated
--       INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER grants on both
--       tables are revoked; writes only happen inside the SECURITY DEFINER
--       RPCs. authenticated keeps SELECT (the RLS select-own policies are
--       the intended read surface for ReferralRewardCard).
--
-- Apply step (Grace runs this — Claude/MCP must NOT apply):
--   supabase db push --linked
-- ============================================================================

begin;

-- ── 1. Drift reconciliation: columns ─────────────────────────────────────────
alter table public.referral_credits alter column reward_granted_at drop default;
alter table public.referral_credits alter column reward_granted_at drop not null;

comment on column public.referral_credits.reward_granted_at is
  'ENG-1320: null = redemption recorded, reward days not yet granted. Set only by the (future) entitlement-grant path — see ENG-1320.';

-- ── 2. Drift reconciliation: FKs → auth.users(id) on both tables ─────────────
alter table public.referrals
  drop constraint if exists referrals_referrer_id_fkey;
alter table public.referrals
  add constraint referrals_referrer_id_fkey
    foreign key (referrer_id) references auth.users(id) on delete cascade;

alter table public.referral_credits
  drop constraint if exists referral_credits_referrer_id_fkey;
alter table public.referral_credits
  add constraint referral_credits_referrer_id_fkey
    foreign key (referrer_id) references auth.users(id) on delete cascade;

alter table public.referral_credits
  drop constraint if exists referral_credits_referee_id_fkey;
alter table public.referral_credits
  add constraint referral_credits_referee_id_fkey
    foreign key (referee_id) references auth.users(id) on delete cascade;

-- ── 3. Drift reconciliation: self-referral CHECK into the lineage ────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.referral_credits'::regclass
      and conname = 'no_self_referral'
  ) then
    alter table public.referral_credits
      add constraint no_self_referral check (referrer_id <> referee_id);
  end if;
end;
$$;

-- ── 4. Drift reconciliation: index dedupe + the missing upper(code) index ────
-- Live-only duplicates (no-ops on a fresh replay):
alter table public.referral_credits drop constraint if exists unique_referee;         -- ≡ referral_credits_referee_id_unique
drop index if exists public.referral_credits_referrer_idx;                            -- prefix of referral_credits_referrer_id_idx
alter table public.referrals drop constraint if exists referrals_referrer_unique;     -- ≡ referrals_referrer_id_unique
-- Converge the divergent referrals_code_unique objects (live: constraint on
-- raw code; fresh: index on upper(code)) onto one canonical functional index:
alter table public.referrals drop constraint if exists referrals_code_unique;
drop index if exists public.referrals_code_unique;
create unique index if not exists referrals_code_upper_unique
  on public.referrals (upper(code));

-- Backstops the eng1236 file's `create index if not exists` no-ops (all
-- already exist live; no-ops there, real on a fresh replay divergence):
create unique index if not exists referrals_referrer_id_unique
  on public.referrals (referrer_id);
create unique index if not exists referral_credits_referee_id_unique
  on public.referral_credits (referee_id);
create index if not exists referral_credits_referrer_id_idx
  on public.referral_credits (referrer_id, redeemed_at desc);

-- ── 5. F5 — table-grant lockdown (writes only via SECURITY DEFINER RPCs) ─────
revoke all on table public.referrals from anon;
revoke all on table public.referral_credits from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.referrals from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.referral_credits from authenticated;

-- ── 6. F3 helper — normalised email identity (existing auth.users data) ──────
create or replace function public.referral_email_identity(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  with parts as (
    select split_part(lower(trim(coalesce(p_email, ''))), '@', 1) as local_part,
           split_part(lower(trim(coalesce(p_email, ''))), '@', 2) as domain
  )
  select case
    when domain = '' then local_part
    else (
      case
        when domain in ('gmail.com', 'googlemail.com')
          then replace(regexp_replace(local_part, '\+.*$', ''), '.', '')
        else regexp_replace(local_part, '\+.*$', '')
      end
    ) || '@' || (case when domain = 'googlemail.com' then 'gmail.com' else domain end)
  end
  from parts;
$$;

-- Internal helper: only ever called from inside the definer RPC (which runs
-- as the function owner). No client surface.
revoke execute on function public.referral_email_identity(text) from public, anon, authenticated;

comment on function public.referral_email_identity(text) is
  'ENG-1320 F3: folds e-mail aliases (+tags everywhere; dots + googlemail→gmail for Gmail) to one identity for the referral self-referral guard. Internal — no client EXECUTE.';

-- ── 7. F1/F2/F3/F4 — fraud-hardened redeem RPC ────────────────────────────────
-- CREATE OR REPLACE preserves the existing ACL (authenticated-only after
-- 20260702126100_eng1307_rpc_execute_lockdown.sql).
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
  v_referrer_email text;
  v_referee_email text;
  v_recent_redemptions integer;
  v_rewarded_redemptions integer;
  v_referrer_days integer := 30;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'not_authenticated');
  end if;

  if v_code = '' then
    return jsonb_build_object('status', 'invalid_code');
  end if;

  -- F4: lock the referral row — serialises concurrent redemptions of the
  -- same code so the F1 cap and F2 velocity counts cannot be raced past.
  select * into v_referral
    from public.referrals
   where upper(code) = v_code
     and flagged_at is null
   limit 1
   for update;

  if v_referral.id is null then
    return jsonb_build_object('status', 'invalid_code');
  end if;

  if v_referral.referrer_id = v_uid then
    return jsonb_build_object('status', 'cannot_refer_self');
  end if;

  -- F3: alias self-referral guard on emails that already exist in auth.users.
  select lower(u.email) into v_referrer_email from auth.users u where u.id = v_referral.referrer_id;
  select lower(u.email) into v_referee_email  from auth.users u where u.id = v_uid;
  if v_referrer_email is not null
     and v_referee_email is not null
     and public.referral_email_identity(v_referrer_email) = public.referral_email_identity(v_referee_email) then
    return jsonb_build_object('status', 'cannot_refer_self');
  end if;

  select * into v_credit
    from public.referral_credits
   where referee_id = v_uid
   limit 1;

  if v_credit.id is not null then
    return jsonb_build_object('status', 'already_redeemed');
  end if;

  -- F2: velocity throttle. A 6th redemption of this code within 24h is
  -- farming, not virality — flag the code (stops all future redemptions
  -- until reviewed) and reject this attempt.
  select count(*) into v_recent_redemptions
    from public.referral_credits
   where referrer_id = v_referral.referrer_id
     and redeemed_at > now() - interval '24 hours';

  if v_recent_redemptions >= 5 then
    update public.referrals
       set flagged_at = now(),
           flagged_reason = 'auto: ' || v_recent_redemptions || ' redemptions in 24h (velocity cap 5/24h, ENG-1320 F2)'
     where id = v_referral.id;
    return jsonb_build_object('status', 'rate_limited');
  end if;

  -- F1: per-referrer reward cap — after 10 rewarded redemptions the referee
  -- still gets their promised days, the referrer earns 0.
  select count(*) into v_rewarded_redemptions
    from public.referral_credits
   where referrer_id = v_referral.referrer_id
     and referrer_days > 0;

  if v_rewarded_redemptions >= 10 then
    v_referrer_days := 0;
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
      v_referrer_days,
      30
    )
    returning * into v_credit;
  exception
    when unique_violation then
      return jsonb_build_object('status', 'already_redeemed');
    when check_violation then
      -- no_self_referral backstop (F4) — unreachable via the guards above,
      -- kept so a future edit cannot silently reopen self-referral.
      return jsonb_build_object('status', 'cannot_refer_self');
  end;

  update public.referrals
     set total_redeemed = total_redeemed + 1,
         total_reward_days_granted = total_reward_days_granted + v_credit.referrer_days + v_credit.referee_days
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

comment on function public.redeem_referral_code(text) is
  'ENG-1236/ENG-1320: authenticated referral redemption RPC. Guards: self-referral (id + normalised-email alias + CHECK backstop), duplicate referee, per-referrer reward cap (10 rewarded redemptions), 24h velocity throttle (5/24h then auto-flag), row lock against concurrent races.';

commit;

notify pgrst, 'reload schema';

-- ============================================================================
-- Verification (run after push):
--   1. Columns:  select is_nullable, column_default
--                from information_schema.columns
--                where table_name='referral_credits' and column_name='reward_granted_at';
--                -- expect YES / null
--   2. FKs:      all three reference auth.users(id) on delete cascade.
--   3. Indexes:  referrals has exactly {pkey, referrals_referrer_id_unique,
--                referrals_code_upper_unique}; referral_credits has exactly
--                {pkey, referral_credits_referee_id_unique,
--                referral_credits_referrer_id_idx, referral_credits_code_idx}.
--   4. Grants:   anon has nothing on either table; authenticated has SELECT only.
--   5. RPC:      redeem a code twice from one account ⇒ already_redeemed;
--                redeem own code ⇒ cannot_refer_self; a +tag alias of the
--                referrer's email ⇒ cannot_refer_self.
-- ============================================================================
