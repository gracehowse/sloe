# Recipe-detail macro summary → flat Figma 332:2 number strip (ENG-920, 2026-06-07)

**Status:** Resolved.
**Authority:** Grace (product) — ENG-920.
**Owner:** Grace. Implementation: this branch (`claude/sloe-redesign-2026-06-04`).
**Files:**
- `src/app/components/RecipeDetail.tsx` (web in-app detail)
- `apps/mobile/app/recipe/[id].tsx` (mobile detail)
- `tests/unit/recipeDetailLayoutWeb.test.tsx`,
  `tests/unit/recipeDetailFigmaReskin.test.ts`,
  `apps/mobile/tests/unit/recipeDetailV3SourcePins.test.ts` (conformance pins)

## Problem

The recipe-detail macro summary rendered as **progress-bar tiles**: one card per
tracked macro (Protein / Carbs / Fat / Fiber…), each showing a value, an
`of {target}` caption, and a small per-macro progress bar. Figma frame **332:2**
specifies a different treatment for this block — a **flat number strip**: four
equal columns, each a serif (Newsreader) value + a small-caps label, in one
cream/white card, with **no progress bar or ring**, leading with **CAL**
(calories first), then **PRO / CARB / FAT**.

The progress-bar tiles also carried a stale `ENG-920 … DEFERRED` comment from
when the tiles-vs-flat decision was still open. ENG-920 is now resolved to the
flat strip.

The public-share recipe page (`app/recipe/[id]/page.tsx`) had **already** shipped
the Figma 332:2 flat strip; the in-app + mobile detail surfaces had not, so the
three recipe-detail surfaces were out of parity.

## Decision

Replace the progress-bar macro tiles on the **in-app web** and **mobile** detail
surfaces with the Figma 332:2 flat strip, mirroring the already-shipped
public-share strip so all three surfaces read identically.

### Strip layout (all three surfaces)

- **One card**, four **equal columns** with hairline column dividers
  (`border-l` / `borderLeftWidth`).
  - Web in-app: the established `whiteSlabStyle` (white slab + soft elevation on
    the cream page).
  - Mobile: white `colors.background` slab + `useCardElevation({ variant: "soft" })`.
  - Public-share: `bg-card border border-border` (its cream page).
- **Columns, calories first:** `CAL / PRO / CARB / FAT`.
- **Value:** Newsreader serif, **24px**, weight 400, plum ink
  (`--font-headline` / `text-foreground-brand` on web; `FontFamily.serifRegular`
  + `colors.navPrimary` on mobile), tabular-nums. Unit (`g`) is a smaller
  secondary run; CAL has no unit.
- **Label:** small-caps, 11px, semibold, letter-spaced
  (`uppercase tracking-[0.1em]` / `letterSpacing: 1`), secondary ink.
- **No per-macro progress bar, no ring, no `of {target}` caption.**

### Values & net-carbs lens (preserved)

- The strip shows **integer** glance values (`${Math.round(...)}`), matching the
  public-share strip. Per-decimal precision still lives on the Nutrition tab.
- The **net-carbs lens** is preserved end-to-end. The CARB column swaps its
  label to `NET` and its value to net carbs via the shared
  `carbsLabel(fibre, lensEnabled)` / `netCarbsForRow(carbs, fibre, lensEnabled)`
  helpers — the same single-source-of-truth helpers every other surface uses.
  When the lens is off (or fibre is unknown) the column reads `CARB` with total
  carbs, exactly as before.

### CAL / fiber tile choice

The Figma strip is **fixed at four columns** (CAL / PRO / CARB / FAT). Two
consequences vs the old tiles:

1. **CAL is now shown in the strip** (it was previously only in the dedicated
   kcal line above; the kcal line is unchanged and stays). Leading the strip
   with CAL matches Figma 332:2.
2. **Fiber (and sugar / sodium)** are no longer strip columns. To avoid dropping
   any value a user tracks, tracked micros with a non-zero value render as a
   **secondary chip row** below the strip (`recipe-macro-micro-chips`), gated on
   `recipeMacrosToShow.includes(<macro>)` and value `> 0`. No tracked nutrition
   value disappears with the layout change.

This keeps Figma parity (four-up strip) without losing the fiber value that
fiber-tracking users rely on.

## Out of scope (unchanged)

- The dedicated **kcal headline line** above the strip
  (`329 kcal · per portion`) from the 2026-05-02 decision — unchanged.
- The **Fits your day** verdict below the strip — unchanged.
- The **Nutrition tab** 2×2 stat grid + micronutrient bars — unchanged.
- The **Today** screen macro tiles — a separate, already-correct component,
  explicitly not touched.
- The public-share strip — already shipped; used as the reference.

## Tests

- `tests/unit/recipeDetailLayoutWeb.test.tsx` — the macro-grid source pins +
  RTL harness now assert the flat strip: `grid grid-cols-4`, serif value at
  24px, small-caps labels, CAL-first column order, no progress-bar fill, and
  the tracked-micro chip row.
- `tests/unit/recipeDetailFigmaReskin.test.ts` — new `ENG-920` block pins the
  flat strip across public-share + in-app + mobile (CAL-first, serif 24px,
  small-caps labels, no bar, net-carbs lens swap, micro-chip overflow, and the
  stale `DEFERRED` comment removed).
- `apps/mobile/tests/unit/recipeDetailV3SourcePins.test.ts` — the mobile
  macro-grid block replaced with flat-strip pins (serif value, `borderLeft`
  column dividers, no `width: %` bar, net-carbs lens, micro-chip row).

## Parity

| Concern | Web in-app | Mobile | Public-share |
|---|---|---|---|
| Card | `whiteSlabStyle` slab | white slab + soft elevation | `bg-card border` |
| Layout | `grid grid-cols-4` | `flexDirection: row`, `flex: 1` cols | `grid grid-cols-4` |
| Columns | CAL / PRO / CARB / FAT | CAL / PRO / CARB / FAT | CAL / PRO / CARB / FAT |
| Value | `--font-headline` 24px plum | `serifRegular` 24px `navPrimary` | `--font-headline` 24px plum |
| Label | `uppercase tracking-[0.1em]` 11px | `letterSpacing: 1` 11px | `uppercase tracking-[0.1em]` 11px |
| Net-carbs lens | label+value swap (shared helpers) | label+value swap (shared helpers) | n/a (no per-user lens on share) |
| Tracked micros | chip row below strip | chip row below strip | chip row below strip |

The platform layout primitive differs (CSS grid vs RN flex row) — unavoidable
(no React Native CSS Grid); the intent (one card, four equal columns, flat
serif numbers) renders identically.

## Visual validation

- Mobile (iOS sim, iPhone 17 Pro): `apps/mobile/screenshots/agent/eng920-mobile-recipe-detail.png`
  — flat strip renders `380 / 13g / 18g / 28g` under `CAL / PRO / CARB / FAT`,
  serif, one white slab, hairline dividers, no bars.
- Web in-app shares the identical JSX pattern as the verified public-share
  strip.
