-- Add source attribution columns so imported/seeded recipes credit the original website.
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS source_name text;
COMMENT ON COLUMN public.recipes.source_url IS 'Original URL the recipe was imported from';
COMMENT ON COLUMN public.recipes.source_name IS 'Name of the original source website or author';
