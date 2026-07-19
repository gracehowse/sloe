# Ingredients render as text — no icon/image tiles (ENG-1611)

**Date:** 2026-07-19
**Decider:** Grace ("ingredients shouldnt have images next to them in recipes
or in search. no icons or images" / "no images here for ingredients — follow
the prototype"; two annotated screenshots, prioritised High same day)
**Status:** Implemented behind `ingredient_text_rows_v1` (default OFF)

## Decision

Foods and ingredients render as **text rows** — no glyph tiles, no monogram
tiles, no photos — on:

- the LogSheet browse rows (Go-tos / Recent / Saved / My recipes) + their
  loading skeletons, both platforms;
- the recipe-detail Ingredients section, both platforms, which becomes the
  prototype's dotted-leader list (`.rd-ing` mobile / `.w-ing` web — the
  prototype's **default** state; its `.ing-tiles` photo grid is a
  superseded toggle-on variant).

Food **search** rows were already text-only on both platforms (ENG-814/1532
grammar) — they are the sibling grammar the new rows converge on. Recipe
**card** surfaces (Library / Discover / Plan grids) keep real photos —
recipe imagery is not ingredient imagery.

## Scope call inside the LogSheet

"My recipes" rows are recipes, not foods, and could keep their real photo
thumbnails. They go text-only anyway: one sheet, one row grammar
(same-element-same-treatment), and the search rows directly above them are
text. Deliberate, cheap to veto — flag-off restores everything.

## What survives the tiles

The tiles carried real information; the text rows rehome all of it:

- **Provenance SourceDot** (D-2026-04-27-16, incl. the sparkle = AI-estimated
  macros) — inline after the quantity on both platforms.
- **Verification tier** — mobile keeps it in the a11y label + tap-through
  info sheet (as the grid did); web keeps the categorical tier label
  (F-120, no opaque %), the Verify → CTA, and the owner Fix/Override hover
  affordances, plus per-row kcal and Override/Added badges.
- FatSecret ToS attribution, the 8-row collapse ("View all N"), and scaled
  amounts are unchanged.

## Cost + mechanics

- Flag ON bypasses `useIngredientTileImages` with a stable empty source list
  on both hosts — no `ingredient_images` reads, no generate-on-miss POSTs
  for pixels that never render.
- `FoodFallbackThumb` and the Sloe image system stay intact for the
  out-of-scope card surfaces; only call sites are gated.
- `postIngredientImage` transports extracted to
  `apps/mobile/lib/recipe/postIngredientImage.ts` /
  `src/lib/recipe/postIngredientImage.ts` (screen-budget shrink);
  tier colour/label maps to `src/lib/recipe-ingredients/ingredientTierDisplay.ts`.
- Supersedes the ENG-1287-era carve-out that kept FoodFallbackThumb samples
  on food ROWS. `IngredientImageTile.tsx` (both platforms) was already
  orphaned pre-change; cleanup rides the flag-collapse PR, not this one.

## Verification

Wiring + registry-parity tests in `tests/unit/ingredientTextRows.test.ts`;
flag-off legacy paths pinned by the existing `logSheetFoodThumb` +
trust-posture suites (all green). Flag-on pixels: sim + web captures on the
ENG-1611 PR.
