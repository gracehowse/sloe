-- eng862_recipe_image_provenance — queryable recipe hero provenance.
--
-- Adds nullable provenance columns to public.recipes so AI-generated,
-- imported, and user-uploaded hero images can be distinguished without
-- sniffing Storage paths. Required before the AI image label/removal UX,
-- image-precedence ladder, and audit flows.
--
-- Apply path: tracked file -> `supabase db push --linked` (authorised
-- per memory feedback_supabase_db_push_authorised). NEVER apply via
-- Supabase MCP apply_migration — that rewrites schema_migrations.version
-- to NOW() and drifts from the file timestamp.

alter table public.recipes
  add column if not exists image_source text,
  add column if not exists image_model text,
  add column if not exists image_generated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recipes_image_source_check'
      and conrelid = 'public.recipes'::regclass
  ) then
    alter table public.recipes
      add constraint recipes_image_source_check
      check (image_source is null or image_source in ('user_upload', 'ai_generated', 'imported'));
  end if;
end $$;

update public.recipes
set image_source = 'ai_generated'
where image_url like '%/recipe-images/heroes/%'
  and image_source is null;

update public.recipes
set image_source = 'imported'
where image_url is not null
  and image_url not like '%/recipe-images/heroes/%'
  and image_source is null;

comment on column public.recipes.image_source is
  'Nullable hero image provenance: user_upload, ai_generated, imported. Legacy no-image/unknown rows remain NULL.';
comment on column public.recipes.image_model is
  'Model identifier used when image_source = ai_generated, e.g. fal-ai/flux/dev or fal-ai/nano-banana-pro.';
comment on column public.recipes.image_generated_at is
  'Timestamp when the current AI-generated recipe hero image was generated.';
