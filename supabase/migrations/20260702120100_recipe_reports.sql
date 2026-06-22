-- Recipe content reports (non-copyright) submitted via the per-recipe
-- "Report an issue" sheet → POST /api/recipe-report.
--
-- Why this table exists (ENG-1225 #19, launch gate):
--   Copyright claims have their own statutory channel (`dmca_takedowns`).
--   Everything else — incorrect nutrition, inappropriate/unsafe content — needs
--   a DURABLE, logged, traceable reporting mechanism before user-generated /
--   imported recipe content goes live to the public. legal-reviewer flagged an
--   email-only fallback as inadequate under the UK Online Safety Act / EU DSA
--   once imported third-party content is live (the same gate as the IG/TT
--   import flag `IG_TT_IMPORT_ENABLED`). This stages that queue.
--   See docs/decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md.
--
-- Service-role-only RLS (mirrors `dmca_takedowns`):
--   The sheet submits via the POST /api/recipe-report route using the
--   service-role client. RLS denies all anon/authenticated reads + writes —
--   reviewers process via admin tooling. No user can read others' reports.

create table if not exists public.recipe_reports (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  -- The reported recipe (id or share link). Required — a report with no target
  -- is unactionable.
  suppr_recipe_id text not null check (length(suppr_recipe_id) <= 200),
  -- Non-copyright reasons only; copyright is routed to dmca_takedowns instead.
  reason text not null check (reason in ('incorrect', 'unsafe', 'other')),
  description text check (description is null or length(description) <= 5000),
  status text not null default 'received' check (status in ('received', 'reviewed', 'actioned', 'dismissed')),
  reviewed_at timestamptz,
  reviewer_notes text,
  -- Network metadata for abuse defence + audit (a spammed-report attack would
  -- otherwise be cheap). Stored separate from `description` so reviewers don't
  -- scrub the freeform text for these.
  reporter_ip text,
  reporter_user_agent text
);

-- Reviewer console: filter open work, newest first.
create index if not exists recipe_reports_status_submitted_idx
  on public.recipe_reports (status, submitted_at desc);
-- Spot every report against one recipe (e.g. a recipe drawing many flags).
create index if not exists recipe_reports_recipe_idx
  on public.recipe_reports (suppr_recipe_id, submitted_at desc);

alter table public.recipe_reports enable row level security;

-- "service_role_only" — anon + authenticated see/write nothing; the
-- service-role key bypasses RLS so the API route can insert. Idempotent.
drop policy if exists "recipe_reports_service_role_only" on public.recipe_reports;
create policy "recipe_reports_service_role_only"
  on public.recipe_reports
  for all
  to public
  using (false)
  with check (false);

comment on table public.recipe_reports is
  'Non-copyright recipe content reports submitted via the in-app Report sheet. Service-role write only; reviewers process via admin tooling. Copyright → dmca_takedowns.';
