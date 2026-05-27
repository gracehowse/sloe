# Discover recipe images — `next/image` migration + optimizer allowlist

> **Status:** Resolved (2026-05-26). Web-only. Linear ENG-704.
> **Area:** Web performance / Recipes (Discover).
> **Files:** `src/app/components/suppr/discover-recipe-image.tsx`,
> `next.config.ts` (`images.remotePatterns`),
> `tests/unit/discoverRecipeImage.test.tsx`.

## Problem

The web Discover feed — the core viral-hook scroll — rendered every recipe
card image as a raw `<img>` with the `@next/next/no-img-element` ESLint rule
suppressed inline. That meant:

- no lazy-loading (every card on a long scroll eagerly fetched a full-res
  remote image),
- no responsive `srcset` / `sizes` (mobile fetched desktop-sized images),
- no AVIF/WebP transcode.

All three hurt LCP and bandwidth on exactly the surface paid acquisition
lands on.

## Decision

Migrate `DiscoverRecipeImage` to `next/image` (`fill` layout, preserving the
parent aspect-ratio box + rounded corners + `object-cover` + hover scale).
This gives lazy-loading (non-`priority` default), a responsive `sizes` hint,
and lets Next emit `srcset` + AVIF/WebP — **but only for hosts on the
`images.remotePatterns` allowlist.**

### The unbounded-host problem

Recipe `image` values come from three classes of host:

1. **Bounded + trusted** — `images.unsplash.com` (seed heroes +
   `DEFAULT_UPLOADED_RECIPE_IMAGE`), `*.supabase.co` (user-uploaded recipe
   images in storage), `img.youtube.com` (thumbnails derived at render time
   by `heroImageFallback.extractYoutubeThumbnail`).
2. **Unbounded + user-controlled** — arbitrary `og:image` / `twitter:image`
   / JSON-LD image URLs scraped at import time from any recipe page or
   social post (`src/lib/recipe-import/parseRecipeFromHtml.ts`,
   `extractSocialRecipe.ts`). These are persisted raw to `recipes.image_url`
   (there is only a copyright **denylist** — e.g. `images.immediate.co.uk` —
   not an allowlist, and no rehosting to storage).

Routing class (2) through Next's on-the-fly optimizer (`/_next/image`) would
turn that endpoint into an **open fetch proxy for any URL a user can paste** —
SSRF-adjacent and a bandwidth-amplification vector. The only ways to optimize
class (2) are to wildcard `remotePatterns` (`hostname: "**"`, rejected — opens
the proxy) or to rehost imported images into storage at import time (correct
long-term, but a backend/importer change out of ENG-704's web-only scope).

### Resolution (chosen)

- **Allowlist the bounded hosts** in `images.remotePatterns`
  (`images.unsplash.com`, `*.supabase.co`, plus **newly added**
  `img.youtube.com`). These route through the optimizer and get
  AVIF/WebP + `srcset`.
- **Render class (2) with `unoptimized`.** `DiscoverRecipeImage` parses the
  image host at render time (`OPTIMIZABLE_HOST_SUFFIXES`) and sets
  `unoptimized={!canOptimize(url)}`. Unoptimized `next/image` still
  lazy-loads, async-decodes, and sizes intrinsically (no layout shift) — it
  just skips the server transcode. Malformed / relative URLs are treated as
  un-optimizable so the build never sees an un-allowlisted host.

The two lists are kept in sync by comment: `OPTIMIZABLE_HOST_SUFFIXES` in
`discover-recipe-image.tsx` mirrors `images.remotePatterns` in `next.config.ts`.

## Preserved behaviour (non-regressions)

- Deterministic cuisine-aware gradient fallback (`RecipeHeroFallback`) for
  missing images **and** for images that error at runtime (stale Unsplash
  seeds / dead OG URLs) — via the existing `onError → setBroken(true)` path.
- Aspect ratio, rounded corners, `object-cover`, hover scale transform,
  decorative empty `alt`, click/nav, and the `thumb` (More ideas list) variant.

## Follow-up

- **Rehost imported images to Supabase storage at import time** so the whole
  feed becomes optimizable under a single allowlist and class (2) disappears.
  Backend/importer work — out of scope here. (Suggested owner:
  `integration-manager` / `data-integrity`.)
- Windowing/virtualisation of the Discover scroll is noted in ENG-704 as a
  separate future item — deliberately **not** done here.
- Mobile uses `expo-image` separately; no change. Not a parity gap.

## Validation

`npx tsc -p tsconfig.json --noEmit` (cold) → pass. `npm run build`
(`.next` cleared) → pass, no image-host errors. `eslint` on the changed
files → clean (suppression removed). `tests/unit/discoverRecipeImage.test.tsx`
(15 cases) + `tests/unit/recipeHeroFallback.test.ts` parity (15) → pass.
