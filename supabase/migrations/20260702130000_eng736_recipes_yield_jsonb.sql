-- ENG-736 — structured recipe yield beyond servings count.
-- Nullable: legacy rows keep behaviour via recipes.servings until authors
-- set weight / unit yield in the recipe editor (follow-up UI PR).

alter table public.recipes
  add column if not exists yield jsonb;

comment on column public.recipes.yield is
  'ENG-736 optional structured yield: total batch weight (g), discrete units (slices), or both. When null, recipes.servings is the canonical yield.';

alter table public.recipes
  drop constraint if exists recipes_yield_shape_check;

alter table public.recipes
  add constraint recipes_yield_shape_check
  check (
    yield is null
    or (
      jsonb_typeof(yield) = 'object'
      and yield ? 'kind'
      and yield->>'kind' in (
        'servings',
        'weight',
        'units',
        'weight_and_units'
      )
    )
  );
