# Recipe detail polish patch (2026-05-05)

**Status:** Resolved.
**Authority:** Grace 2026-05-05 in-session feedback after a screenshot of the
Spicy Feta Chicken Crunch detail page; option-A approval given after the
side-by-side prototype at `/dev/recipe-detail-redesign`.
**Owner:** Grace / executor.

## Problem

5 separate papercuts on Recipe Detail compounded into a perceived
"redesign needed" complaint:

1. The empty hero looked like ~40% of the screen was wasted.
2. `≈ 20% of your day` rendered twice — once as a mid-page pill, once
   in the green footer line.
3. `Edit servings` was a redundant text link directly above a stepper
   that does the same job.
4. Verbose copy: `Servings to view`, `lunch · serves 3 · by author`.
5. The macro-tile caption `of 122g` repeated the unit 4 times in a
   tile grid that already showed the unit on the value line.

`ui-product-designer`'s read (correctly) was that the bones are fine
and a redesign would over-correct — the polish patch fixes the 5
issues with no new components.

### Bonus diagnostic the spec surfaced

The "empty hero" Grace was looking at wasn't actually empty:
`apps/mobile/app/recipe/[id].tsx` previously did
`picked ?? DEFAULT_IMAGE`, falling back to a hardcoded Unsplash photo
of stranger food at 280pt. The Library card already used the
deterministic gradient `RecipeHeroFallback`; aligning the detail
screen to the same component is the right fallback.

A second case surfaced during validation: Instagram CDN URLs use
signed tokens that expire (Grace's Spicy Feta recipe had an expired
token). When `<Image>` fails to load, RN renders a 280pt grey
rectangle — visually indistinguishable from the old Unsplash
fallback Grace was complaining about. The patch handles this by
tracking `onError` on the hero image and swapping to the gradient
fallback in the broken-URL case too.

## Fix

Six coordinated changes (C1–C6), all in this commit:

| # | File | Change |
|---|---|---|
| **C1** | `apps/mobile/app/recipe/[id].tsx`, `apps/mobile/components/RecipeHeroFallback.tsx` (existing), `app/recipe/[id]/page.tsx` | Replace `DEFAULT_IMAGE` Unsplash fallback with `RecipeHeroFallback` gradient at 140pt (mobile) / aspect-ratio 16:7 gradient block (web). Track `onError` on `<Image>` so broken IG/TikTok CDN tokens also fall through to the gradient. |
| **C2** | `apps/mobile/app/recipe/[id].tsx` | Cut the mid-page `≈ X% of your day` pill. Footer `Fits your day · ≈ X%` is the single source of truth. |
| **C3** | `apps/mobile/app/recipe/[id].tsx` | Replace the `Edit servings` text link (above the stepper) with a small ✏ pencil icon on the stepper card's right edge, owner-only. Spatial association with what it edits. |
| **C4** | `apps/mobile/app/recipe/[id].tsx` | Stepper label `Servings to view` → `Servings`. Stepper context implies "to view"; pencil disambiguates the authored-yield edit path. |
| **C5** | `apps/mobile/app/recipe/[id].tsx`, `src/lib/recipe/recipeDetailLayout.ts` | Drop `serves N` from the subtitle. Stepper card directly below is the canonical source of truth. `composeSubtitleParts` accepts `servings: number \| null` so `null` cleanly drops the token. |
| **C6** | `apps/mobile/app/recipe/[id].tsx` | Demote macro-tile `of 122g` caption from 11pt full opacity to 9pt at 0.6 opacity, drop the redundant unit suffix on the caption (the value line above already shows it). 4 noisy repeats → 4 quiet repeats. |

Web parity: only **C1** propagates because the public web page has no
stepper / owner controls / "Fits your day" line (those are
mobile-only by design — sync-enforcer carve-out). The OpenGraph
`images` and JSON-LD `image` are also null-safe now: when a recipe
has no real photo, OG falls to a generic brand image (no
`og-default.png` shipped yet — added as a P3 follow-up) and JSON-LD
omits `image` entirely rather than fabricate.

## Validation

- **Sim — recipe with NO image** (Sausage ragu by Esther Clark):
  `/tmp/sim-check/after-recipe-detail-no-image.png` shows gradient
  at 140pt + utensils glyph, all 6 patch outcomes visible.
- **Sim — recipe with BROKEN image** (Spicy Feta, IG CDN token
  expired): `/tmp/sim-check/after-recipe-detail-broken-ig.png`
  shows gradient at 140pt — the broken-image path now triggers the
  same fallback.
- **Sim — recipe with IMAGE** (any saved recipe with a fresh
  `image_url`): hero stays at 280pt, no behaviour change.
- **Vitest:** 32/32 web layout + 19/19 mobile layout tests pass.
- **`tsc --noEmit`** clean web + mobile.
- **Side-by-side prototype:** http://127.0.0.1:3000/dev/recipe-detail-redesign
  documents the BEFORE/AFTER per change with C# pills.

## Hard NO list (rejected — to avoid the C1-mockup duplication trap)

- No macro chip strip above the 2x2 tiles.
- No second log-from-recipe CTA.
- No new percent pill, ring, or progress glyph.
- No eyebrow chip / category badge / source-confidence chip.
- No background colour change, no token churn.
- No premium-feel rework of the bones.

## Cross-platform

C1 ports to web. C2–C6 are mobile-only by design (web public recipe
page has no stepper, no owner controls, no fits-your-day verdict —
public marketing surface, no auth user). Sync-enforcer carve-out
documented.

## Closes

- Grace's 2026-05-05 in-session recipe-detail feedback.
- Notion task [`Audit P1] Recipe detail page — redesign`](https://www.notion.so/35759b415030817b8952d947fd8a66be) → mark Done.
