-- Batched global save counts for Discover parity (one round-trip vs N× public_recipe_save_count).

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

grant execute on function public.public_recipe_save_counts_batch(uuid[]) to anon, authenticated;
