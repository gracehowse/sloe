# Cookbook single filter row (ENG-1607)

**Date:** 2026-07-19
**Decider:** Grace ("two lines here looks bad", chat screenshot of the stacked
filter rows; approved the one-row fix same day)
**Status:** Implemented behind `library_single_filter_row_v1` (default OFF)

## Decision

The Recipes tab (Library/Cookbook) shows **one** standing filter chip row —
the provenance row (All / Saved / Created / Imported) — on both platforms.
The standing category pill row (All / Breakfast / Lunch / Dinner / Dessert /
Quick 30 / …) is removed on the flagged path.

## Why

The two-row stack was two design eras layered on top of each other:

- The **category row** (ENG-921) was built against Figma `527:2` — the Figma
  that was declared dead as a source of truth on 2026-06-24.
- The **provenance row** was added back by ENG-1247's "Both rows" call during
  v3 conformance.

The canonical v3 prototype (`docs/ux/redesign/v3/Sloe-App.html`) never had
both: its Cook (mobile) and WebLibrary surfaces render provenance as the
**only** chip row. Category-style discovery lives in the editorial shelves
("Fits your day", "Quick — under 30 min", "High protein"), which the app
already renders (`LibraryShelvesHeader`, ENG-1225). The category row was
therefore double-filtering the same content the shelves already surface, at
the cost of a second competing pill row above the fold.

This supersedes the ENG-1247 "Both rows" ruling for this surface.

## Shape

- Flag: `library_single_filter_row_v1`, registered in both
  `KNOWN_DEFAULT_OFF_FLAGS` registries (`src/lib/analytics/track.ts`,
  `apps/mobile/lib/analytics.ts`). Kill switch: OFF renders the exact legacy
  two-row stack.
- ON: category row hidden on `apps/mobile/app/(tabs)/library.tsx` and
  `src/app/components/Library.tsx`; `category` state stays `"all"`, so
  filtering, shelves, and grid composition logic are untouched.
- The contextual plan-import source pills are unchanged — they only reveal
  under Imported, so they never add a standing row.

## Cost accepted

One-tap meal-type filtering of the personal cookbook goes away on the new
path. Search + shelves cover the discovery need for a personal-scale corpus.
If PostHog shows real category-chip usage before the flag collapses, the
categories return as a quiet count-line filter control (next to sort), not as
a second chip row.

## Verification

Sim + web captures with the flag forced on (ENG-1607 PR); source-wiring +
registry-parity tests in `tests/unit/librarySingleFilterRow.test.ts`.
