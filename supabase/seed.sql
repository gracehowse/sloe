-- Seed demo creators + recipes to match the current UI catalog.
-- Run this after `schema.sql` in Supabase Dashboard → SQL Editor.

-- Compatibility: if you already had tables, ensure required columns exist.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'creators'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'creators' and column_name = 'handle'
    ) then
      alter table public.creators add column handle text;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'creators' and column_name = 'avatar_url'
    ) then
      alter table public.creators add column avatar_url text;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'creators' and column_name = 'bio'
    ) then
      alter table public.creators add column bio text;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'creators' and column_name = 'is_verified'
    ) then
      alter table public.creators add column is_verified boolean not null default false;
    end if;
  end if;
end $$;

-- Create unique index on handle if possible.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'creators' and column_name = 'handle'
  ) then
    execute 'create unique index if not exists creators_handle_key on public.creators(handle)';
  end if;
end $$;

-- Ensure recipes columns exist if table was pre-created differently.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'recipes'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'recipes' and column_name = 'image_url'
    ) then
      alter table public.recipes add column image_url text;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'recipes' and column_name = 'servings'
    ) then
      alter table public.recipes add column servings int not null default 1;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'recipes' and column_name = 'is_verified'
    ) then
      alter table public.recipes add column is_verified boolean not null default true;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'recipes' and column_name = 'creator_calories'
    ) then
      alter table public.recipes add column creator_calories int;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'recipes' and column_name = 'calories'
    ) then
      alter table public.recipes add column calories int not null default 0;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'recipes' and column_name = 'protein'
    ) then
      alter table public.recipes add column protein int not null default 0;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'recipes' and column_name = 'carbs'
    ) then
      alter table public.recipes add column carbs int not null default 0;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'recipes' and column_name = 'fat'
    ) then
      alter table public.recipes add column fat int not null default 0;
    end if;
  end if;
end $$;

-- Creators
insert into public.creators (id, handle, display_name, avatar_url, is_verified)
values
  ('11111111-1111-1111-1111-111111111111', 'alex-chen', 'Alex Chen', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop', true),
  ('22222222-2222-2222-2222-222222222222', 'maria-santos', 'Maria Santos', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop', true),
  ('33333333-3333-3333-3333-333333333333', 'jordan-kim', 'Jordan Kim', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop', true),
  ('44444444-4444-4444-4444-444444444444', 'emma-wilson', 'Emma Wilson', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop', true)
on conflict (id) do update
set handle = excluded.handle,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    is_verified = excluded.is_verified;

-- Recipes
insert into public.recipes (
  id,
  creator_id,
  title,
  image_url,
  servings,
  is_verified,
  creator_calories,
  calories,
  protein,
  carbs,
  fat
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'High-Protein Chicken & Rice Bowl',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop',
    1,
    true,
    null,
    542,
    48,
    52,
    12
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    'Overnight Protein Oats',
    'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=800&h=600&fit=crop',
    1,
    true,
    420,
    387,
    32,
    48,
    8
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '33333333-3333-3333-3333-333333333333',
    'Grilled Salmon with Roasted Vegetables',
    'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&h=600&fit=crop',
    1,
    true,
    null,
    468,
    42,
    28,
    20
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '44444444-4444-4444-4444-444444444444',
    'Greek Yogurt Parfait',
    'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&h=600&fit=crop',
    1,
    true,
    null,
    285,
    24,
    38,
    6
  )
on conflict (id) do update
set title = excluded.title,
    image_url = excluded.image_url,
    servings = excluded.servings,
    is_verified = excluded.is_verified,
    creator_calories = excluded.creator_calories,
    calories = excluded.calories,
    protein = excluded.protein,
    carbs = excluded.carbs,
    fat = excluded.fat;

-- Test / dev promo: full Pro access (high max_uses; restrict in production)
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'promo_codes'
  ) then
    insert into public.promo_codes (code, tier, max_uses)
    values ('PLATEMATE_PRO', 'pro', 10000)
    on conflict (code) do nothing;
  end if;
end $$;

