-- User-contributed food database for barcode corrections and manual barcode entries.
-- When a user scans a barcode and the data is wrong or missing, they can submit
-- corrected/new nutrition info which is stored here. Future lookups check this table
-- first before falling back to Open Food Facts.

create table if not exists public.user_foods (
  id uuid primary key default gen_random_uuid(),
  barcode text not null,
  name text not null,
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  fiber_g numeric default 0,
  serving_size_g numeric default 100,
  submitted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for fast barcode lookups
create index if not exists idx_user_foods_barcode on public.user_foods (barcode);

-- RLS
alter table public.user_foods enable row level security;

-- Anyone authenticated can read user foods
create policy "Authenticated users can read user foods"
  on public.user_foods for select
  to authenticated
  using (true);

-- Users can insert their own contributions
create policy "Users can insert user foods"
  on public.user_foods for insert
  to authenticated
  with check (submitted_by = auth.uid());

-- Users can update their own submissions
create policy "Users can update own user foods"
  on public.user_foods for update
  to authenticated
  using (submitted_by = auth.uid());
