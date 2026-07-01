# Import review — honest under-count surfacing (ENG-1283)

**Date:** 2026-07-01
**Ticket:** ENG-1283 (recipe-import audit fix #4a)
**Status:** Shipped behind `import_review_flagged_ingredients_v1` (default-ON, PostHog kill switch)
**Platforms:** web (`RecipeUpload`) + mobile (`import-shared`) — shared derivation

## Problem

When a social/URL import parses a recipe but leaves some ingredients unmatched —
below the `MIN_ACCEPT_CONFIDENCE = 0.55` floor (`belowAcceptFloor: true`,
excluded from `totals`/`perServing` per the G3 accept-floor decision), an LLM
extract, quantity-less, or otherwise `source: "Unverified"` with `calories: 0` —
the review UI showed the import as a **clean success with a silently
under-counted macro total**. The flagged data already existed in the result
(`ingredientMacros[].source`/`.calories`); the review just never told the user
the headline number was incomplete.

This contradicts the estimate-honest trust posture ("confidence is visible;
never silently fill numbers"): a macro total missing its below-floor rows is a
quiet under-count presented as fact.

## Decision

Surface the under-count **calmly and honestly** in the review, without blocking
the save:

1. A quiet, body-neutral line above the macro breakdown:
   - flagged rows present → **"N of M ingredients need review — the macro total
     may be incomplete."**
   - macro spine missing (per-serving `calories === 0`, the FM-2 zero-macro
     shell) → **"The macro total couldn't be calculated — review the
     ingredients before saving."**
2. The affected ingredient rows keep their "needs review" affordance (the
   existing warning glyph + muted row), now derived from the SAME predicate as
   the count so the row marking and the "N of M" agree exactly.

The note is a soft frost-grey advisory (muted fill + hairline border, an amber
`AlertCircle` glyph), deliberately quieter than the existing amber "Estimates
only" confidence banner — it informs, it does not stop-and-fix. It never blocks
saving: the user can still save; they are simply informed of the under-count.

## Reused derivation — no recompute

The whole surface derives from `src/lib/recipes/importQualitySignal.ts`
(the GROW-61 module), via three new pure helpers on the existing predicate:

- `isFlaggedIngredientRow(row)` — the inverse of `isMatchedIngredientRow` (a row
  is flagged iff it did NOT match a structured catalog with real macros).
- `importFlaggedSummary(recipe)` → `{ flaggedCount, totalCount, macroComplete,
  needsReview }`.
- `importFlaggedReviewLine(summary)` → the calm copy, or `null` when clean.

Because these share `isMatchedIngredientRow` with the analytics
`ingredient_match_rate` prop AND the persist layer's `recipe_ingredients.is_verified`
rollup (both gate on `isStructuredSource`), the count the user sees agrees with
what gets stored and what PostHog measures. No nutrition is recomputed here.

## Explicitly out of scope (fix #4a discipline)

This ticket is UI surfacing of data that **already exists**. It does NOT touch:

- the parser or the extractor;
- `verifyIngredients.ts` or the `MIN_ACCEPT_CONFIDENCE = 0.55` accept floor
  (see the G3 decision in `docs/product/nutrition-approximation-policy.md`);
- the IG/TT/YouTube caption-only legal posture
  (`2026-04-30-ig-tt-recipe-import-legal-posture.md`);
- the persistence path — the `route.ts` `calories: 0` persistence of below-floor
  rows is a **separate ticket**, intentionally left alone here.

## Flag

`import_review_flagged_ingredients_v1` — registered in `REDESIGN_DEFAULT_ON` on
both platforms (`src/lib/analytics/track.ts` + `apps/mobile/lib/analytics.ts`)
per the "always flag on" beta-window policy. Flag-OFF = today's silent-success
render exactly (the kill switch: remove from the set / PostHog off).

## Tests

- `tests/unit/importQualitySignal.test.ts` — the three new helpers (flagged
  row, summary states, copy incl. a body-neutral "no alarm words" assertion) +
  web wiring pins.
- `tests/unit/importReviewFlaggedNote.test.tsx` — web component: flagged shows
  the line, macro-missing variant, clean renders nothing.
- `apps/mobile/tests/unit/importReviewFlaggedNote.test.tsx` — mobile component
  render + `import-shared` wiring (flag-gate + shared per-row predicate).
- `tests/unit/redesignDefaultOnParity.test.ts` — the new flag is shared
  default-ON on both platforms (auto-covered by the identical-sets assertion).

## Follow-up

Default-ON visual change → wants a sim/web glance before wider ramp.
