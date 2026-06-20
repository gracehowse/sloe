-- ENG-869: Two-plane content model for recipes.
-- Plane A private imports are imported_stub rows; Plane B owned canonical/public
-- recipes are first_party or claimed rows. Backfill expectation after this
-- migration: existing rows with source_url are imported_stub, all other rows are
-- first_party. Claim/dedupe flows must never mutate private imported rows.

create type public.recipe_content_origin as enum ('first_party', 'imported_stub', 'claimed');

alter table public.recipes
  add column content_origin public.recipe_content_origin not null default 'first_party';

update public.recipes
set content_origin = 'imported_stub'
where source_url is not null;

create index recipes_content_origin_idx on public.recipes(content_origin);
create index recipes_source_url_idx on public.recipes(source_url) where source_url is not null;
