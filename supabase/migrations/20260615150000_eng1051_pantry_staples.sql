-- ENG-1051 — pantry/staples suppress-list (shopping generator only; not inventory).
alter table public.profiles
  add column if not exists pantry_staples jsonb not null default '[]'::jsonb;

comment on column public.profiles.pantry_staples is
  'Ingredient names to suppress from generated shopping lists (always-on-hand staples).';
