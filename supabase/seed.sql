-- Local/dev seed: schema compatibility tweaks + promo code only (no demo recipes).
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

-- Test / dev promos: Pro tier via `redeem_promo_code` RPC (Settings → promo on web/mobile).
-- For hosted Supabase without running seed: run the same INSERTs in the SQL editor.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'promo_codes'
  ) then
    insert into public.promo_codes (code, tier, max_uses)
    values
      ('PLATEMATE_PRO', 'pro', 10000),
      ('SUPPR_TEST_PREMIUM', 'pro', 100000)
    on conflict (code) do nothing;
  end if;
end $$;

