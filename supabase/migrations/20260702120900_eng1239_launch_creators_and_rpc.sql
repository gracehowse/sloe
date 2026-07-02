-- ENG-1239 — launch-partner creators in the real `creators` table + RPC ranks
-- creators even before organic saves land (LEFT JOIN). Replaces the presentation-
-- only `seedCreators.ts` fixture once this migration is applied.

-- The prior definition (migration 20260702120200) returned fewer columns; this
-- version widens the return type (adds avatar_url, bio), which `create or
-- replace` cannot do in place (Postgres 42P13). Drop first, then recreate.
drop function if exists public.top_creators_by_saves(int);

create or replace function public.top_creators_by_saves(p_limit int default 12)
returns table (
  id uuid,
  handle text,
  display_name text,
  avatar_url text,
  bio text,
  saves bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.handle,
    c.display_name,
    c.avatar_url,
    c.bio,
    coalesce(count(s.recipe_id), 0) as saves
  from public.creators c
  left join public.recipes r on r.creator_id = c.id
  left join public.saves s on s.recipe_id = r.id
  group by c.id, c.handle, c.display_name, c.avatar_url, c.bio, c.created_at
  order by coalesce(count(s.recipe_id), 0) desc, c.created_at asc
  limit greatest(1, least(coalesce(p_limit, 12), 50));
$$;

comment on function public.top_creators_by_saves(int) is
  'Discover creator rail (ENG-1239): creators ranked by recipe saves; includes launch partners with zero saves.';

grant execute on function public.top_creators_by_saves(int) to anon, authenticated;

-- Launch-partner cooks (grounded on the former presentation seed set).
insert into public.creators (id, handle, display_name, avatar_url, bio, is_verified)
values
  (
    'a1000001-0001-4000-8000-000000000001',
    'priyaeats',
    'Priya Patel',
    null,
    'Batch-cooking & big-flavour veg',
    true
  ),
  (
    'a1000001-0001-4000-8000-000000000002',
    'marcuscooks',
    'Marcus Chen',
    null,
    '30-minute weeknight dinners',
    true
  ),
  (
    'a1000001-0001-4000-8000-000000000003',
    'sofiaromano',
    'Sofia Romano',
    null,
    'Slow mornings & comfort food',
    true
  ),
  (
    'a1000001-0001-4000-8000-000000000004',
    'theoblake',
    'Theo Blake',
    null,
    'High protein, low effort',
    true
  ),
  (
    'a1000001-0001-4000-8000-000000000005',
    'aishakitchen',
    'Aisha Khan',
    null,
    'Veg-forward & bright',
    true
  )
on conflict (handle) do update set
  display_name = excluded.display_name,
  bio = excluded.bio,
  is_verified = excluded.is_verified;
