# Honest recipe imagery — no fabricated stock photos (ENG-1287)

**Date:** 2026-07-01 · **Status:** shipped · **Priority:** launch-blocker
(Gate 0). Companion flag change: ENG-1300 (`expo_image_adoption_v1` →
default-ON).

## Problem (verified, 4 lenses + pixel evidence)

Whenever a recipe had no `image_url`, three fabrication paths assigned a
**wrong stock photo presented as the dish's real photo**:

1. **Mobile pool** — `apps/mobile/lib/recipes.ts` `pickDefaultImage` =
   `hashStr(recipeId) % 6` over a 6-photo Unsplash pool, baked into
   `RecipeCard.image` in both `useDiscoverRecipes` and
   `useSavedLibraryRecipes`, then consumed by Recipes cards, coach rows
   (`coach.tsx` `thumbnail: r.image`) and the Today NorthStar card.
   Result: "Protein banana bread" rendered a stir-fry as if real.
2. **Web default** — `src/context/AppDataContext.tsx` mapped
   `pickHeroImageUrl(...) ?? DEFAULT_UPLOADED_RECIPE_IMAGE` (the same green
   -bowl salad for every imageless recipe → the "same tofu photo repeated
   across six Library cards" wall).
3. **Web persistence** — `RecipeUpload.tsx` **wrote** that stock URL into
   `recipes.image_url` for photo-less creations, so the lie lived in the
   database and leaked through the "real image" ladder rung on both
   platforms, the public share page's OG tags and JSON-LD.

Persona/seed rows and all real IG/TikTok imports have `image_url = null`
(`pickHeroImageUrl` correctly returns null for them), so this hit the exact
viral-hook surfaces hardest.

## Decision

1. **A recipe with no image is `image: null` end-to-end.** `RecipeCard.image`
   is now typed `string | null` on both platforms; the pool, the web default
   constant and the persisted default are deleted. Never someone else's
   photo.
2. **One shared null-state treatment: `RecipeHeroFallback`** (D8, reskinned
   to the Sloe calm palette 2026-06-08, design system §11.4) — the
   deterministic cuisine-tinted cream gradient + food glyph keyed by recipe
   id + title. It was already the canonical treatment on Discover (both
   platforms), coach rows, and the NorthStar card; ENG-1287 extends it to
   the last card surfaces that diverged: mobile `RecipeCardImage` (Library
   grid, RecipeCardWide, FeaturedHero, profile grid) previously used the
   ENG-1015 painterly samples at card size, and web
   FeaturedHero/RecipeCardWide used a flat `UtensilsCrossed` block. All
   recipe cards + thumbnails now render the same fallback web ↔ mobile.
   - The ENG-1015 painterly `FoodFallbackThumb` (watercolour illustrations,
     unmistakably not photos) **stays** on food *rows* — LogSheet
     library/browse rows and the onboarding goal step — where it is the
     established sibling treatment for generic foods on both platforms.
     Intentionally different element class — not a gap.
3. **Retired-URL blocklist** — `RETIRED_STOCK_IMAGE_URLS` +
   `isRetiredStockImageUrl` in the shared
   `src/lib/recipes/heroImageFallback.ts`; `pickHeroImageUrl` treats the six
   exact pool URLs as absent. This covers legacy DB rows, web draft
   reloads, the public SSR share page (OG/JSON-LD must not lie either) and
   pre-fix mobile offline caches (`sanitizeCachedCardImages` on both
   AsyncStorage read paths). Exact-URL matching on purpose: two of the
   photo ids also appear with different params as curated per-dish seed
   heroes (`seedRecipesV2.ts`), which remain legitimate attributed imagery.
4. **DB cleanup at source** —
   `supabase/migrations/20260702121000_eng1287_null_fabricated_recipe_stock_images.sql`
   nulls `recipes.image_url` for the retired URLs (Grace runs
   `supabase db push --linked`; never MCP `apply_migration`).
5. **Real images are untouched.** `image_url` present → identical behaviour
   (user uploads, permitted imports, YouTube thumbnails, labelled AI
   heroes). The recipe-detail "Generate an image" CTA is unchanged; the
   RecipeUpload background hero-generation trigger now fires on
   `!finalImageUrl` instead of comparing against the stock default.

## Tests

- `tests/unit/heroImageFallback.test.ts` — retired URLs → null; seed-hero
  params NOT retired; YT thumbnail still wins over a retired image_url.
- `tests/unit/appDataHonestImagery.test.ts` +
  `apps/mobile/tests/unit/recipesHonestImagery.test.ts` — pin the deleted
  fabrication on both data layers (no unsplash literals, `?? null`
  mapping, cache sanitisation, honest types).
- `apps/mobile/tests/unit/libraryRecipeCardImage.test.tsx` +
  `libraryFoodFallbackWiring.test.ts` — RecipeCardImage renders
  `RecipeHeroFallback` for null/error (supersedes the ENG-1015 card pin).
- `tests/unit/cookModeWatchOriginal.test.ts` /
  `aiHeroPublicPlaneGuard.test.ts` — updated to the null-based contracts.

## Rollout note

No feature flag: this is a trust/data-honesty bug fix (fabricated content),
not a visual-preference change — the flag-gating rule's "bug fixes with no
visual surface" carve-out does not squarely apply, but shipping a *lie*
behind a kill-switch that restores the lie was judged wrong. The visual
delta (stock photo → branded fallback) is exactly the before/after the
orchestrator captures on the PR.
