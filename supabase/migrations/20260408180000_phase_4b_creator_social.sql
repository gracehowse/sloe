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
grant execute on function public.public_creator_follower_count(uuid) to anon, authenticated;
grant execute on function public.public_author_follower_count(uuid) to anon, authenticated;
grant execute on function public.my_recipe_save_stats() to authenticated;
grant execute on function public.my_recipe_plan_add_stats() to authenticated;
