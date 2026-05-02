# Build 11 (1.0.0 #11) — 2026-04-20

Placeholder entry for the next TestFlight build. Items will be added
here (and mirrored into `src/lib/changelog/entries.ts`) ahead of the
build being promoted.

Do not populate until the build is actually scheduled — an empty entry
is intentional so renderers that fetch "latest" don't break between
builds. See `docs/changelog/README.md` for the authoring workflow.

## Fixed

- **Recipe detail layout v3 — kcal inline, macros lead, empty time-stats hidden.**
  TestFlight feedback `AKzwcchbHQ14Z3FncjWo-LU` (Build 40, 2026-04-30):
  even after the v2 redesign the page still read as five visually
  competing cards stacked on top of each other. v3 collapses the
  bordered "329 kcal per portion" hero card into a bold inline kcal
  token in the subtitle row (`lunch · serves 3 · 329 kcal · by author`)
  so the kcal number lives at the same glance as the title. The macro
  tiles below now ARE the visual hero — bigger value font (20pt vs
  16pt), more padding (14 vs 10), 11pt labels — the only coloured
  surface above the fold. "Fits your day" softens to a single
  coloured text line beneath the macros (no card, no pill background).
  When nutrition isn't yet computed, a single dimmed placeholder
  takes the kcal hero's place so users can still tell "we haven't
  computed it" from "this recipe is 0 kcal" (P1-16 preserved).
  Mobile + web parity (`apps/mobile/app/recipe/[id].tsx`,
  `src/app/components/RecipeDetail.tsx`).

- **Progress — skeleton no longer pins indefinitely on a failed load.**
  `loadData` / `load` are now wrapped in `try/finally`, so a thrown
  supabase error (network blip, auth expiry mid-call) flips `loading`
  → false and the UI falls through to the empty or populated state
  rather than staying stuck on the skeleton loader. Mobile +
  web (`apps/mobile/app/(tabs)/progress.tsx`,
  `src/app/components/ProgressDashboard.tsx`).

## New

- **Progress — header + range picker ported to 2026-04-19 prototype.**
  Both mobile and web now show an uppercase range overline
  (`LAST 7 DAYS` / `LAST 30 DAYS` / `LAST 90 DAYS` / `ALL TIME`),
  large 28pt "Progress" title, and a round calendar-icon button
  top-right. A horizontal `[7d / 30d / 90d / All]` pill row below
  the header drives the overline text and the chart windows that
  already consumed `rangeDays` on web. Default range is `30d`,
  matching the prototype. Deeper card-level restructure (sparkline
  weight card, calories / protein bar cards) is deferred.

- **Today ring — central calorie number is now the dominant metric.**
  Lifted from 22 / 28pt to `Type.ringValueLg` (56pt) on mobile and
  56px on web per the Cal AI flagship convention, so the ring's
  central value reads as the primary number on Today rather than a
  peer of the macro tile values (~22pt) below. Drops to 48pt for
  4-digit goals (e.g. 1,847 kcal) so the centre never clips the
  inner-most macro-ring band. Mobile keeps `numberOfLines=1` +
  `adjustsFontSizeToFit` (down to `Type.ringValue` 36pt) as a
  belt-and-braces safety net for freak 5-digit values. Closes
  ui-critic finding #7. Mobile + web
  (`apps/mobile/components/charts/CalorieRing.tsx`,
  `src/app/components/suppr/daily-ring.tsx`).

## Coming soon

_(none yet)_
