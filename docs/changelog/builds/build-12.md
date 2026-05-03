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
