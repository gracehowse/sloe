-- Schema drift repair (2026-04-25). See full audit at
-- docs/audits/2026-04-25-schema-drift.md.
--
-- Three early migrations were recorded in supabase_migrations.schema_migrations
-- but their DDL never executed (the early MCP apply_migration failure mode
-- CLAUDE.md warns about). One single-policy migration was also a partial-apply.
-- Plus the existing notify_followers_on_recipe_publish() function on prod is
-- the v0 body, missing the is_verified gate added in 20260414120200, and
-- references public.author_follows which is one of the missing tables — every
-- publish/update of a recipe with author_id IS NOT NULL would error.
--
-- This migration re-asserts the missing surface idempotently. Every statement
-- is no-op-on-correct-DB safe. Apply via `supabase db push --linked`.
--
-- Drift sources:
--   - 20260408143000_add_verified_nutrition_micros (default-flip line skipped)
--   - 20260408170000_food_db_unification           (entire migration ghosted)
--   - 20260408180000_phase_4b_creator_social        (entire migration ghosted)
--   - 20260414120000_promo_codes_select_own_redemptions (single policy missing)
--   - 20260414120200_notify_only_verified           (function body still v0)

set search_path = public;
create extension if not exists "pgcrypto" with schema extensions;

-- ──────────────── 1. T0 default repair ────────────────
-- recipe_ingredients.is_verified currently defaults `true` on prod; should be
-- `false` so ad-hoc service-role inserts aren't silently flagged verified.
alter table public.recipe_ingredients alter column is_verified set default false;

-- ──────────────── 2. food_db_unification (20260408170000) ────────────────
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  display_name text not null,
  brand text,
  is_verified boolean not null default false
);
alter table public.foods enable row level security;

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

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists barcode_mappings_set_updated_at on public.barcode_mappings;
create trigger barcode_mappings_set_updated_at
before update on public.barcode_mappings
for each row execute function public.set_updated_at();

-- food_db policies (PG version doesn't support `create policy if not exists`)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='foods' and policyname='foods_select_public') then
    create policy "foods_select_public" on public.foods for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='food_sources' and policyname='food_sources_select_public') then
    create policy "food_sources_select_public" on public.food_sources for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='barcode_mappings' and policyname='barcode_mappings_select_public') then
    create policy "barcode_mappings_select_public" on public.barcode_mappings for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='barcode_mappings' and policyname='barcode_mappings_write_own') then
    create policy "barcode_mappings_write_own" on public.barcode_mappings for insert with check (auth.uid() = created_by);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='barcode_mappings' and policyname='barcode_mappings_update_own') then
    create policy "barcode_mappings_update_own" on public.barcode_mappings for update
      using (auth.uid() = created_by) with check (auth.uid() = created_by);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='food_reports' and policyname='food_reports_insert_own') then
    create policy "food_reports_insert_own" on public.food_reports for insert with check (auth.uid() = reporter_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='food_reports' and policyname='food_reports_select_own') then
    create policy "food_reports_select_own" on public.food_reports for select using (auth.uid() = reporter_id);
  end if;
end $$;

-- ──────────────── 3. phase_4b_creator_social (20260408180000) ────────────────
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
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='author_follows' and policyname='author_follows_select_own') then
    create policy "author_follows_select_own" on public.author_follows for select using (auth.uid() = follower_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='author_follows' and policyname='author_follows_insert_own') then
    create policy "author_follows_insert_own" on public.author_follows for insert with check (auth.uid() = follower_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='author_follows' and policyname='author_follows_delete_own') then
    create policy "author_follows_delete_own" on public.author_follows for delete using (auth.uid() = follower_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='recipe_plan_add_events' and policyname='recipe_plan_add_events_insert_own') then
    create policy "recipe_plan_add_events_insert_own" on public.recipe_plan_add_events for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='recipe_plan_add_events' and policyname='recipe_plan_add_events_select_own') then
    create policy "recipe_plan_add_events_select_own" on public.recipe_plan_add_events for select using (auth.uid() = user_id);
  end if;
end $$;

-- Public stat RPCs (security definer, granted to anon+authenticated).
create or replace function public.public_recipe_save_count(p_recipe_id uuid)
returns bigint language sql security definer set search_path = public stable as $$
  select count(*)::bigint from public.saves where recipe_id = p_recipe_id;
$$;
create or replace function public.public_creator_follower_count(p_creator_id uuid)
returns bigint language sql security definer set search_path = public stable as $$
  select count(*)::bigint from public.follows where creator_id = p_creator_id;
$$;
create or replace function public.public_author_follower_count(p_author_id uuid)
returns bigint language sql security definer set search_path = public stable as $$
  select count(*)::bigint from public.author_follows where author_id = p_author_id;
$$;
create or replace function public.my_recipe_save_stats()
returns table (recipe_id uuid, save_count bigint)
language sql security definer set search_path = public stable as $$
  select s.recipe_id, count(*)::bigint
  from public.saves s
  inner join public.recipes r on r.id = s.recipe_id
  where r.author_id = auth.uid()
  group by s.recipe_id;
$$;
create or replace function public.my_recipe_plan_add_stats()
returns table (recipe_id uuid, plan_add_count bigint)
language sql security definer set search_path = public stable as $$
  select e.recipe_id, count(*)::bigint
  from public.recipe_plan_add_events e
  inner join public.recipes r on r.id = e.recipe_id
  where r.author_id = auth.uid()
  group by e.recipe_id;
$$;
grant execute on function public.public_recipe_save_count(uuid) to anon, authenticated;
grant execute on function public.public_creator_follower_count(uuid) to anon, authenticated;
grant execute on function public.public_author_follower_count(uuid) to anon, authenticated;
grant execute on function public.my_recipe_save_stats() to authenticated;
grant execute on function public.my_recipe_plan_add_stats() to authenticated;

-- ──────────────── 4. promo_codes_select_own_redemptions ────────────────
drop policy if exists "promo_codes_select_own_redemptions" on public.promo_codes;
create policy "promo_codes_select_own_redemptions"
  on public.promo_codes for select to authenticated
  using (
    exists (
      select 1 from public.promo_redemptions r
      where r.promo_code_id = promo_codes.id and r.user_id = auth.uid()
    )
  );

-- ──────────────── 5. notify_followers_on_recipe_publish — replace v0 with v2 ────────────────
-- Confirmed via pg_get_functiondef on 2026-04-25: prod has the v0 body
-- (no is_verified gate). With author_follows now restored above, the v2
-- body referenced in 20260414120200 becomes correct for the first time.
create or replace function public.notify_followers_on_recipe_publish()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(new.published, false) then return new; end if;
  if not coalesce(new.is_verified, false) then return new; end if;
  if tg_op = 'UPDATE' and coalesce(old.published, false) and coalesce(old.is_verified, false) then
    return new;
  end if;
  if new.author_id is not null then
    insert into public.creator_publish_notifications (user_id, recipe_id)
    select af.follower_id, new.id from public.author_follows af where af.author_id = new.author_id
    on conflict (user_id, recipe_id) do nothing;
  end if;
  if new.creator_id is not null then
    insert into public.creator_publish_notifications (user_id, recipe_id)
    select f.user_id, new.id from public.follows f where f.creator_id = new.creator_id
    on conflict (user_id, recipe_id) do nothing;
  end if;
  return new;
end;
$$;
