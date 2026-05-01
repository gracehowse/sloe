-- DMCA takedown requests submitted via /dmca form or POST /api/dmca-takedown.
--
-- Why this table exists:
--   The IG/TT/YouTube share-sheet caption import path (gated by
--   `IG_TT_IMPORT_ENABLED`, default OFF) requires a working notice-and-action
--   channel before any user can hit it. See
--   `docs/decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md`.
--
--   This migration stages the storage. The IG/TT feature flag stays OFF in
--   production until the Suppr DMCA designated agent is registered with the
--   US Copyright Office and `legal-reviewer` signs off on the form copy.
--
-- Service-role-only RLS:
--   The form on /dmca submits via the public POST /api/dmca-takedown route,
--   which uses the service-role Supabase client to insert (because the
--   reporter does NOT need a Suppr account). RLS denies all anon/authenticated
--   reads + writes — the table is exclusively backend-mediated. No user can
--   read other users' takedown requests or list their own.

create table if not exists public.dmca_takedowns (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  reporter_email text not null check (length(reporter_email) <= 200),
  original_post_url text not null check (length(original_post_url) <= 2000),
  suppr_recipe_id text,
  description text check (description is null or length(description) <= 5000),
  status text not null default 'received' check (status in ('received', 'reviewed', 'actioned', 'dismissed')),
  reviewed_at timestamptz,
  reviewer_notes text,
  -- Network metadata captured at submission time for abuse-defence + audit.
  -- Stored separate from `description` so reviewers don't have to scrub
  -- the freeform text for these fields.
  reporter_ip text,
  reporter_user_agent text
);

-- Useful for the reviewer console to filter open work.
create index if not exists dmca_takedowns_status_submitted_idx
  on public.dmca_takedowns (status, submitted_at desc);

alter table public.dmca_takedowns enable row level security;

-- "service_role_only" — anon and authenticated roles see nothing, can write
-- nothing. The service-role key bypasses RLS so the API route can still
-- insert. Drop existing policy of the same name first to keep the migration
-- idempotent in case it's re-run.
drop policy if exists "dmca_takedowns_service_role_only" on public.dmca_takedowns;
create policy "dmca_takedowns_service_role_only"
  on public.dmca_takedowns
  for all
  to public
  using (false)
  with check (false);

comment on table public.dmca_takedowns is
  'Copyright takedown requests submitted at /dmca. Service-role write only; reviewers process via admin tooling.';
