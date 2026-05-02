# Build 11 (1.0.0 #11) — 2026-04-20

Placeholder entry for the next TestFlight build. Items will be added
here (and mirrored into `src/lib/changelog/entries.ts`) ahead of the
build being promoted.

Do not populate until the build is actually scheduled — an empty entry
is intentional so renderers that fetch "latest" don't break between
builds. See `docs/changelog/README.md` for the authoring workflow.

## Fixed

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
- **Photo log — clearer big number, smarter confidence meter.** The
  review screen now leads with a single midpoint kcal number for the
  whole plate plus a 4-segment confidence meter, with the range hidden
  in a tappable caption. Each item collapses to a one-line summary
  with its own meter; expand to edit macros or tap "Verify with
  database" to lock the values to a known USDA / Open Food Facts
  match. The save button reads "Log verified" / "Log meal" / "Log
  estimate" depending on how many items you've verified.

## Coming soon

_(none yet)_
