# Recipe detail — collapse clunky stacking, fuse fits-your-day, hide empty time stats

- **Date:** 2026-04-30
- **Area:** Recipe detail (mobile + web)
- **Status:** Resolved
- **Authority:** ui-product-designer audit run, 2026-04-30

## Context

The Spicy Feta Chicken Crunch screenshot (TestFlight, 2026-04-30) showed
the recipe-detail body reading as five visually competing cards stacked
on top of each other:

1. Title
2. "by emthenutritionist" underlined link
3. Standalone "Lunch" pill
4. Three big icon-circle stats (Prep / Cook / Servings) plus a
   "Confidence: Estimated" tile that surfaced a backstage signal
5. Calories hero card with a separate "Fits your day" verdict pill
   floating directly underneath

Tester read this as several disconnected widgets. The "Fits your day"
verdict — the core differentiator vs MFP / Lifesum — was visually
detached from the calories number it was meant to qualify.

## Decision

Collapse the hero region into a single composed unit:

| Old                                          | New                                               |
| -------------------------------------------- | ------------------------------------------------- |
| Two-row attribution + slot pill              | Single flex-wrap subtitle: `by author · lunch · serves N`, joined by `·` separators |
| Three icon-circle stats + Confidence tile    | Compact one-line `15 min prep · 30 min cook` (hidden when both timings are unknown) |
| Kcal hero + standalone fits-your-day sibling | Verdict pill is a CHILD of the calorie hero (testID `recipe-calorie-hero`) |
| `space-y-8` / `gap: Spacing.lg` body rhythm  | `space-y-5` / `gap: Spacing.md` so the hero reads as one block |
| Confidence tile (Verified / Estimated)       | Removed — backstage signal with no actionable interpretation |
| Owner edit-servings as the third stat tile   | Inline `Edit servings` link in the time-stats row |

## Implementation

- Shared helper `src/lib/recipe/recipeDetailLayout.ts` with two pure
  functions (`shouldRenderTimeStats`, `composeSubtitleParts`)
  re-exported on mobile from `apps/mobile/lib/recipe/recipeDetailLayout.ts`
- Mobile: `apps/mobile/app/recipe/[id].tsx`
  - subtitle row replaces `mealTypeBadge` + author block
  - time-stats row gated by `shouldRenderTimeStats`
  - kcal hero + fits-your-day pill fused into a single `View` with
    `testID="recipe-calorie-hero"`; verdict pill carries
    `testID="recipe-fits-your-day"`
  - dead `infoRow / infoItem / infoIcon / infoValue / infoLabel /
    mealTypeBadge / mealTypeText / calorieHero / calorieLabel`
    StyleSheet entries removed
- Web: `src/app/components/RecipeDetail.tsx`
  - body `<h1>` title + flex-wrap subtitle inserted between hero
    image and tag pills (closes parity gap — web previously had no
    body title or attribution row)
  - 4-tile info row replaced with compact `recipe-time-stats` div
  - kcal hero block now carries `data-testid="recipe-calorie-hero"`
    with the verdict rendered inside as `data-testid="recipe-fits-your-day"`
  - body container moved from `space-y-8` to `space-y-5`
  - Confidence tile deleted

## Tests

- `apps/mobile/tests/unit/recipeDetailLayout.test.ts` — 8 tests
  pinning the helper logic (gate semantics, subtitle composition order,
  empty-state behaviour)
- `tests/unit/recipeDetailLayoutWeb.test.tsx` — 12 tests:
  - source-pin checks for body `<h1>`, subtitle testID, fused verdict
    placement, `space-y-5` body rhythm, removed Confidence tile
  - 3 RTL render assertions exercising the helper-driven JSX with a
    minimal harness so the structural contract (parent/child
    relationship between hero and verdict) is verified end-to-end

## Parity

Web and mobile now share the same composed-unit hero pattern, the
same testID names (`recipe-calorie-hero`, `recipe-fits-your-day`,
`recipe-time-stats`, `recipe-subtitle-row`), and the same pure-function
gating logic. No intentional divergence.
