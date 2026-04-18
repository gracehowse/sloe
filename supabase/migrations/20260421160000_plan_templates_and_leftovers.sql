-- Batch 3.10 — Plan templates + leftovers.
--
-- 1. `user_plan_templates` — a named reusable snapshot of a 1–7 day meal plan
--    slice. Slots are stored as JSONB (recipe ref + slot label + portion
--    multiplier + base macros) so a template can be applied to any week
--    without coupling to a recipe's current macros (templates survive recipe
--    edits). Leftover state is intentionally NOT persisted — it is inferred
--    on apply from each recipe's servings yield.
--
-- 2. `meal_plan_days.servings_used` — per-recipe {recipeId: servingsConsumed}
--    map. Powers leftover math: when the user logs a planned meal we
--    increment; when they swap a parent we decrement the removed copies.
--
-- 3. `meal_plan_meals.is_leftover` — visual flag. Macros on a leftover row
--    equal the parent row's; this flag is purely for the "🍱 Leftover of X"
--    badge. The parent recipe is referenced by `meal_plan_meals.recipe_id`.

-- ═══════════════════════════════════════════════════════════════════
-- 1. PLAN TEMPLATES
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.user_plan_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  day_count   smallint not null check (day_count between 1 and 7),
  slots       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Case-insensitive unique name per user.
create unique index if not exists user_plan_templates_user_name_unique
  on public.user_plan_templates (user_id, lower(name));

create index if not exists user_plan_templates_user_idx
  on public.user_plan_templates (user_id, updated_at desc);

alter table public.user_plan_templates enable row level security;

drop policy if exists "Own plan templates" on public.user_plan_templates;
create policy "Own plan templates" on public.user_plan_templates for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Keep `updated_at` honest.
create or replace function public.set_user_plan_templates_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_plan_templates_updated_at on public.user_plan_templates;
create trigger user_plan_templates_updated_at
  before update on public.user_plan_templates
  for each row execute function public.set_user_plan_templates_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- 2. SERVINGS-USED MAP ON PLAN DAYS
-- ═══════════════════════════════════════════════════════════════════

alter table public.meal_plan_days
  add column if not exists servings_used jsonb not null default '{}'::jsonb;

-- ═══════════════════════════════════════════════════════════════════
-- 3. LEFTOVER FLAG ON PLAN MEALS
-- ═══════════════════════════════════════════════════════════════════

alter table public.meal_plan_meals
  add column if not exists is_leftover boolean not null default false;

-- Optional: the id of the parent recipe this row is a leftover of. Keeps
-- the "remove 2 leftovers" math cheap when the user swaps a parent.
alter table public.meal_plan_meals
  add column if not exists leftover_of_recipe_id text;

-- Index so "all leftovers of recipe X for user Y" is a cheap scan when a
-- swap/unlock happens.
create index if not exists meal_plan_meals_leftover_of_idx
  on public.meal_plan_meals (leftover_of_recipe_id)
  where leftover_of_recipe_id is not null;
