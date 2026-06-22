-- top_creators_by_saves — powers the Discover "explore from" creator rail
-- (ENG-1225 #14). Ranks creators by how many times their recipes have been
-- saved. Returns ONLY public creator identity + an aggregate save count — no
-- saver identity (the `saves` rows carry user_id; we count, never expose it).
--
-- `security definer` so the rail loads for anon + authenticated regardless of
-- per-table RLS, but the function body only reads creator/recipe identity and
-- aggregates saves — no row-level user data crosses the boundary. search_path
-- is pinned to defend against search-path hijack.
--
-- The `creators` table is empty pre-launch, so this returns 0 rows today and the
-- rail stays hidden; it lights up automatically once creators publish.

create or replace function public.top_creators_by_saves(p_limit int default 12)
returns table (
  id uuid,
  handle text,
  display_name text,
  avatar_url text,
  saves bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.handle, c.display_name, c.avatar_url, count(s.recipe_id) as saves
  from public.creators c
  join public.recipes r on r.creator_id = c.id
  join public.saves s on s.recipe_id = r.id
  group by c.id, c.handle, c.display_name, c.avatar_url
  order by count(s.recipe_id) desc, c.created_at asc
  limit greatest(1, least(coalesce(p_limit, 12), 50));
$$;

comment on function public.top_creators_by_saves(int) is
  'Discover creator rail (ENG-1225 #14): creators ranked by total recipe saves. Aggregate only — no saver identity exposed.';

grant execute on function public.top_creators_by_saves(int) to anon, authenticated;
