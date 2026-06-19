-- ENG-989: step-centric recipe schema.
-- Adds relational recipe_steps and links recipe_ingredients to a step while
-- preserving recipes.instructions during the deprecation window.

create table if not exists public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  position integer not null,
  text text not null,
  constraint recipe_steps_position_positive check (position > 0),
  constraint recipe_steps_recipe_position_unique unique (recipe_id, position)
);

create index if not exists recipe_steps_recipe_id_position_idx
  on public.recipe_steps (recipe_id, position);

alter table public.recipe_steps enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recipe_steps'
      and policyname = 'recipe_steps_select_public'
  ) then
    create policy "recipe_steps_select_public"
    on public.recipe_steps for select
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recipe_steps'
      and policyname = 'recipe_steps_write_own_recipe'
  ) then
    create policy "recipe_steps_write_own_recipe"
    on public.recipe_steps for all
    using (exists (select 1 from public.recipes r where r.id = recipe_id and r.author_id = (select auth.uid())))
    with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.author_id = (select auth.uid())));
  end if;
end $$;

alter table public.recipe_ingredients
  add column if not exists step_id uuid references public.recipe_steps(id) on delete set null;

create index if not exists recipe_ingredients_step_id_idx
  on public.recipe_ingredients (step_id);

insert into public.recipe_steps (recipe_id, position, text)
select recipe_id, position, text
from (
  select
    r.id as recipe_id,
    row_number() over (partition by r.id order by ordinality)::integer as position,
    btrim(regexp_replace(line, '^\s*\d+[.)]\s*', '')) as text
  from public.recipes r
  cross join lateral regexp_split_to_table(coalesce(r.instructions, ''), E'\n+') with ordinality as lines(line, ordinality)
  where btrim(regexp_replace(line, '^\s*\d+[.)]\s*', '')) <> ''
) backfill
on conflict (recipe_id, position) do nothing;

comment on table public.recipe_steps is
  'ENG-989 ordered recipe method rows. Ingredients link via recipe_ingredients.step_id; recipes.instructions remains during deprecation.';
comment on column public.recipe_ingredients.step_id is
  'Nullable ENG-989 link to the recipe step that uses this ingredient. Null means legacy/base/unassigned ingredient.';
