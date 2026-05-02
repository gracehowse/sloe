# Build 12 (1.0.0 #12) — 2026-05-01

## Fixed

_(none — micros breadth release)_

## New

- **Today — micronutrient headline tiles + full nutrient panel.**
  A 4-tile horizontal-scroll widget below the macro tiles surfaces
  fibre, iron, vitamin D, and sodium against the FDA 2020 Daily Value,
  with a colour-ramped %DV bar (sodium ramps amber over 80% / red at
  100%). Below the tiles, a "View all 35 nutrients" CTA opens the
  new `FullNutrientPanelSheet` — a bottom sheet listing every
  curated macro, vitamin, and mineral (35 entries) against its FDA
  reference, sorted by %DV descending so deficiencies surface first.
  Closes the Cronometer power-user persona gap from the customer-lens
  audit (the previous "all-nutrients" link surfaced the same data as
  bare rows; this sheet gives users a %DV signal alongside each row).
  Mobile (`apps/mobile/components/today/{TodayMicrosWidget,FullNutrientPanelSheet}.tsx`)
  + web (`src/app/components/suppr/{today-micros-widget,full-nutrient-panel-sheet}.tsx`)
  ship the same composition. DV table at
  `src/lib/nutrition/dailyValues.ts` cites 21 CFR 101.9(c).

## Coming soon

_(none yet)_
