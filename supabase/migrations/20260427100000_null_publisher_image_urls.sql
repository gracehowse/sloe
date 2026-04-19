-- Null image_urls that hotlink publisher CDN imagery.
--
-- Rationale: hotlinking from publisher CDNs (BBC Good Food / Immediate Media,
-- Instagram, TikTok, YouTube) onto a commercial SaaS is direct reproduction /
-- public display under 17 USC § 106 and UK CDPA 1988 §§ 17, 19, and
-- inconsistent with those publishers' terms of use. Runtime guards in
-- `parseRecipeFromHtml.ts` now refuse to persist these hosts; this migration
-- backfills the same rule against existing rows. Recipes remain in place
-- (nothing is deleted), the UI falls back to a neutral placeholder, and the
-- user can still navigate to `source_url` to see the original page.
UPDATE public.recipes
SET image_url = NULL
WHERE image_url IS NOT NULL
  AND (
       image_url LIKE '%images.immediate.co.uk%'
    OR image_url LIKE '%bbcgoodfood.com%'
    OR image_url LIKE '%cdninstagram.com%'
    OR image_url LIKE '%fbcdn.net%'
    OR image_url LIKE '%tiktokcdn.com%'
    OR image_url LIKE '%tiktokcdn-us.com%'
    OR image_url LIKE '%ytimg.com%'
  );
