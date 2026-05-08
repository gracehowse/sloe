-- F-138 Phase 3 — vote aggregation + flag-as-bad-data + evidence URL.
--
-- Builds on Phase 1 (P0 hardening, 20260512100000_user_foods_p0_hardening.sql).
-- Three pieces in this migration:
--
--   1. Vote-count aggregation trigger — keeps user_foods.upvotes /
--      .downvotes in sync with user_food_votes inserts / updates / deletes.
--      Phase 0/1 left those columns sitting at 0; the schema existed
--      but nothing wrote to it.
--
--   2. user_food_flags table — RLS-scoped flag-as-bad-data trail with
--      a 3-distinct-flag auto-reject trigger for `pending` rows. Verified
--      rows get a `flagged_for_admin_at` stamp instead of auto-reject so
--      a malicious 3-flag swarm can't kick a vetted row out of the DB.
--
--   3. user_foods.evidence_url — optional URL into a private
--      `food-evidence` storage bucket where the submitter uploads a photo
--      of the nutrition label at submission time. Required for the
--      "Submit to database" path; ignored for "Save to my foods".
--
-- Out of scope (Phase 4+):
--   - food_corrections_log audit table
--   - Per-user submission rate limit
--   - submission_method column
--   - Trust score view + Claude-vision auto-verify
--
-- Apply path: tracked file → `supabase db push --linked` (authorised
-- per memory feedback_supabase_db_push_authorised). NEVER apply via
-- Supabase MCP — that rewrites schema_migrations.version to NOW().

-- ─────────────────────────────────────────────────────────────────────
-- 1. Vote-count aggregation
-- ─────────────────────────────────────────────────────────────────────

-- Pre-fix: `user_food_votes` rows accumulate but `user_foods.upvotes`
-- and `.downvotes` stay at zero forever, so the product card had no
-- credible "12 users confirmed these numbers" line. Post-fix: a
-- trigger on user_food_votes recomputes the counts on the parent
-- user_foods row whenever a vote is inserted, updated (vote flip), or
-- deleted.

create or replace function public.user_food_votes_recompute_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_food_id uuid;
  up_count integer;
  down_count integer;
begin
  -- Determine which user_food_id is affected. INSERT/UPDATE: NEW;
  -- DELETE: OLD. UPDATE that flips the parent (rare but possible)
  -- recomputes both — fall through to the second branch.
  target_food_id := coalesce(new.user_food_id, old.user_food_id);

  select
    coalesce(sum(case when vote = 1  then 1 else 0 end), 0),
    coalesce(sum(case when vote = -1 then 1 else 0 end), 0)
    into up_count, down_count
    from public.user_food_votes
    where user_food_id = target_food_id;

  -- Bypass the macro-reset trigger by setting the columns directly
  -- via a SECURITY DEFINER update; vote counts are not nutrition
  -- columns and must not flip a `verified` row back to pending.
  update public.user_foods
    set upvotes = up_count,
        downvotes = down_count
    where id = target_food_id;

  -- If the UPDATE moved the row to a different user_food_id (vote
  -- re-parented — pathological case, but cover it), recompute the
  -- old parent too.
  if tg_op = 'UPDATE' and old.user_food_id is distinct from new.user_food_id then
    select
      coalesce(sum(case when vote = 1  then 1 else 0 end), 0),
      coalesce(sum(case when vote = -1 then 1 else 0 end), 0)
      into up_count, down_count
      from public.user_food_votes
      where user_food_id = old.user_food_id;
    update public.user_foods
      set upvotes = up_count,
          downvotes = down_count
      where id = old.user_food_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists user_food_votes_recompute_counts_aiud on public.user_food_votes;
create trigger user_food_votes_recompute_counts_aiud
  after insert or update or delete on public.user_food_votes
  for each row execute function public.user_food_votes_recompute_counts();

-- Backfill existing vote totals so any rows that accumulated votes
-- before this trigger landed get correct counts.
do $$
declare
  fid uuid;
begin
  for fid in select distinct user_food_id from public.user_food_votes
  loop
    update public.user_foods uf
      set upvotes   = (select count(*) from public.user_food_votes v where v.user_food_id = fid and v.vote = 1),
          downvotes = (select count(*) from public.user_food_votes v where v.user_food_id = fid and v.vote = -1)
      where uf.id = fid;
  end loop;
end;
$$;

comment on function public.user_food_votes_recompute_counts() is
  'F-138 Phase 3 — keeps user_foods.upvotes / .downvotes in sync with
user_food_votes. Bypasses the macro-reset trigger (vote counts are not
nutrition columns and must not flip verified rows back to pending).';

-- ─────────────────────────────────────────────────────────────────────
-- 2. user_food_flags table + 3-flag auto-reject
-- ─────────────────────────────────────────────────────────────────────

-- Flag-as-bad-data is the reverse of upvote: if 3 distinct users flag
-- the same `pending` row, auto-set verification_status = 'rejected'.
-- For `verified` rows we don't auto-reject — the row was vetted by an
-- admin, and we want a malicious flag swarm to surface in the admin
-- queue, not silently kick the vetted row out of the public DB.

create table if not exists public.user_food_flags (
  id uuid primary key default gen_random_uuid(),
  user_food_id uuid not null references public.user_foods(id) on delete cascade,
  flagger_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default 'wrong_data'
    check (reason in ('wrong_data', 'misleading', 'duplicate', 'spam', 'other')),
  note text,
  created_at timestamptz not null default now(),
  unique (user_food_id, flagger_id)
);

create index if not exists idx_user_food_flags_user_food_id
  on public.user_food_flags (user_food_id);

alter table public.user_food_flags enable row level security;

-- Read: a user can see their own flags + admins can see everything
-- (admins use service role / bypass RLS). Public read is intentionally
-- NOT granted — flags are private signals.
drop policy if exists "Users can read their own flags" on public.user_food_flags;
create policy "Users can read their own flags"
  on public.user_food_flags for select
  to authenticated
  using (flagger_id = auth.uid());

drop policy if exists "Users can insert their own flags" on public.user_food_flags;
create policy "Users can insert their own flags"
  on public.user_food_flags for insert
  to authenticated
  with check (flagger_id = auth.uid());

-- Users can withdraw their own flag (delete the row); admins via
-- service role.
drop policy if exists "Users can delete their own flags" on public.user_food_flags;
create policy "Users can delete their own flags"
  on public.user_food_flags for delete
  to authenticated
  using (flagger_id = auth.uid());

-- Add `flagged_for_admin_at` to user_foods for the verified-row case
-- where we surface to admin instead of auto-rejecting.
alter table public.user_foods
  add column if not exists flagged_for_admin_at timestamptz;

create or replace function public.user_food_flags_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  flag_count integer;
  current_status text;
begin
  -- Recompute on the affected user_food row.
  select count(*) into flag_count
    from public.user_food_flags
    where user_food_id = coalesce(new.user_food_id, old.user_food_id);

  select verification_status into current_status
    from public.user_foods
    where id = coalesce(new.user_food_id, old.user_food_id);

  if flag_count >= 3 then
    if current_status = 'pending' then
      -- Auto-reject. The state-machine guard allows service-role /
      -- SECURITY DEFINER paths to flip verification_status without
      -- being in admin_users.
      update public.user_foods
        set verification_status = 'rejected'
        where id = coalesce(new.user_food_id, old.user_food_id);
    elsif current_status = 'verified' then
      -- Surface to admin queue without altering verification_status.
      update public.user_foods
        set flagged_for_admin_at = coalesce(flagged_for_admin_at, now())
        where id = coalesce(new.user_food_id, old.user_food_id);
    end if;
  elsif flag_count = 0 then
    -- All flags withdrawn — clear the admin-review stamp if present.
    update public.user_foods
      set flagged_for_admin_at = null
      where id = coalesce(new.user_food_id, old.user_food_id);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists user_food_flags_after_change_aid on public.user_food_flags;
create trigger user_food_flags_after_change_aid
  after insert or delete on public.user_food_flags
  for each row execute function public.user_food_flags_after_change();

comment on table public.user_food_flags is
  'F-138 Phase 3 — flag-as-bad-data signals on user_foods rows. Three
distinct flags on a `pending` row auto-reject it; on a `verified` row,
stamp flagged_for_admin_at so the admin queue picks it up without
silently kicking the vetted row out of the public DB.';

-- ─────────────────────────────────────────────────────────────────────
-- 3. evidence_url + private storage bucket
-- ─────────────────────────────────────────────────────────────────────

-- The "Submit to database" path requires a label photo. The mobile /
-- web client uploads to a private `food-evidence` bucket and stamps
-- the resulting object URL onto user_foods.evidence_url. The
-- "Save to my foods" path leaves it null.

alter table public.user_foods
  add column if not exists evidence_url text;

-- Optional sanity check — must be a relative storage path, not a
-- public URL (we don't want random web URLs sneaking in).
alter table public.user_foods
  drop constraint if exists user_foods_evidence_url_shape;
alter table public.user_foods
  add constraint user_foods_evidence_url_shape
    check (
      evidence_url is null
      or (length(evidence_url) <= 512 and evidence_url not like 'http%')
    );

-- Create the private bucket. `public = false` ensures objects are not
-- accessible without a signed URL. Idempotent via on conflict.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'food-evidence',
    'food-evidence',
    false,
    -- 6 MB ceiling matches the photo-log endpoint cap.
    6 * 1024 * 1024,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  )
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS — owners can write under `{user_id}/...` and read their
-- own uploads back; admins use service role / signed URLs. No public
-- read policy.
drop policy if exists "Users can upload food-evidence under their uid prefix" on storage.objects;
create policy "Users can upload food-evidence under their uid prefix"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'food-evidence'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can read their own food-evidence" on storage.objects;
create policy "Users can read their own food-evidence"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'food-evidence'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete their own food-evidence" on storage.objects;
create policy "Users can delete their own food-evidence"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'food-evidence'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

comment on column public.user_foods.evidence_url is
  'F-138 Phase 3 — relative path into the private food-evidence storage
bucket. Required for "Submit to database" submissions; null for
"Save to my foods" submissions.';
