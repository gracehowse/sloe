-- ENG-1287 (launch-blocker, 2026-07-01): recipe imagery fabrication.
--
-- Before the honest-imagery fix, web RecipeUpload persisted a stock Unsplash
-- salad ("DEFAULT_COVER_IMAGE" / "DEFAULT_UPLOADED_RECIPE_IMAGE") into
-- recipes.image_url whenever a recipe was created without a photo — a
-- fabricated photo presented as the dish. The client-side render guard
-- (RETIRED_STOCK_IMAGE_URLS in src/lib/recipes/heroImageFallback.ts) already
-- treats these URLs as "no image"; this migration cleans the rows at the
-- source so exports, OG tags and any future consumer stop seeing them too.
--
-- The full retired set (6 URLs) is included for belt-and-braces even though
-- only the first was ever persisted (the other five were render-time-only
-- fallbacks on mobile). Exact-URL match on purpose: two of these photo ids
-- also appear with DIFFERENT query params as curated seed heroes
-- (seedRecipesV2.ts), which must remain untouched.

UPDATE public.recipes
SET image_url = NULL
WHERE image_url IN (
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=800&h=600&fit=crop'
);
