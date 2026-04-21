-- health_snapshots — append-only log of the four HealthKit metrics the
-- Apple Health card surfaces (Steps / Active energy / Resting burn /
-- Weight). Written by the iOS app after each successful HealthKit fetch;
-- read by the web Progress → Apple Health card via
-- `getLatestHealthSnapshot(userId)`.
--
-- Design brief: docs/design/apple-health-card.md (D4, Option 2).
--
-- ─── Shape ────────────────────────────────────────────────────────────
-- Append-only, not upsert-in-place — we want a short history so we can
-- show a stale note ("last synced 3d ago") on web without joining back
-- to `profiles`, and so a future debug surface can show how the four
-- numbers evolved. The latest-only read is served by an index-backed
-- `(user_id, captured_at desc) limit 1` query, not a view, so we don't
-- accrete view DDL per metric.
--
-- ─── Values ───────────────────────────────────────────────────────────
-- `steps`, `active_energy_kcal`, `resting_burn_kcal` are nullable —
-- HealthKit may return some buckets for a given fetch but not others,
-- and the card renders em-dash for the missing rows rather than lying
-- about a zero. `weight_kg` is likewise nullable because weigh-ins are
-- sparse. `source` defaults to `'healthkit'` so a future non-Apple
-- source (e.g. Health Connect on Android) can coexist without the
-- column needing a backfill. `device_id` is whatever stable identifier
-- the client can produce (expo-device `Device.osInternalBuildId` today)
-- so a user with two iPhones doesn't pathologically overwrite.
--
-- ─── RLS ──────────────────────────────────────────────────────────────
-- Owner SELECT + INSERT only. No UPDATE, no DELETE from the client —
-- rows are immutable snapshots; corrections happen by writing a new
-- row. The service-role client still has full access for any future
-- backend repair.

create table if not exists public.health_snapshots (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  captured_at timestamptz not null default now(),
  steps integer,
  active_energy_kcal integer,
  resting_burn_kcal integer,
  weight_kg numeric(6, 2),
  source text not null default 'healthkit',
  device_id text,
  created_at timestamptz not null default now()
);

-- Latest-first lookup for `getLatestHealthSnapshot(userId)` — the web
-- card's hot path. `desc` matches the ORDER BY used by the reader so
-- Postgres can stop after the first row.
create index if not exists health_snapshots_user_captured_desc_idx
  on public.health_snapshots (user_id, captured_at desc);

alter table public.health_snapshots enable row level security;

create policy "health_snapshots_owner_select"
  on public.health_snapshots
  for select
  using (auth.uid() = user_id);

create policy "health_snapshots_owner_insert"
  on public.health_snapshots
  for insert
  with check (auth.uid() = user_id);

comment on table public.health_snapshots is
  'Append-only log of HealthKit snapshots written by the iOS app. Read by the web Apple Health card (Progress).';
comment on column public.health_snapshots.captured_at is
  'Wall-clock moment the iOS app read HealthKit. Drives the web card''s "last synced" label.';
comment on column public.health_snapshots.steps is
  'Steps reported by HealthKit for the capture day. NULL when HealthKit returned no samples; zero means the device reported zero.';
comment on column public.health_snapshots.active_energy_kcal is
  'Active energy kcal for the capture day. NULL when the read failed or the type was not granted.';
comment on column public.health_snapshots.resting_burn_kcal is
  'Basal / resting energy kcal for the capture day. NULL when the read failed or the type was not granted.';
comment on column public.health_snapshots.weight_kg is
  'Latest synced body weight in kg. NULL when the user has never logged a weight.';
comment on column public.health_snapshots.source is
  'Origin of the snapshot — currently always `healthkit`. Reserved for Health Connect / manual future sources.';
comment on column public.health_snapshots.device_id is
  'Stable device identifier so multi-device users don''t produce drift-y snapshots.';
