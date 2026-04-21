# Recipe Detail — top bar + tag row port (2026-04-20)

**Status:** Resolved
**Area:** UX / web + mobile parity
**Owner:** product-engineer (Grace-directed)

## Context

The Recipe Detail top area previously rendered the back, save, and share
controls as **absolutely-positioned pills floating over the hero image**.
Grace's 2026-04-20 Claude Design prototype revises this to a standard
**sticky top bar** (light background, dark text, centred bold title, back
chevron on the left, bookmark + share icons on the right) sitting
**above** the hero image, with a **tag pill row** directly under the
hero.

## Decision

- **Sticky top bar** rendered outside the scroll container.
  - Mobile: a `<View>` with `paddingTop: insets.top` + 56pt row, rendered
    outside `ScrollView`.
  - Web: existing `sticky top-0` header kept; gradient title replaced
    with centred semibold `text-foreground`.
- **Hero image** starts below the bar, not overlapping. 280pt on mobile,
  existing `aspect-video` on web.
- **Tag pill row** directly under the hero image on both platforms.
  - Neutral grey rounded-full pills for each recipe tag.
  - Trailing primary-tinted `{N}%` pill computed from
    `computeRecipeFitPercent` (same helper the Discover card uses).

## Tag source

Production recipes have no `tags` column. The row is therefore populated
from the closest existing per-recipe category array:
- Mobile: `FullRecipe.meal_type`.
- Web: `RecipeCard.mealSlots`.

When neither is populated, the row collapses to just the fit-percent
pill. We do **not** invent tags.

## Fit percent input

Both platforms call `computeRecipeFitPercent(recipe-macros, null)` —
targets are passed as `null` to pin to the helper's documented neutral
anchor (85%). This is deliberate: mobile only loads macro-gram targets
(no calorie target) in this screen, so passing partial targets would
produce a different number per platform. Passing `null` on both keeps
web + mobile deterministically aligned and honest about the fact that
the percent is a neutral placeholder until the recipe-detail screen
loads full daily targets. The helper exposes `synthesised: true` in
this case; a future iteration can label the pill accordingly.

## Preserved behaviour

- `goBack` / back navigation
- `toggleSave` bookmark persistence
- Share link via `webRecipeDeepLink` (same URL scheme on both)
- HealthKit permission prompts (mobile-only; unchanged)
- Edit / Go public / Unpublish / Cook controls (web, unchanged)

## Files

- `apps/mobile/app/recipe/[id].tsx` — new sticky top bar + tag row.
- `src/app/components/RecipeDetail.tsx` — centred title + tag row.
