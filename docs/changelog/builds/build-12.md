# Build 12 (1.0.0 #12) — 2026-05-02

## Fixed

- **Today — undid the segmented Remaining/Consumed chip + the 4-tile
  micros widget.** User feedback (2026-05-02) flagged both as
  cluttering Today: the chip duplicated what the long-press already
  did, and the micros widget rendered fibre twice (once in the
  widget, once in the macro tiles). Long-press on the calorie ring is
  now the single gesture for switching Remaining ⇆ Consumed and
  showing/hiding the inner protein/carbs/fat sub-rings. Micronutrient
  depth is preserved inside the full-nutrient panel sheet (see below)
  rather than on the Today canvas itself. See
  `docs/decisions/2026-05-02-revert-today-ui-changes.md`.
- **Library filter pills — text no longer squished against border.**
  Tester (2026-05-02) flagged the "All · 21", "Saved · 13",
  "High-Protein", "Quick" pills as having descenders kissing the
  border on iOS. Bumped vertical padding (`paddingVertical: 7 → 8`)
  and pinned an explicit `minHeight: 32` floor on mobile; web mirror
  goes from `px-3 py-1.5` → `px-3.5 py-1.5 min-h-8`. Horizontal
  padding already satisfied the 14pt floor — this was a vertical
  breathing-room fix. Mobile (`apps/mobile/app/(tabs)/library.tsx`) +
  web (`src/app/components/Library.tsx`).
- **Recipe detail — calories on their own headline line + 4-up macro
  grid.** Two visual fixes against v3 from user feedback (2026-05-02):
  (1) "the widgets should be the same size and fit on one row" — the
  macro tiles previously wrapped 3-up + fiber alone on row 2 at half
  width; now they share a width and fit 4 across (Protein / Net carbs
  / Fat / Fiber) with the same layout on web (`grid grid-cols-4`)
  and mobile (`flex: 1` with `flexWrap` preserved for narrow widths
  and 5–6-tracked-macro users). (2) "cals need to be clearer" — kcal
  was buried in the v3 subtitle ("lunch · serves 3 · 329 kcal · by
  emthenutritionist"); now it sits on its own dedicated 17-pt
  headline line directly under the title ("329 kcal · per portion"),
  with the meta row ("lunch · serves 3 · by author") smaller below.
  Mobile (`apps/mobile/app/recipe/[id].tsx`) + web
  (`src/app/components/RecipeDetail.tsx`).

## New

- **Today — full nutrient panel sheet (Cronometer parity).** Tap the
  "View all nutrients" pill in the macro tiles to open a sheet listing
  every curated macro, vitamin, and mineral against the FDA 2020
  Daily Value, sorted by %DV descending so deficiencies surface
  first. Limit nutrients (sodium / sat fat / cholesterol) ramp green
  → amber at 80% → red at 100%; target nutrients stay green
  regardless of overshoot. Mobile
  (`apps/mobile/components/today/FullNutrientPanelSheet.tsx`) + web
  (`src/app/components/suppr/full-nutrient-panel-sheet.tsx`) ship the
  same composition. DV table at `src/lib/nutrition/dailyValues.ts`
  cites 21 CFR 101.9(c).
- **Today — "Why this number?" tap-to-explain (audit gap #10).** Tap
  the small pill under the calorie ring to see how today's target was
  derived: maintenance TDEE (adaptive when we have it, formula
  otherwise), your stated goal & weekly pace, and the resulting
  daily kcal deficit / surplus. Closes the transparency moat
  competitors leave open. "Adjust target" CTA on mobile routes to the
  weekly check-in flow; web ships read-only until the profile-edit
  page lands. Mobile + web (`apps/mobile/components/today/WhyThisNumberSheet.tsx`,
  `src/app/components/suppr/why-this-number-dialog.tsx`).

## Coming soon

_(none yet)_
