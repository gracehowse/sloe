-- Household meal planning: Phase 1 ("read-only shared dinner list + remaining macros")
--   - One household per user (owner creates, invites members)
--   - Members see shared dinner plan + their own remaining macros
--   - Owner can add/edit household meals; members can view and log from them
--
-- Tables are created first, then cross-referencing RLS policies,
-- because household policies reference household_members and vice versa.

-- `gen_random_bytes` lives in pgcrypto; some prod DBs never ran schema bootstrap that enables it.
create extension if not exists "pgcrypto" with schema extensions;

-- ────────── 1. Create all tables ──────────

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Household',
  owner_id uuid not null references auth.users(id) on delete cascade,
  invite_code text unique not null default encode(extensions.gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_households_owner on public.households (owner_id);
alter table public.households enable row level security;

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  display_name text,
  joined_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create index if not exists idx_household_members_user on public.household_members (user_id);
create index if not exists idx_household_members_household on public.household_members (household_id);
alter table public.household_members enable row level security;

create table if not exists public.household_meals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  date_key text not null, -- YYYY-MM-DD
  meal_label text not null default 'Dinner', -- Breakfast, Lunch, Dinner, Snack
  recipe_title text not null,
  recipe_id uuid references public.recipes(id) on delete set null,
  servings integer not null default 4,
  calories_per_serving integer,
  protein_per_serving numeric,
  carbs_per_serving numeric,
  fat_per_serving numeric,
  fiber_per_serving numeric,
  notes text,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_household_meals_household_date on public.household_meals (household_id, date_key);
alter table public.household_meals enable row level security;

-- ────────── 2. RLS policies (all tables exist now) ──────────

-- Households
create policy "Household owner full access"
  on public.households for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Household members can read"
  on public.households for select
  to authenticated
  using (
    id in (select household_id from public.household_members where user_id = auth.uid())
  );

-- Household Members
create policy "Members can read household members"
  on public.household_members for select
  to authenticated
  using (
    household_id in (select household_id from public.household_members hm where hm.user_id = auth.uid())
  );

create policy "Owner can manage members"
  on public.household_members for all
  to authenticated
  using (
    household_id in (select id from public.households where owner_id = auth.uid())
  )
  with check (
    household_id in (select id from public.households where owner_id = auth.uid())
  );

create policy "Users can join households"
  on public.household_members for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can leave households"
  on public.household_members for delete
  to authenticated
  using (user_id = auth.uid());

-- Household Meals
create policy "Members can read household meals"
  on public.household_meals for select
  to authenticated
  using (
    household_id in (select household_id from public.household_members where user_id = auth.uid())
  );

create policy "Members can add household meals"
  on public.household_meals for insert
  to authenticated
  with check (
    household_id in (select household_id from public.household_members where user_id = auth.uid())
    and added_by = auth.uid()
  );

create policy "Creator or owner can update meals"
  on public.household_meals for update
  to authenticated
  using (
    added_by = auth.uid()
    or household_id in (select id from public.households where owner_id = auth.uid())
  );

create policy "Creator or owner can delete meals"
  on public.household_meals for delete
  to authenticated
  using (
    added_by = auth.uid()
    or household_id in (select id from public.households where owner_id = auth.uid())
  );

-- ────────── 3. Link profiles ──────────

alter table public.profiles
  add column if not exists household_id uuid references public.households(id) on delete set null;

NOTIFY pgrst, 'reload schema';
