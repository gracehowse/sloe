-- Platemate Phase 0 schema (minimal)
-- Apply in Supabase SQL editor (Dashboard) or via CLI later.

-- Extensions
create extension if not exists "pgcrypto";

-- Profiles (one row per auth user)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  display_name text,
  avatar_url text,
  user_tier text not null default 'free' check (user_tier in ('free','base','pro')),
  sex text check (sex in ('female','male')),
  age int,
  height_cm int,
  weight_kg int,
  activity_level text check (activity_level in ('sedentary','light','moderate','active','very_active')),
  goal text check (goal in ('cut','maintain','bulk')),
  dietary jsonb,
  measurement_system text check (measurement_system in ('metric','imperial')),
  -- macro targets (manual for now; we can add calculated fields later)
  target_calories int,
  target_protein int,
  target_carbs int,
  target_fat int
);

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_select_own'
  ) then
    create policy "profiles_select_own"
    on public.profiles for select
    using (auth.uid() = id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_insert_own'
  ) then
    create policy "profiles_insert_own"
    on public.profiles for insert
    with check (auth.uid() = id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_update_own'
  ) then
    create policy "profiles_update_own"
    on public.profiles for update
    using (auth.uid() = id)
    with check (auth.uid() = id);
  end if;
end $$;

-- Creators (Phase 0: lightweight; can expand in Phase 2)
create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  handle text not null unique,
  display_name text not null,
  avatar_url text,
  bio text,
  is_verified boolean not null default false
);

alter table public.creators enable row level security;
-- public read (needed for browsing creator library)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'creators'
      and policyname = 'creators_select_public'
  ) then
    create policy "creators_select_public"
    on public.creators for select
    using (true);
  end if;
end $$;

-- Recipes
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  creator_id uuid references public.creators(id) on delete set null,
  title text not null,
  image_url text,
  servings int not null default 1,
  is_verified boolean not null default true,
  creator_calories int,
  calories int not null default 0,
  protein int not null default 0,
  carbs int not null default 0,
  fat int not null default 0
);

create index if not exists recipes_creator_id_idx on public.recipes(creator_id);

alter table public.recipes enable row level security;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'recipes'
      and policyname = 'recipes_select_public'
  ) then
    create policy "recipes_select_public"
    on public.recipes for select
    using (true);
  end if;
end $$;

-- Ingredients (cataloged items; Phase 0: simple)
create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  brand text,
  source text not null default 'USDA' check (source in ('OpenFoodFacts','Nutritionix','USDA','Manual')),
  external_id text,
  barcode text,
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  unique (source, external_id)
);

alter table public.ingredients enable row level security;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ingredients'
      and policyname = 'ingredients_select_public'
  ) then
    create policy "ingredients_select_public"
    on public.ingredients for select
    using (true);
  end if;
end $$;

-- Recipe ingredient rows (amounts + snapshot macros)
create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id) on delete set null,
  name text not null,
  amount numeric,
  unit text,
  -- snapshot per-row totals (for speed; can be recomputed later)
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  is_verified boolean not null default true,
  source text
);

create index if not exists recipe_ingredients_recipe_id_idx on public.recipe_ingredients(recipe_id);

alter table public.recipe_ingredients enable row level security;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'recipe_ingredients'
      and policyname = 'recipe_ingredients_select_public'
  ) then
    create policy "recipe_ingredients_select_public"
    on public.recipe_ingredients for select
    using (true);
  end if;
end $$;

-- Saves (user ↔ recipe)
create table if not exists public.saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create index if not exists saves_user_id_created_at_idx on public.saves(user_id, created_at desc);

alter table public.saves enable row level security;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'saves'
      and policyname = 'saves_select_own'
  ) then
    create policy "saves_select_own"
    on public.saves for select
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'saves'
      and policyname = 'saves_insert_own'
  ) then
    create policy "saves_insert_own"
    on public.saves for insert
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'saves'
      and policyname = 'saves_delete_own'
  ) then
    create policy "saves_delete_own"
    on public.saves for delete
    using (auth.uid() = user_id);
  end if;
end $$;

-- Meal plan (per user, JSON for Phase 0)
create table if not exists public.meal_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  plan jsonb
);

alter table public.meal_plans enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'meal_plans'
      and policyname = 'meal_plans_select_own'
  ) then
    create policy "meal_plans_select_own"
    on public.meal_plans for select
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'meal_plans'
      and policyname = 'meal_plans_insert_own'
  ) then
    create policy "meal_plans_insert_own"
    on public.meal_plans for insert
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'meal_plans'
      and policyname = 'meal_plans_update_own'
  ) then
    create policy "meal_plans_update_own"
    on public.meal_plans for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end $$;

-- Nutrition journal (per user, JSON for Phase 0)
create table if not exists public.nutrition_journals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  by_day jsonb not null default '{}'::jsonb
);

alter table public.nutrition_journals enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'nutrition_journals'
      and policyname = 'nutrition_journals_select_own'
  ) then
    create policy "nutrition_journals_select_own"
    on public.nutrition_journals for select
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'nutrition_journals'
      and policyname = 'nutrition_journals_insert_own'
  ) then
    create policy "nutrition_journals_insert_own"
    on public.nutrition_journals for insert
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'nutrition_journals'
      and policyname = 'nutrition_journals_update_own'
  ) then
    create policy "nutrition_journals_update_own"
    on public.nutrition_journals for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end $$;

-- Follows (user ↔ creator)
create table if not exists public.follows (
  user_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, creator_id)
);

alter table public.follows enable row level security;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'follows'
      and policyname = 'follows_select_own'
  ) then
    create policy "follows_select_own"
    on public.follows for select
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'follows'
      and policyname = 'follows_insert_own'
  ) then
    create policy "follows_insert_own"
    on public.follows for insert
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'follows'
      and policyname = 'follows_delete_own'
  ) then
    create policy "follows_delete_own"
    on public.follows for delete
    using (auth.uid() = user_id);
  end if;
end $$;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

