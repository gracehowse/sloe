-- F-138 Phase 1 (P0 schema hardening): the user_foods table goes from
-- "correction-suggestion box" to "real verified food database" by closing
-- the gaps the data-integrity audit flagged in
-- `docs/decisions/2026-05-08-food-correction-verification-pipeline.md`.
--
-- Five P0 items in this migration:
--   1. Numeric + structural constraint pack (sanity bounds on every column)
--   2. SELECT RLS tightened (verified-or-own only — no leaking pending rows)
--   3. UPDATE state-machine guard (no self-promotion to verified)
--   4. Trigger to reset verification_status when nutrition columns change
--   5. verified_food_canonical projection (one row per barcode FK to the
--      best chosen submission)
--
-- Out of scope (later phases):
--   - Audit log table
--   - Rate limiting trigger
--   - Cross-submission consensus job
--   - Vote-count aggregation triggers
--   - Submission method / evidence URL columns

-- ─────────────────────────────────────────────────────────────────────
-- 1. Numeric + structural constraints
-- ─────────────────────────────────────────────────────────────────────

-- Drop any pre-existing constraints first (idempotent re-runs). Names
-- are explicit so PG can find them on the second run.
alter table public.user_foods
  drop constraint if exists user_foods_calories_bounds,
  drop constraint if exists user_foods_protein_bounds,
  drop constraint if exists user_foods_carbs_bounds,
  drop constraint if exists user_foods_fat_bounds,
  drop constraint if exists user_foods_fiber_bounds,
  drop constraint if exists user_foods_sugar_bounds,
  drop constraint if exists user_foods_sodium_bounds,
  drop constraint if exists user_foods_satfat_bounds,
  drop constraint if exists user_foods_serving_size_bounds,
  drop constraint if exists user_foods_barcode_length,
  drop constraint if exists user_foods_name_nonempty,
  drop constraint if exists user_foods_sugar_le_carbs,
  drop constraint if exists user_foods_satfat_le_fat,
  drop constraint if exists user_foods_fiber_le_carbs;

-- Numeric range bounds. Tight ceilings catch typos / unit errors at
-- write time. Pure fat tops out at ~884 kcal/100g — set the hard
-- ceiling above that so legitimate edge cases (e.g. ghee, oils) pass.
-- Sodium can hit 38758 mg/100g (pure salt) but anything above 50000
-- is a unit error.
alter table public.user_foods
  add constraint user_foods_calories_bounds
    check (calories is null or (calories >= 0 and calories <= 2000)),
  add constraint user_foods_protein_bounds
    check (protein is null or (protein >= 0 and protein <= 100)),
  add constraint user_foods_carbs_bounds
    check (carbs is null or (carbs >= 0 and carbs <= 100)),
  add constraint user_foods_fat_bounds
    check (fat is null or (fat >= 0 and fat <= 100)),
  add constraint user_foods_fiber_bounds
    check (fiber_g is null or (fiber_g >= 0 and fiber_g <= 100)),
  add constraint user_foods_sugar_bounds
    check (sugar_g is null or (sugar_g >= 0 and sugar_g <= 100)),
  add constraint user_foods_sodium_bounds
    check (sodium_mg is null or (sodium_mg >= 0 and sodium_mg <= 50000)),
  add constraint user_foods_satfat_bounds
    check (saturated_fat_g is null or (saturated_fat_g >= 0 and saturated_fat_g <= 100)),
  add constraint user_foods_serving_size_bounds
    check (serving_size_g is null or (serving_size_g > 0 and serving_size_g <= 5000)),
  add constraint user_foods_barcode_length
    check (length(barcode) between 8 and 14),
  add constraint user_foods_name_nonempty
    check (length(trim(name)) > 0),
  -- Subset relationships. Tolerance: 0.5g for sugar/fiber, 0.2g for
  -- saturated fat (matches the nutrition-engine plausibility ruleset).
  add constraint user_foods_sugar_le_carbs
    check (sugar_g is null or carbs is null or sugar_g <= carbs + 0.5),
  add constraint user_foods_satfat_le_fat
    check (saturated_fat_g is null or fat is null or saturated_fat_g <= fat + 0.2),
  add constraint user_foods_fiber_le_carbs
    check (fiber_g is null or carbs is null or fiber_g <= carbs + 0.5);

-- ─────────────────────────────────────────────────────────────────────
-- 2. RLS — SELECT tightened
-- ─────────────────────────────────────────────────────────────────────

-- Pre-fix: every authed user could read every pending row → mid-edit
-- typo garbage leaked into other users' barcode lookups. Post-fix:
-- verified rows are public to authed users; pending/rejected rows are
-- visible only to their submitter (and to admins via service role).
drop policy if exists "Authenticated users can read user foods" on public.user_foods;
drop policy if exists "Authenticated users can read verified or own user foods" on public.user_foods;

create policy "Authenticated users can read verified or own user foods"
  on public.user_foods for select
  to authenticated
  using (
    verification_status = 'verified'
    or submitted_by = auth.uid()
  );

-- ─────────────────────────────────────────────────────────────────────
-- 3. UPDATE state-machine guard
-- ─────────────────────────────────────────────────────────────────────

-- Pre-fix: an owner could flip their own row from pending → verified
-- via UPDATE because RLS only checked submitted_by. Post-fix: a trigger
-- raises if the verification_status transitions and the actor is not
-- in the admin_users table. (A separate `admin_users` table is created
-- below so the gate has somewhere to look.)

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  note text
);

alter table public.admin_users enable row level security;

-- Only service-role can write to admin_users. No user-facing write policy.
-- Reading is allowed for the user themselves so they can see if they're
-- an admin (e.g. for client-side UI gating).
create policy "Users can read their own admin_users row"
  on public.admin_users for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.user_foods_guard_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification_status is distinct from old.verification_status then
    -- Only admins can change verification_status. NULL auth.uid()
    -- means service-role / postgres role, which is allowed (used by
    -- pg_cron consensus job + admin SQL).
    if auth.uid() is not null
       and not exists (select 1 from public.admin_users where user_id = auth.uid()) then
      raise exception 'Only admins can change verification_status (got % → %)',
        old.verification_status, new.verification_status
        using errcode = '42501';
    end if;
    -- Auto-stamp verified_at / verified_by on the verified transition.
    if new.verification_status = 'verified' and old.verification_status <> 'verified' then
      new.verified_at := now();
      new.verified_by := coalesce(new.verified_by, auth.uid());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists user_foods_guard_status_transition on public.user_foods;
create trigger user_foods_guard_status_transition
  before update on public.user_foods
  for each row execute function public.user_foods_guard_status_transition();

-- ─────────────────────────────────────────────────────────────────────
-- 4. Reset verification_status on nutrition-column edits
-- ─────────────────────────────────────────────────────────────────────

-- Pre-fix: an owner could edit calories on a row that was already
-- verified by an admin and the verified flag stayed put → vandalism
-- vector. Post-fix: any change to nutrition columns reverts the row
-- to pending + clears the verified_at / verified_by stamps. Admin
-- has to re-verify the new values.

create or replace function public.user_foods_reset_verification_on_macro_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  macro_changed boolean;
begin
  macro_changed :=
    new.calories       is distinct from old.calories
    or new.protein     is distinct from old.protein
    or new.carbs       is distinct from old.carbs
    or new.fat         is distinct from old.fat
    or new.fiber_g     is distinct from old.fiber_g
    or new.sugar_g     is distinct from old.sugar_g
    or new.sodium_mg   is distinct from old.sodium_mg
    or new.saturated_fat_g is distinct from old.saturated_fat_g
    or new.serving_size_g is distinct from old.serving_size_g
    or new.name        is distinct from old.name;

  -- Don't reset if the only change IS the verification_status flip
  -- itself (admin verifying). Also don't fire on the verified-stamping
  -- in the previous trigger.
  if macro_changed and new.verification_status = 'verified' and old.verification_status = 'verified' then
    new.verification_status := 'pending';
    new.verified_at := null;
    new.verified_by := null;
  end if;

  -- Always bump updated_at on any update (covers admin-only writes
  -- that bypass the client's updated_at field).
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_foods_reset_verification_on_macro_edit on public.user_foods;
create trigger user_foods_reset_verification_on_macro_edit
  before update on public.user_foods
  for each row execute function public.user_foods_reset_verification_on_macro_edit();

-- ─────────────────────────────────────────────────────────────────────
-- 5. verified_food_canonical projection
-- ─────────────────────────────────────────────────────────────────────

-- One row per barcode containing the canonical values. Computed from
-- the best user_foods row (verified > top-upvoted > most-recent). The
-- read path becomes a single PK lookup instead of "fetch top 5, sort
-- in app code, pick the best". A foreign key to the source
-- user_foods.id lets us audit which submission the canonical points
-- to.

create table if not exists public.verified_food_canonical (
  barcode text primary key,
  source_user_food_id uuid references public.user_foods(id) on delete set null,
  name text not null,
  calories numeric not null,
  protein numeric not null,
  carbs numeric not null,
  fat numeric not null,
  fiber_g numeric not null default 0,
  sugar_g numeric,
  sodium_mg numeric,
  saturated_fat_g numeric,
  serving_size_g numeric not null default 100,
  -- "consensus_method" tracks how the canonical was chosen so we can
  -- surface a confidence badge in the UI (e.g. "verified by 3 users"
  -- vs "single submission, awaiting confirmation").
  consensus_method text not null default 'single_verified'
    check (consensus_method in ('single_verified', 'cross_user_consensus', 'admin_verified', 'auto_vision_verified')),
  consensus_confidence numeric not null default 1.0
    check (consensus_confidence between 0 and 1),
  last_recomputed_at timestamptz not null default now(),
  -- Match the same constraint set as user_foods so the projection
  -- can never diverge from valid bounds.
  constraint vfc_calories_bounds check (calories >= 0 and calories <= 2000),
  constraint vfc_protein_bounds check (protein >= 0 and protein <= 100),
  constraint vfc_carbs_bounds check (carbs >= 0 and carbs <= 100),
  constraint vfc_fat_bounds check (fat >= 0 and fat <= 100),
  constraint vfc_sodium_bounds check (sodium_mg is null or sodium_mg between 0 and 50000),
  constraint vfc_satfat_le_fat check (saturated_fat_g is null or saturated_fat_g <= fat + 0.2),
  constraint vfc_sugar_le_carbs check (sugar_g is null or sugar_g <= carbs + 0.5),
  constraint vfc_fiber_le_carbs check (fiber_g <= carbs + 0.5)
);

alter table public.verified_food_canonical enable row level security;

-- Public read for authed users (this is the canonical "verified"
-- table — that's the whole point).
create policy "Authenticated users can read canonical verified foods"
  on public.verified_food_canonical for select
  to authenticated using (true);

-- Only service-role / admins can write. No user-facing write policy.
create policy "Admins can upsert canonical verified foods"
  on public.verified_food_canonical for all
  to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

create index if not exists idx_vfc_source_user_food on public.verified_food_canonical (source_user_food_id);

-- Recompute function — called from the verification trigger when a row
-- becomes verified, and from the cross-submission consensus job (later
-- phase). Picks the best user_foods row for the given barcode and
-- upserts the canonical projection. Idempotent.

create or replace function public.recompute_verified_food_canonical(p_barcode text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  best record;
begin
  select uf.*
    into best
    from public.user_foods uf
   where uf.barcode = p_barcode
     and uf.verification_status = 'verified'
   order by uf.upvotes desc nulls last,
            uf.verified_at desc nulls last,
            uf.updated_at desc
   limit 1;

  if not found then
    -- No verified row → drop any stale canonical entry. This is
    -- important: if all verified rows for a barcode get rejected, the
    -- canonical must disappear so lookupBarcode falls through to OFF.
    delete from public.verified_food_canonical where barcode = p_barcode;
    return;
  end if;

  insert into public.verified_food_canonical (
    barcode, source_user_food_id, name, calories, protein, carbs, fat,
    fiber_g, sugar_g, sodium_mg, saturated_fat_g, serving_size_g,
    consensus_method, consensus_confidence, last_recomputed_at
  ) values (
    p_barcode, best.id, best.name, best.calories, best.protein, best.carbs, best.fat,
    coalesce(best.fiber_g, 0), best.sugar_g, best.sodium_mg, best.saturated_fat_g,
    coalesce(best.serving_size_g, 100),
    'single_verified', 1.0, now()
  )
  on conflict (barcode) do update set
    source_user_food_id = excluded.source_user_food_id,
    name = excluded.name,
    calories = excluded.calories,
    protein = excluded.protein,
    carbs = excluded.carbs,
    fat = excluded.fat,
    fiber_g = excluded.fiber_g,
    sugar_g = excluded.sugar_g,
    sodium_mg = excluded.sodium_mg,
    saturated_fat_g = excluded.saturated_fat_g,
    serving_size_g = excluded.serving_size_g,
    last_recomputed_at = now();
end;
$$;

-- Auto-recompute trigger — fires after any row transitions to/from
-- verified. Keeps the canonical projection in sync without a cron job.

create or replace function public.user_foods_after_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only act on status transitions involving `verified` in either
  -- direction. Ignores macro edits (those don't affect the verified
  -- pool because the reset trigger flips them back to pending).
  if (tg_op = 'INSERT' and new.verification_status = 'verified')
     or (tg_op = 'UPDATE'
         and (old.verification_status = 'verified' or new.verification_status = 'verified')
         and old.verification_status is distinct from new.verification_status)
     or (tg_op = 'DELETE' and old.verification_status = 'verified') then
    perform public.recompute_verified_food_canonical(coalesce(old.barcode, new.barcode));
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists user_foods_after_status_change on public.user_foods;
create trigger user_foods_after_status_change
  after insert or update or delete on public.user_foods
  for each row execute function public.user_foods_after_status_change();

-- Backfill: populate the canonical table for any barcodes that
-- already have verified rows. One-shot at migration time.
do $$
declare
  bc text;
begin
  for bc in select distinct barcode from public.user_foods where verification_status = 'verified'
  loop
    perform public.recompute_verified_food_canonical(bc);
  end loop;
end;
$$;

comment on table public.verified_food_canonical is
  'F-138 Phase 1 — canonical verified food per barcode. Maintained by the
recompute_verified_food_canonical(text) function via after-update trigger
on user_foods. Read-path: lookupBarcode hits this table first via PK
lookup, then falls back to user_foods (owner pending), then OFF.';

comment on function public.recompute_verified_food_canonical(text) is
  'F-138 Phase 1 — pick the best verified user_foods row for the given
barcode and upsert it into verified_food_canonical. Idempotent; deletes
the canonical row if no verified submission exists.';

comment on table public.admin_users is
  'F-138 Phase 1 — gate for verification_status transitions. Only users
in this table can flip user_foods.verification_status (or write to
verified_food_canonical directly). Service-role bypasses this guard for
automation (consensus job, vision auto-verify).';
