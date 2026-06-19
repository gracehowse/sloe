-- ENG-751 — snapshot AI/photo/voice per-item ingredient breakdowns at log time.
-- Do not apply via MCP apply_migration; run `supabase db push --linked`.

create table if not exists public.nutrition_entry_ingredients (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.nutrition_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  calories real not null default 0,
  protein real not null default 0,
  carbs real not null default 0,
  fat real not null default 0,
  fiber_g real,
  confidence real,
  source text not null default '',
  created_at timestamptz not null default now(),
  constraint nutrition_entry_ingredients_confidence_range
    check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create index if not exists nutrition_entry_ingredients_entry_id_idx
  on public.nutrition_entry_ingredients(entry_id);

create index if not exists nutrition_entry_ingredients_user_entry_idx
  on public.nutrition_entry_ingredients(user_id, entry_id);

alter table public.nutrition_entry_ingredients enable row level security;

create policy "nutrition_entry_ingredients_select_own"
  on public.nutrition_entry_ingredients for select
  using ((select auth.uid()) = user_id);

create policy "nutrition_entry_ingredients_insert_own_entry"
  on public.nutrition_entry_ingredients for insert
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.nutrition_entries ne
      where ne.id = nutrition_entry_ingredients.entry_id
        and ne.user_id = (select auth.uid())
    )
  );

comment on table public.nutrition_entry_ingredients is
  'ENG-751 per-log-entry ingredient/item macro snapshot for AI/photo/voice meals without recipe_id. Rows are written at log time and cascade with nutrition_entries.';
comment on column public.nutrition_entry_ingredients.confidence is
  'Source match confidence in [0,1]. Low-confidence values remain visible for trust posture; never silently filled.';
comment on column public.nutrition_entry_ingredients.source is
  'Snapshot provenance, e.g. AI photo or AI voice, matching nutrition_entries.source posture.';
