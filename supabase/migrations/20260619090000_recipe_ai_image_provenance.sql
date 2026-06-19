-- ENG-862/ENG-863 — provenance for AI-generated recipe hero images.
-- Do not apply via MCP apply_migration; stage this file and run
-- `supabase db push --linked` so schema_migrations keeps the file timestamp.

alter table public.recipes
  add column if not exists image_source text,
  add column if not exists image_model text,
  add column if not exists image_generated_at timestamptz;

alter table public.recipes
  drop constraint if exists recipes_image_source_check;

alter table public.recipes
  add constraint recipes_image_source_check
  check (image_source is null or image_source in ('ai_generated', 'imported', 'user_uploaded'));

comment on column public.recipes.image_source is
  'Origin of recipes.image_url. ai_generated images require persistent Sloe image labelling and nutrition-decouple copy.';
comment on column public.recipes.image_model is
  'Generator/model identifier for AI recipe images.';
comment on column public.recipes.image_generated_at is
  'Timestamp when an AI-generated recipe image was approved and persisted.';
