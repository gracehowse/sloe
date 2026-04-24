-- Suppr Phase 0 schema (minimal)
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
  target_fat int,
  target_fiber_g int,
  target_water_ml int,
  -- target_calories provenance (migration 20260427110000)
  -- See migration header for the 5-value enum semantics + Rule 2 contract.
  target_calories_set_at timestamptz,
  target_calories_source text check (target_calories_source in ('onboarding','user','recompute','digest_recalibration','reset_default')),
  prefer_activity_adjusted_calories boolean not null default false,
  -- onboarding fields (added via migration 20260412100000)
  goal_weight_kg numeric,
  plan_pace text default 'steady',
  nutrition_strategy text default 'balanced',
  calorie_schedule text default 'even',
  high_days jsonb,
  fasting_enabled boolean default false,
  fasting_window text,
  onboarding_completed boolean default false,
  dietary_restrictions jsonb,
  notification_prefs jsonb,
  -- progress / wellness (migration 20260414100000)
  weight_kg_by_day jsonb not null default '{}'::jsonb,
  steps_by_day jsonb not null default '{}'::jsonb,
  daily_steps_goal int not null default 10000,
  body_fat_pct numeric
);

alter table public.profiles enable row level security;

-- Migration: add columns on existing projects (safe if already present)
alter table public.profiles add column if not exists target_fiber_g int;
alter table public.profiles add column if not exists target_water_ml int;
alter table public.profiles add column if not exists prefer_activity_adjusted_calories boolean not null default false;
-- stripe_customer_id — captured on `checkout.session.completed` so
-- `/account/billing` can open the Stripe Customer Portal without a
-- lookup round-trip. See migration 20260419110000_profiles_stripe_customer_id.sql.
alter table public.profiles add column if not exists stripe_customer_id text;
-- target_calories provenance (migration 20260427110000) — feeds the
-- Maintenance Recalibrate suggestion's Rule 2 suppression check (don't
-- re-suggest a number the user just hand-chose). Step 2 will make these
-- NOT NULL after a clean-write soak period (earliest 2026-05-04).
alter table public.profiles add column if not exists target_calories_set_at timestamptz;
alter table public.profiles add column if not exists target_calories_source text;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_target_calories_source_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_target_calories_source_check
      check (target_calories_source in ('onboarding','user','recompute','digest_recalibration','reset_default'));
  end if;
end $$;
create index if not exists profiles_target_calories_user_set_idx
  on public.profiles (id, target_calories_set_at)
  where target_calories_source = 'user';

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
  author_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  instructions text,
  image_url text,
  servings int not null default 1,
  prep_time_min int,
  cook_time_min int,
  meal_type text[],
  dietary jsonb,
  published boolean not null default false,
  is_verified boolean not null default true,
  creator_calories int,
  calories int not null default 0,
  protein int not null default 0,
  carbs int not null default 0,
  fat int not null default 0,
  fiber_g numeric not null default 0,
  sugar_g numeric not null default 0,
  sodium_mg numeric not null default 0,
  verified_source text,
  verified_at timestamptz,
  verified_confidence numeric
);

create index if not exists recipes_creator_id_idx on public.recipes(creator_id);
create index if not exists recipes_author_id_idx on public.recipes(author_id);
create index if not exists recipes_published_created_at_idx on public.recipes(published, created_at desc);

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

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'recipes'
      and policyname = 'recipes_insert_own'
  ) then
    -- Base/Pro tier gate for published=true enforced in-line (see
    -- supabase/migrations/20260426100100_recipes_publish_tier_gate.sql).
    create policy "recipes_insert_own"
    on public.recipes for insert
    with check (
      auth.uid() = author_id
      and (
        published = false
        or coalesce(
          (select user_tier from public.profiles where id = auth.uid()),
          'free'
        ) in ('base', 'pro')
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'recipes'
      and policyname = 'recipes_update_own'
  ) then
    -- Publish-on-update gate (keeps in sync with migrations
    -- 20260414120100_publish_moderation.sql and
    -- 20260426100100_recipes_publish_tier_gate.sql): publishing requires
    -- is_verified + tier in (base, pro); drafts are unrestricted.
    create policy "recipes_update_own"
    on public.recipes for update
    using (auth.uid() = author_id)
    with check (
      auth.uid() = author_id
      and (
        published = false
        or (
          is_verified = true
          and coalesce(
            (select user_tier from public.profiles where id = auth.uid()),
            'free'
          ) in ('base', 'pro')
        )
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'recipes'
      and policyname = 'recipes_delete_own'
  ) then
    create policy "recipes_delete_own"
    on public.recipes for delete
    using (auth.uid() = author_id);
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

-- Unified foods (Phase 1: provenance + barcode correction loop)
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  display_name text not null,
  brand text,
  is_verified boolean not null default false
);

alter table public.foods enable row level security;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'foods'
      and policyname = 'foods_select_public'
  ) then
    create policy "foods_select_public"
    on public.foods for select
    using (true);
  end if;
end $$;

create table if not exists public.food_sources (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  food_id uuid not null references public.foods(id) on delete cascade,
  source text not null check (source in ('USDA','OpenFoodFacts','Community','FatSecret','Nutritionix')),
  external_id text not null,
  source_url text,
  confidence numeric,
  unique (source, external_id)
);

create index if not exists food_sources_food_id_idx on public.food_sources(food_id);

alter table public.food_sources enable row level security;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'food_sources'
      and policyname = 'food_sources_select_public'
  ) then
    create policy "food_sources_select_public"
    on public.food_sources for select
    using (true);
  end if;
end $$;

create table if not exists public.barcode_mappings (
  barcode text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  food_id uuid not null references public.foods(id) on delete cascade,
  source text not null check (source in ('OpenFoodFacts','Community')),
  external_id text,
  display_name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  is_verified boolean not null default false
);

create index if not exists barcode_mappings_food_id_idx on public.barcode_mappings(food_id);

alter table public.barcode_mappings enable row level security;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'barcode_mappings'
      and policyname = 'barcode_mappings_select_public'
  ) then
    create policy "barcode_mappings_select_public"
    on public.barcode_mappings for select
    using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'barcode_mappings'
      and policyname = 'barcode_mappings_write_own'
  ) then
    create policy "barcode_mappings_write_own"
    on public.barcode_mappings for insert
    with check (auth.uid() = created_by);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'barcode_mappings'
      and policyname = 'barcode_mappings_update_own'
  ) then
    create policy "barcode_mappings_update_own"
    on public.barcode_mappings for update
    using (auth.uid() = created_by)
    with check (auth.uid() = created_by);
  end if;
end $$;

create table if not exists public.food_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reporter_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('barcode_wrong_match','nutrition_incorrect','duplicate','missing_food')),
  source text,
  external_id text,
  barcode text,
  message text,
  status text not null default 'open' check (status in ('open','triaged','fixed','ignored'))
);

alter table public.food_reports enable row level security;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'food_reports'
      and policyname = 'food_reports_insert_own'
  ) then
    create policy "food_reports_insert_own"
    on public.food_reports for insert
    with check (auth.uid() = reporter_id);
  end if;
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'food_reports'
      and policyname = 'food_reports_select_own'
  ) then
    create policy "food_reports_select_own"
    on public.food_reports for select
    using (auth.uid() = reporter_id);
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
  fiber_g numeric not null default 0,
  sugar_g numeric not null default 0,
  sodium_mg numeric not null default 0,
  is_verified boolean not null default false,
  source text,
  fatsecret_food_id text,
  confidence numeric
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

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'recipe_ingredients'
      and policyname = 'recipe_ingredients_write_own_recipe'
  ) then
    create policy "recipe_ingredients_write_own_recipe"
    on public.recipe_ingredients
    for all
    using (
      exists (
        select 1
        from public.recipes r
        where r.id = recipe_id and r.author_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1
        from public.recipes r
        where r.id = recipe_id and r.author_id = auth.uid()
      )
    );
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
    with check (
      auth.uid() = user_id
      and (
        coalesce(
          (select user_tier from public.profiles where id = auth.uid()),
          'free'
        ) <> 'free'
        or (select count(*) from public.saves where user_id = auth.uid()) < 10
      )
    );
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

-- Shopping list (per user, JSON for Phase 0)
create table if not exists public.shopping_lists (
  user_id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  items jsonb not null default '[]'::jsonb
);

alter table public.shopping_lists enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'shopping_lists'
      and policyname = 'shopping_lists_select_own'
  ) then
    create policy "shopping_lists_select_own"
    on public.shopping_lists for select
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'shopping_lists'
      and policyname = 'shopping_lists_insert_own'
  ) then
    create policy "shopping_lists_insert_own"
    on public.shopping_lists for insert
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'shopping_lists'
      and policyname = 'shopping_lists_update_own'
  ) then
    create policy "shopping_lists_update_own"
    on public.shopping_lists for update
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

-- Promo codes (redeem via RPC only; no direct client reads)
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  code text not null unique,
  tier text not null check (tier in ('free','base','pro')),
  max_uses int,
  uses_count int not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  constraint promo_codes_code_upper check (code = upper(code))
);

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  redeemed_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  promo_code_id uuid not null references public.promo_codes(id) on delete cascade,
  unique (user_id, promo_code_id)
);

create index if not exists promo_redemptions_user_id_idx on public.promo_redemptions(user_id);

alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;

-- No policies on promo_codes: only SECURITY DEFINER RPC can read/write
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'promo_redemptions'
      and policyname = 'promo_redemptions_select_own'
  ) then
    create policy "promo_redemptions_select_own"
    on public.promo_redemptions for select
    using (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.redeem_promo_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.promo_codes%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_code is null or length(trim(p_code)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select * into v_row
  from public.promo_codes
  where code = upper(trim(p_code))
    and active = true
    and (expires_at is null or expires_at > now())
    and (max_uses is null or uses_count < max_uses);

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  end if;

  if exists (
    select 1 from public.promo_redemptions r
    where r.user_id = v_uid and r.promo_code_id = v_row.id
  ) then
    -- Idempotent: user already redeemed; re-apply tier (fixes drift if profile was reset / partial failure)
    insert into public.profiles (id, user_tier)
    values (v_uid, v_row.tier)
    on conflict (id) do update set user_tier = excluded.user_tier;
    return jsonb_build_object('ok', true, 'tier', v_row.tier, 'already_redeemed', true);
  end if;

  insert into public.profiles (id, user_tier)
  values (v_uid, v_row.tier)
  on conflict (id) do update set user_tier = excluded.user_tier;

  insert into public.promo_redemptions (user_id, promo_code_id)
  values (v_uid, v_row.id);

  update public.promo_codes
  set uses_count = uses_count + 1
  where id = v_row.id;

  return jsonb_build_object('ok', true, 'tier', v_row.tier, 'already_redeemed', false);
end;
$$;

grant execute on function public.redeem_promo_code(text) to authenticated;

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
-- Phase 4B: profile follows (community creators), plan-add signals, public stat RPCs for trust UI + creator dashboard.

-- ---------------------------------------------------------------------------
-- author_follows: authenticated users follow recipe authors (profiles.id)
-- ---------------------------------------------------------------------------
create table if not exists public.author_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, author_id),
  constraint author_follows_no_self check (follower_id <> author_id)
);

create index if not exists author_follows_author_id_idx on public.author_follows(author_id);
create index if not exists author_follows_follower_id_idx on public.author_follows(follower_id);

alter table public.author_follows enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'author_follows' and policyname = 'author_follows_select_own'
  ) then
    create policy "author_follows_select_own"
    on public.author_follows for select
    using (auth.uid() = follower_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'author_follows' and policyname = 'author_follows_insert_own'
  ) then
    create policy "author_follows_insert_own"
    on public.author_follows for insert
    with check (auth.uid() = follower_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'author_follows' and policyname = 'author_follows_delete_own'
  ) then
    create policy "author_follows_delete_own"
    on public.author_follows for delete
    using (auth.uid() = follower_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- recipe_plan_add_events: when a user logs a planned meal from the planner
-- ---------------------------------------------------------------------------
create table if not exists public.recipe_plan_add_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists recipe_plan_add_events_recipe_id_idx on public.recipe_plan_add_events(recipe_id);
create index if not exists recipe_plan_add_events_user_id_idx on public.recipe_plan_add_events(user_id);

alter table public.recipe_plan_add_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recipe_plan_add_events' and policyname = 'recipe_plan_add_events_insert_own'
  ) then
    create policy "recipe_plan_add_events_insert_own"
    on public.recipe_plan_add_events for insert
    with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recipe_plan_add_events'
      and policyname = 'recipe_plan_add_events_select_own'
  ) then
    create policy "recipe_plan_add_events_select_own"
    on public.recipe_plan_add_events for select
    using (auth.uid() = user_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER stats (aggregates only; no per-user save identity to the client)
-- ---------------------------------------------------------------------------
create or replace function public.public_recipe_save_count(p_recipe_id uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::bigint from public.saves where recipe_id = p_recipe_id;
$$;

create or replace function public.public_recipe_save_counts_batch(p_recipe_ids uuid[])
returns table (recipe_id uuid, save_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select s.recipe_id, count(*)::bigint as save_count
  from public.saves s
  where s.recipe_id = any(p_recipe_ids)
  group by s.recipe_id;
$$;

create or replace function public.public_creator_follower_count(p_creator_id uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::bigint from public.follows where creator_id = p_creator_id;
$$;

create or replace function public.public_author_follower_count(p_author_id uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::bigint from public.author_follows where author_id = p_author_id;
$$;

create or replace function public.my_recipe_save_stats()
returns table (recipe_id uuid, save_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select s.recipe_id, count(*)::bigint as save_count
  from public.saves s
  inner join public.recipes r on r.id = s.recipe_id
  where r.author_id = auth.uid()
  group by s.recipe_id;
$$;

create or replace function public.my_recipe_plan_add_stats()
returns table (recipe_id uuid, plan_add_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select e.recipe_id, count(*)::bigint as plan_add_count
  from public.recipe_plan_add_events e
  inner join public.recipes r on r.id = e.recipe_id
  where r.author_id = auth.uid()
  group by e.recipe_id;
$$;

grant execute on function public.public_recipe_save_count(uuid) to anon, authenticated;
grant execute on function public.public_recipe_save_counts_batch(uuid[]) to anon, authenticated;
grant execute on function public.public_creator_follower_count(uuid) to anon, authenticated;
grant execute on function public.public_author_follower_count(uuid) to anon, authenticated;
grant execute on function public.my_recipe_save_stats() to authenticated;
grant execute on function public.my_recipe_plan_add_stats() to authenticated;
-- In-app notifications when a followed author/creator publishes a recipe.

create table if not exists public.creator_publish_notifications (
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  primary key (user_id, recipe_id)
);

create index if not exists creator_publish_notifications_user_unread_idx
  on public.creator_publish_notifications(user_id, read_at)
  where read_at is null;

alter table public.creator_publish_notifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'creator_publish_notifications'
      and policyname = 'creator_publish_notifications_select_own'
  ) then
    create policy "creator_publish_notifications_select_own"
    on public.creator_publish_notifications for select
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'creator_publish_notifications'
      and policyname = 'creator_publish_notifications_update_own'
  ) then
    create policy "creator_publish_notifications_update_own"
    on public.creator_publish_notifications for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.notify_followers_on_recipe_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(new.published, false) then
    return new;
  end if;
  if tg_op = 'UPDATE' and coalesce(old.published, false) then
    return new;
  end if;

  if new.author_id is not null then
    insert into public.creator_publish_notifications (user_id, recipe_id)
    select af.follower_id, new.id
    from public.author_follows af
    where af.author_id = new.author_id
    on conflict (user_id, recipe_id) do nothing;
  end if;

  if new.creator_id is not null then
    insert into public.creator_publish_notifications (user_id, recipe_id)
    select f.user_id, new.id
    from public.follows f
    where f.creator_id = new.creator_id
    on conflict (user_id, recipe_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_recipe_published_notify_followers on public.recipes;
create trigger on_recipe_published_notify_followers
after insert or update of published, author_id, creator_id on public.recipes
for each row execute function public.notify_followers_on_recipe_publish();
