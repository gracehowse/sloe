-- Expand user_foods with verification status, votes, and source tracking.
-- This enables a community food database where users submit items,
-- other users can upvote/downvote, and the team can verify entries.

-- Verification status: pending (new submission), verified (team-approved), rejected
alter table public.user_foods
  add column if not exists verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  add column if not exists verified_by uuid references auth.users(id) on delete set null,
  add column if not exists verified_at timestamptz,
  add column if not exists upvotes integer not null default 0,
  add column if not exists downvotes integer not null default 0,
  add column if not exists source text default 'user'
    check (source in ('user', 'open_food_facts', 'usda', 'nutritionix', 'import')),
  add column if not exists brand text,
  add column if not exists category text,
  add column if not exists image_url text,
  add column if not exists sugar_g numeric default 0,
  add column if not exists sodium_mg numeric default 0;

-- Unique constraint: one submission per barcode per user (prevents duplicates)
-- Users can update their own but can't create multiple entries for the same barcode
create unique index if not exists idx_user_foods_barcode_user
  on public.user_foods (barcode, submitted_by);

-- Fast lookup for verified foods (these are prioritised in search)
create index if not exists idx_user_foods_verified
  on public.user_foods (barcode) where verification_status = 'verified';

-- Votes table — tracks who voted on what to prevent double-voting
create table if not exists public.user_food_votes (
  id uuid primary key default gen_random_uuid(),
  user_food_id uuid not null references public.user_foods(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)), -- -1 = downvote, 1 = upvote
  created_at timestamptz not null default now(),
  unique (user_food_id, voter_id)
);

alter table public.user_food_votes enable row level security;

create policy "Authenticated users can read votes"
  on public.user_food_votes for select
  to authenticated using (true);

create policy "Users can insert own votes"
  on public.user_food_votes for insert
  to authenticated with check (voter_id = auth.uid());

create policy "Users can update own votes"
  on public.user_food_votes for update
  to authenticated using (voter_id = auth.uid());

create policy "Users can delete own votes"
  on public.user_food_votes for delete
  to authenticated using (voter_id = auth.uid());
