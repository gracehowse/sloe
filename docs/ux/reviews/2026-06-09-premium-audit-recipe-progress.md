# Premium-bar audit — Recipe detail + Progress/Weight (2026-06-09)

Pixel-grounded vs Julienne/NYT Cooking (recipe) and MacroFactor/Withings/
Whoop (trends). Persisted from the session transcript. Two-axis verdicts.

## Recipe detail — AT BAR vs Julienne; concept BETTER (does what Julienne/NYT can't)

Ranked gaps (none ship-blocking except noted):

1. **(P1, sev 4) Duplicate cook primary** — top-row "Start Cooking" and the
   sticky-footer "Cook Mode" are the SAME destination at near-equal weight.
   Fix: demote/remove top "Start Cooking"; make **Log** the dominant top-row
   action (logging is the product's spine). Files:
   `apps/mobile/components/recipe/RecipeActionPills.tsx`,
   `RecipeServingsFooter.tsx`.
2. (sev 3) Fit chip whispers — raise to 14pt semibold + tap-to-expand
   "≈ 580 of your 1,650 kcal — leaves room for two more meals".
3. (sev 3) Method steps in `textSecondary` grey — promote body to primary ink
   + hairline rhythm between steps (`RecipeMethodSteps.tsx`).
4. (sev 2) No tap-to-strike on in-page method steps (local dim/strike toggle).
5. (sev 3) Ingredient tap fires a native `Alert`; `IngredientInfoSheet.tsx`
   exists — route the tap there ([id].tsx ~L1492). Drop the unexplained
   per-tile source-dot or move provenance into the sheet.
6. (sev 2) "Not tagged for allergens" renders a full card on every recipe —
   collapse the null state to one quiet line; full card only when an allergen
   IS present.
7. (sev 1) Hero photo bottom edge → add 16px fade into page tone (title-on-
   cream is a DEFENDED choice; keep).
8. (sev 1) Macro strip: 180ms count-up when yield stepper changes.

BETTER-THAN-BAR (defended, do not conform): Fits-your-day chip; per-serving
serif macro strip; yield→ingredients→log→cook lock-step scaling; per-
ingredient verification provenance (fix presentation only). Also defended:
serif-on-cream title; no fake ratings; aubergine outline primary.

## Progress/Weight — CLOSE, with two P0s

1. **(P0-1) The Progress weight card renders a toy `Sparkline` while the
   Withings-grade `WeightChart` (scrub + value pill + axis labels + goal line
   + range ticks) is already built and mounted only on the deprecated
   `/weight-tracker` route.** Fix: mount `WeightChart` in the Progress weight
   card (`progress.tsx` ~L1336-1361), feed it the top range-picker's
   `rangeKey` (today the chart is hardcoded `"1m"` while the picker drives all
   other stats — broken affordance), delete the Sparkline path. Mostly wiring.
2. **(P0-2) Adherence headline tone** — partially fixed this session (card is
   gated on `hasEnoughDataForStory(caloriesRange.daysLogged)`), but the
   remaining product call stands: the story-gate reads THIS WEEK while
   adherence reads the 30d range (two windows, one scroll), and a >100%
   number as a 40pt hero is shame-coded. Demote the % or pair with an
   explicit on-track/over verdict. Route: ui-product-designer.
3. (sev 3) Week-delta chip on Progress is grey; `weight-tracker.tsx` already
   computes `rangeDelta.tone` (sage toward goal / amber away) — port it.
   Arrow stays factual/uncoloured (defended anti-shame rule).
4. (sev 3) `/weight-tracker`'s two stacked pill rows (chart range + HealthKit
   import depth) collide; moot if the route collapses — move import-depth to
   Health Sync and let the route die (per in-code Phase 3 note).
5. (sev 2) Daily-calories legend pip colour ≠ the in-chart goal marker.
6. (affirm) Tap-a-bar→that-day deep link is better than the bar; add a subtle
   press-state hint.

BETTER-THAN-BAR (defended): story-gate concept; adaptive TDEE in free tier;
the `WeightChart` component itself (just mis-placed); weight surface opt-out
(`weight_surface_mode`); one-colour trend line with verdict in the caption.
