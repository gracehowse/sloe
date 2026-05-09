-- 20260514110000_recipe_images_bucket.sql
--
-- Public storage bucket for Suppr Kitchen hero images. Each recipe is
-- stored as `{slug}.png` (or .webp); rows with author_id IS NULL
-- (platform-curated) get their image_url stamped to the bucket's
-- public URL by `scripts/recipe-seeds/generate-recipe-images.mjs`.
--
-- Why public: hero images render in the Library / Discover / Today
-- surfaces for every authed user, so private + signed URLs would add
-- a per-image fetch on every list render. Public read with
-- service-role-only write matches how Recipe / FatSecret CDN images
-- are already consumed.
--
-- Apply via `supabase db push --linked`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'recipe-images',
    'recipe-images',
    true,
    -- 4 MB ceiling — gpt-image-1 1024×1024 PNGs typically land around 1–2 MB.
    4 * 1024 * 1024,
    array['image/jpeg', 'image/png', 'image/webp']
  )
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

-- Public read for everyone (anon + authed).
drop policy if exists "Public can read recipe-images" on storage.objects;
create policy "Public can read recipe-images"
  on storage.objects for select
  to public
  using (bucket_id = 'recipe-images');

-- Writes are restricted to the service role (the generator script
-- runs server-side with SUPABASE_SERVICE_ROLE_KEY). No user-facing
-- write policy.
