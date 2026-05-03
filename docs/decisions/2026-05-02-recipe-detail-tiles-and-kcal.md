# Recipe detail v4 polish: 4-up macro tiles + dedicated kcal line (2026-05-02)

**Status:** Resolved.
**Authority:** User feedback against v3 (PR #19, 2026-05-01).
**Owner:** Grace (product). Implementation: `claude/recipe-detail-tiles-and-kcal-v2`.
**Files:** `apps/mobile/app/recipe/[id].tsx`, `src/app/components/RecipeDetail.tsx`,
`src/lib/recipe/recipeDetailLayout.ts`, plus pin-tests and changelog.

## Problem

Two visual fixes raised against the v3 redesign:

1. **"the widgets should be the same size and fit on one row"** —
   v3 rendered the macro tiles in a `flex flex-wrap` (web) /
   `flexDirection: row, flexWrap: wrap` (mobile) layout with each
   tile capped at `max-w-[48%]` / `maxWidth: "48%"`. With 4 tracked
   macros (Protein / Net carbs / Fat / Fiber, the default for users
   with fibre tracked) row 1 showed Protein/Carbs/Fat at ~33% each
   and Fiber dropped to row 2 alone at 48%. The tiles read as
   different-sized things and the standalone Fiber tile drew the
   wrong attention.

2. **"cals need to be clearer"** — v3 promoted kcal out of a
   bordered hero card (the v2 form) and inlined it in the subtitle
   row as a bold token: "lunch · serves 3 · **329 kcal** · by
   emthenutritionist". Despite the bold weight, kcal was still a
   13-pt token sandwiched between four other tokens at the same
   font size. Calories were the most-asked-for number on the screen
   but did not read as the most prominent number on the screen.

## Decision

### Layout

1. **Macro grid: 4-up, equal-width tiles.**
   - Web: switch the container from `flex flex-wrap gap-2.5` with
     per-tile `max-w-[48%] flex-1` to **`grid grid-cols-4 gap-2`**.
     All tiles now share a width regardless of how many tiles
     render. Users tracking 5–6 macros (sugar/sodium added) get a
     second row at the same per-tile width — same width is the
     point.
   - Mobile: keep `flexDirection: "row", flexWrap: "wrap"` so narrow
     widths (<360 pt) wrap naturally below `minWidth: 70`, and
     5–6-tracked-macro users still spill onto row 2. Replace the
     per-tile `flexGrow: 1, minWidth: 76, maxWidth: "48%"` with
     `flex: 1, minWidth: 70`. Tighten gap from `10` to `Spacing.sm`
     (8 pt) and tile padding from `14` to `12` so 4 tiles fit on one
     row at iPhone 14/15/16 Pro 393 pt. Tile value font drops from
     `fontSize: 20` to `fontSize: 18` to absorb the narrower content
     box without truncation. Vertical stack inside the tile is now
     `dot + label → number → "of Xg" caption → progress bar at the
     bottom`, matching the v4 spec.

2. **Calories on their own headline line.**
   - `composeSubtitleParts` is no longer passed `kcal`. The shared
     helper still drops the `kcal` token cleanly when the arg is
     omitted (the existing unit-tested path), so the subtitle row
     reverts to "{slot} · serves {N} · by {author}".
   - A new `recipe-kcal-line` element renders directly between the
     title and the subtitle:

     ```
     329 kcal · per portion
     ```

     - Web: `text-[17px] font-bold text-foreground tabular-nums`.
     - Mobile: `kcalNumber` style — `fontSize: 17, fontWeight: "700",
       color: colors.text, fontVariant: ["tabular-nums"]`.
   - Gated on `kcalForLine > 0` so the dimmed `recipe-nutrition-
     pending` placeholder still takes over for un-imported recipes
     (P1-16 behaviour preserved).
   - The line also carries `recipe-kcal-number` on the numeric
     element so RTL renders can target the value directly for size /
     weight assertions.

### Out of scope

- The `composeSubtitleParts` helper still accepts `kcal` for
  backward compatibility; only call sites stop passing it. Existing
  unit tests around "drops kcal when omitted/null/0" continue to
  pass and now describe the production path.
- The `kcalForSubtitle` constant in mobile is renamed to
  `kcalForLine`; the StyleSheet entry `subtitleTextStrong` survives
  in case future inline bold tokens are added but is no longer
  applied to the (now-gone) subtitle kcal.

## Tests

Pin tests on both platforms guard against the v3 layout coming back:

- `tests/unit/recipeDetailLayoutWeb.test.tsx` — source pins +
  helper-driven RTL render harness:
  - `composeSubtitleParts` call site does NOT contain `kcal:`
  - `recipe-subtitle-kcal` testID does NOT exist in the source
  - `recipe-kcal-line` and `recipe-kcal-number` testIDs DO exist
  - kcal line uses `text-[17px] font-bold text-foreground tabular-nums`
  - line is gated on `kcalForLine > 0`
  - `recipe-macros-grid` uses `grid grid-cols-4`
  - tiles do not use `max-w-[48%]`
  - tiles carry `recipe-macro-tile-${macro}` testIDs
  - RTL renders confirm 4 tiles in one grid row when 4 macros are
    tracked, and 6 tiles spilling to row 2 at the same width when
    sugar+sodium are added
- `apps/mobile/tests/unit/recipeDetailV3SourcePins.test.ts` —
  source pins for the same contracts on mobile.
- `apps/mobile/tests/unit/recipeDetailLayout.test.ts` — pure-helper
  tests (composeSubtitleParts / computeFitsYourDayVerdict) unchanged
  and continue to pass.

## Parity

Same composition on both platforms:

| Concern | Web | Mobile |
|---|---|---|
| Macro grid container | `grid grid-cols-4 gap-2` | `flex 1 minWidth 70 + flexWrap row Spacing.sm gap` |
| Per-tile testID | `recipe-macro-tile-${macro}` | `recipe-macro-tile-${macro}` |
| kcal line testID | `recipe-kcal-line` | `recipe-kcal-line` |
| kcal number testID | `recipe-kcal-number` | `recipe-kcal-number` |
| kcal copy | "{N} kcal · per portion" | "{N} kcal · per portion" |
| kcal font size | `text-[17px] font-bold` | `fontSize: 17, fontWeight: "700"` |

The platform-specific layout primitive differs (CSS grid vs RN
flexbox) — this is unavoidable: there is no React Native CSS Grid.
The intent ("tiles share a width and fit 4 across") is preserved in
both renders.

## Preserved from v3

- Inline meal-type token (now in subtitle's slot key, not a separate
  pill).
- "Fits your day · ≈ N%" verdict line below tiles, driven by
  `computeFitsYourDayVerdict`.
- Drop-empty-time-stats-row behaviour (`shouldRenderTimeStats`).
- Allergens "Contains: Milk" line.
- The hero `recipe-calorie-hero` testID stays gone.
