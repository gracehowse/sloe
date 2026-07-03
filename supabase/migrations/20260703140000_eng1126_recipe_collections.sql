-- Recipe collections/folders — ENG-1126 (Paprika/Plan To Eat parity)
--
-- Adds user-created, named recipe collections with many-to-many membership.
-- Membership is keyed on `recipe_id` (not on a `saves` row) so created/
-- imported recipes — which have no `saves` row — can be filed into a
-- collection. Additive only: no changes to `saves` or `recipes`.
--
-- RLS: follows the recursion-safe `security definer` helper pattern from
-- `20260423110000_household_rls_recursion_fix.sql` /
-- `20260520100000_saves_rls_recursion_fix.sql`. `recipe_collection_items`'
-- policies must confirm the parent collection belongs to `auth.uid()`
-- without a bare subquery joining back to `recipe_collections` under RLS
-- (that class of subquery is exactly what caused the `saves` and
-- `household_members` infinite-recursion incidents) — so ownership is
-- checked via `public.auth_owns_collection()`, a `security definer` function
-- that bypasses RLS inside its own body.

create table if not exists public.recipe_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lower(name))
);

create index if not exists recipe_collections_user_sort_idx
  on public.recipe_collections (user_id, sort_order);

create table if not exists public.recipe_collection_items (
  collection_id uuid not null references public.recipe_collections(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, recipe_id)
);

create index if not exists recipe_collection_items_recipe_idx
  on public.recipe_collection_items (recipe_id);

alter table public.recipe_collections enable row level security;
alter table public.recipe_collection_items enable row level security;

-- ────────── Recursion-safe ownership helper ──────────

create or replace function public.auth_owns_collection(p_collection_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.recipe_collections
    where id = p_collection_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.auth_owns_collection(uuid) from public;
grant execute on function public.auth_owns_collection(uuid) to authenticated;

-- ────────── recipe_collections policies (simple — auth.uid() = user_id) ──────────

drop policy if exists "recipe_collections_select_own" on public.recipe_collections;
create policy "recipe_collections_select_own"
  on public.recipe_collections for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "recipe_collections_insert_own" on public.recipe_collections;
create policy "recipe_collections_insert_own"
  on public.recipe_collections for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "recipe_collections_update_own" on public.recipe_collections;
create policy "recipe_collections_update_own"
  on public.recipe_collections for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "recipe_collections_delete_own" on public.recipe_collections;
create policy "recipe_collections_delete_own"
  on public.recipe_collections for delete
  to authenticated
  using (user_id = auth.uid());

-- ────────── recipe_collection_items policies (via the helper — no recursion) ──────────

drop policy if exists "recipe_collection_items_select_own" on public.recipe_collection_items;
create policy "recipe_collection_items_select_own"
  on public.recipe_collection_items for select
  to authenticated
  using (public.auth_owns_collection(collection_id));

drop policy if exists "recipe_collection_items_insert_own" on public.recipe_collection_items;
create policy "recipe_collection_items_insert_own"
  on public.recipe_collection_items for insert
  to authenticated
  with check (public.auth_owns_collection(collection_id));

drop policy if exists "recipe_collection_items_delete_own" on public.recipe_collection_items;
create policy "recipe_collection_items_delete_own"
  on public.recipe_collection_items for delete
  to authenticated
  using (public.auth_owns_collection(collection_id));

-- ────────── updated_at trigger (reuses the shared public.set_updated_at()
-- helper introduced in 20260503101000_schema_drift_repair.sql) ──────────

drop trigger if exists recipe_collections_set_updated_at on public.recipe_collections;
create trigger recipe_collections_set_updated_at
  before update on public.recipe_collections
  for each row
  execute function public.set_updated_at();

notify pgrst, 'reload schema';
