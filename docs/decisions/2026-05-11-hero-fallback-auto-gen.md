# Hero image fallback — auto-generate when missing

**Date:** 2026-05-11
**Status:** Open — implementation pending
**Area:** Recipes (web + mobile), import pipeline
**Driver:** Grace TF feedback (B7): Library + RecipeDetail render
text-only cards when hero is missing; should auto-generate.

## Decision

When a recipe is rendered (Library list, RecipeDetail page) and
`hero_image_url` is `null`, **auto-generate a hero from the recipe
title + first ingredient list via the existing AI image pipeline**.

The auto-generated URL gets persisted to `recipes.hero_image_url` so:
1. The recipe is no longer hero-less on subsequent loads (cached
   forever).
2. The cost of a single generation is paid once per recipe, not per
   view.
3. The user sees an instant placeholder (deterministic seed-based
   gradient + emoji glyph) while the gen runs in the background;
   the real image swaps in on the next mount.

## Trigger surfaces

| Surface | Behavior |
|---|---|
| **Web /library** | `RecipeCard` renders gradient placeholder if no hero. Background job kicks off if `hero_image_url IS NULL AND author_id = current_user_id` (only auto-gen on user-owned recipes). |
| **Web /recipe/[slug]** | Same: placeholder + background gen for user-owned. Published platform recipes already have curated heroes; never auto-gen for those. |
| **Mobile Library card** | Same trigger as web. |
| **Mobile RecipeDetail** | Same trigger as web. |
| **Recipe import (`POST /api/recipes/import`)** | If import succeeds with no hero (some scraped URLs strip OG images), fire auto-gen synchronously before returning so the user lands on a fully-imaged recipe on first navigate. |

## Tech

- Provider: existing AI image route (Replicate / OpenAI Image API,
  see `src/lib/ai/imageGeneration.ts`).
- Prompt template: "Overhead shot of {title}, on a {neutral plate /
  wooden board}, soft natural light, food photography style. No text.
  No people." Add dietary descriptors from `recipe.tags` to bias
  output (vegan, GF, etc.).
- Storage: Supabase Storage `recipe-images` bucket, public-read.
  Filename `recipe-${id}-hero.webp`.
- Rate limit: 1 gen per recipe per 7 days (idempotency key on
  `(recipe_id, gen_provider)`). Prevents accidental loops if the
  hero column is cleared.
- Cost guard: monthly cap on auto-gen spend; over-budget falls back
  to deterministic placeholder permanently.
- Tier gating: Pro users get high-quality gen (Replicate Flux
  Schnell); Base users get the placeholder + a "Pro: Generate hero
  image" upsell on RecipeDetail.

## Open questions

1. Pro-only or free tier too? Default: **placeholder always free;
   auto-gen only for Pro** (anchor on a Pro perk). Revisit if engagement
   on text-only Base cards is bad.
2. User opt-in for auto-gen? Default: **on for Pro, no toggle**.
   Logged in `docs/ux/recipe-hero-fallback.md` if a future user
   asks for opt-out.
3. Where does the cost cap live? Recommend `featureFlags.heroAutoGenMonthlyCap`
   defaulting to £25/month; route fails closed and falls back to
   placeholder.

## Acceptance criteria

- Web `RecipeCard` and mobile `RecipeCard` render a coherent
  placeholder (not a broken-image icon) for hero-less recipes.
- A Pro user creating a private recipe sees the real image swap in
  within 60s of save.
- Importing a recipe that returned no OG image still lands on a
  card with a real image (sync gen on import).
- Hero column is never re-generated for a recipe that already has
  a `hero_image_url`.
- Cost cap honoured; over-budget gracefully degrades.

## Implementation order

1. Placeholder component (`<RecipeHeroPlaceholder seed={...}/>`) on
   web + mobile — ships ahead of gen.
2. Wire gen route to fire on hero-less render of a user-owned recipe.
3. Cap + idempotency + provider selection.
4. Mobile parity.

Logged in roadmap as in-progress.
