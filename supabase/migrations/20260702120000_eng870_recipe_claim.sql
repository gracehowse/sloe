-- ENG-870 — verified creator claim audit trail and forward-only recipe claim metadata.
-- Stage this migration for `supabase db push --linked`; do not apply via MCP.
--
-- content_origin already exists from ENG-869 (public.recipe_content_origin enum:
-- first_party | imported_stub | claimed). This migration adds claim audit columns
-- and the recipe_claims request log only — it does not recreate content_origin.

alter table public.recipes
  add column if not exists claimed_by uuid references public.profiles(id) on delete set null,
  add column if not exists claimed_at timestamptz,
  add column if not exists claim_verification jsonb;

create table if not exists public.recipe_claims (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references public.recipes(id) on delete set null,
  claimant_id uuid not null references public.profiles(id) on delete cascade,
  source_url text not null,
  status text not null default 'pending',
  verification jsonb not null default '{}'::jsonb,
  attested_at timestamptz,
  verified_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipe_claims_status_check check (status in ('pending', 'verified', 'rejected', 'withdrawn')),
  constraint recipe_claims_verified_requires_method check (
    status <> 'verified'
    or (
      verification ? 'method'
      and verification->>'method' in ('oauth_handle', 'bio_code', 'dns_meta')
      and coalesce(verification->>'source_url', '') = source_url
      and (verification->>'attestation')::boolean is true
    )
  )
);

create index if not exists recipes_claimed_by_idx on public.recipes(claimed_by) where claimed_by is not null;
create index if not exists recipes_claimed_source_url_idx on public.recipes(source_url) where content_origin = 'claimed' and published is true;
create index if not exists recipe_claims_source_url_idx on public.recipe_claims(source_url);
create index if not exists recipe_claims_claimant_status_idx on public.recipe_claims(claimant_id, status);

comment on column public.recipes.claimed_by is 'Profile that completed verified ownership claim for this official published recipe.';
comment on column public.recipes.claim_verification is 'Verified proof payload: oauth_handle, bio_code, or dns_meta plus source_url, attestation, verified_at, and evidence.';
comment on table public.recipe_claims is 'Audit/request log for post-launch verified creator recipe claims and takedown/opt-out traceability.';
