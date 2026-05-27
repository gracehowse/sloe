-- ENG-5 — Referral mechanic.
--
-- Two tables:
--   1. `referrals`         — one row per referrer (lazy-created on first
--                            share). Holds the short code, lifetime
--                            redeemed count, and fraud flags.
--   2. `referral_credits`  — one row per (referrer, referee) pair.
--                            `reward_granted_at` stays NULL until ENG-198
--                            (RevenueCat provisioning) wires the actual
--                            30-day Pro grant; the row is the stub that
--                            proves the redeem happened and lets us backfill
--                            rewards when RC is live.
--
-- Anti-abuse invariants (enforced at the DB level):
--   • No self-referral (CHECK referrer_id ≠ referee_id)
--   • One redemption per referee (UNIQUE referee_id on referral_credits)
--   • Total lifetime rewards cap: ≤ 12 months (365 days) per user,
--     enforced as a soft column (`total_reward_days_granted`) updated by
--     the API layer — not a trigger, so the API can return a useful error.
--
-- RLS:
--   • `referrals`:        owner can SELECT own row (for share-link display).
--                         No client INSERT/UPDATE/DELETE — all writes are
--                         service-role via API routes.
--   • `referral_credits`: owner can SELECT rows where they are referrer or
--                         referee. No client writes.
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration —
-- that rewrites schema_migrations.version to NOW()).

set search_path = public;

-- ─── referrals ────────────────────────────────────────────────────────────────

create table if not exists public.referrals (
  id                        uuid        primary key default gen_random_uuid(),
  referrer_id               uuid        not null references auth.users(id) on delete cascade,
  code                      text        not null,
  created_at                timestamptz not null default now(),
  -- Running count of completed redemptions against this code.
  total_redeemed            int         not null default 0,
  -- Cumulative days of Pro credited across all referees (reward cap
  -- enforcement: 365 days / 12 months per user lifetime).
  total_reward_days_granted int         not null default 0,
  -- Set by the fraud-detection path when the code is suspended.
  flagged_at                timestamptz,
  flagged_reason            text,
  constraint referrals_code_unique unique (code),
  constraint referrals_referrer_unique unique (referrer_id)
);

comment on table public.referrals is
  'ENG-5: one row per user who has generated a referral code. Code is their shareable invite token.';

-- ─── referral_credits ─────────────────────────────────────────────────────────

create table if not exists public.referral_credits (
  id                 uuid        primary key default gen_random_uuid(),
  referrer_id        uuid        not null references auth.users(id) on delete cascade,
  referee_id         uuid        not null references auth.users(id) on delete cascade,
  code               text        not null,
  redeemed_at        timestamptz not null default now(),
  -- NULL until ENG-198 RevenueCat provisioning wires the actual Pro grant.
  reward_granted_at  timestamptz,
  -- Days of Pro credited to the referrer (default 30).
  referrer_days      int         not null default 30,
  -- Days of Pro credited to the referee (30 if new, 60 if already paid).
  referee_days       int         not null default 30,
  constraint no_self_referral check (referrer_id != referee_id),
  -- One referral redemption per referee (prevents gaming via new installs
  -- from the same account).
  constraint unique_referee unique (referee_id)
);

comment on table public.referral_credits is
  'ENG-5: one row per referee who completed onboarding via a referral link. reward_granted_at NULL until ENG-198.';

-- ─── indexes ──────────────────────────────────────────────────────────────────

create index if not exists referral_credits_referrer_idx
  on public.referral_credits (referrer_id);

create index if not exists referral_credits_code_idx
  on public.referral_credits (code);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.referrals         enable row level security;
alter table public.referral_credits  enable row level security;

-- referrals: owner can read their own row (to display their share link + stats).
create policy "referrals_select_own"
  on public.referrals for select
  using (auth.uid() = referrer_id);

-- referral_credits: user can read rows where they are referrer or referee.
create policy "referral_credits_select_own"
  on public.referral_credits for select
  using (auth.uid() = referrer_id or auth.uid() = referee_id);

-- No INSERT/UPDATE/DELETE policies — all writes go through service-role
-- API routes which bypass RLS. This means client-side Supabase calls can
-- never directly create or modify referral data.
