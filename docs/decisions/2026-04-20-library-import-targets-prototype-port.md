# Library / Import recipe / Targets — 2026-04-19 prototype port

**Date:** 2026-04-20
**Area:** UX, both platforms (web + mobile)
**Status:** Resolved

## Context

Grace sent three screenshots from the Claude Design prototype bundle
(`docs/ux/claude-design-bundles/prototype/project/`) on 2026-04-20,
covering Library, Import recipe, and Targets. The prototype bundle
is the canonical design for Suppr going forward; we've been porting
it screen-by-screen (see `2026-04-20-progress-header-and-range-picker-port.md`
and `2026-04-20-plan-tab-prototype-fixes.md`).

## Decision

Ship all three screens to the prototype shape on both platforms,
preserving every existing feature.

### Library

- **Header:** back chevron + "Library" title + `{n} recipes · {m} saved`
  subtitle, with the sort-cycle button on the trailing edge. Matches
  mobile + web.
- **Filter pills:** single horizontal-scroll row covering the
  prototype set (`All · Saved · High-Protein · Quick · Vegetarian`)
  **plus** the preserved entry-kind pills (`Created · Imported`) so
  we don't regress the Pass 6 (2026-04-18) functionality. Canonical
  order + predicates live in `src/lib/recipes/libraryFilters.ts`.
- **Cards:** big wide card — 128px tall image with gradient overlay,
  title + source + kcal/P/time meta row, bookmark dot for saved rows.
  Replaces the narrow 96×96 thumbnail layout.

### Import recipe

- **Header:** back chevron + sentence-case "Import recipe" title.
  Replaces the uppercase "IMPORT" kicker mobile used, matches web.
- **Idle state:** `PASTE A LINK` overline + link-icon URL input +
  primary "Parse recipe" CTA + "Or pick a source" 2×2 grid
  (Instagram / TikTok / Recipe blog / From library) + estimates
  caption. Every existing branch (clipboard paste, deep-link, share
  extension, photo OCR import, recent imports list) is preserved
  below the prototype block — this is purely an entry-point
  restructure.

### Targets

- **New dedicated screen on both platforms.** Previously targets were
  displayed + edited from the Profile screen. Prototype carves out a
  read surface (big calorie target + macro progress + goal card) and
  keeps Profile as the write surface.
- Mobile route: `apps/mobile/app/targets.tsx`, linked from the More
  tab's "Daily targets" row (previously `/profile`).
- Web route: `?view=targets` — wired through `src/app/App.tsx`.
- Copy anchors: `"DAILY CALORIE TARGET"` overline, big kcal number,
  `"Estimated TDEE based on Mifflin-St Jeor · {activity} · {delta} kcal deficit"`
  caption, `"Reach {goal} kg"` / `"Currently {now} kg · could reach by ≈ {date}"`,
  status pill (`On track` / `Stalled` / `Off track`), footnote
  `"Projections assume a 14-day moving average. Targets adapt weekly
  based on logged intake."`. Shared copy lives in
  `src/lib/targets/targetsView.ts`.

## Parity

- Web and mobile render the same pills in the same order, from the
  same `LIBRARY_FILTER_PILLS` constant.
- Both Targets screens compose the view-model from
  `src/lib/targets/targetsView.ts` so the TDEE caption, macro tiles,
  and goal card cannot drift.
- Import preserves every non-idle state (importing / review / saving
  / success / error / signed-out) on both platforms.

## Tests

- `tests/unit/libraryFilters.test.ts` — 13 cases covering pill
  ordering, the three nutrition predicates, and the
  `matchesNutritionPill` dispatcher.
- `tests/unit/targetsView.test.ts` — 14 cases covering
  `activityLevelCaption`, `deficitSurplusCaption`, `buildMacroTiles`,
  `buildGoalCard` (on-track / off-track / stalled / no-goal), and
  `formatGoalDate`.

## Files touched

- `apps/mobile/app/(tabs)/library.tsx` — prototype port.
- `apps/mobile/app/import-shared.tsx` — header + idle-state restructure.
- `apps/mobile/app/targets.tsx` — new read screen.
- `apps/mobile/app/(tabs)/more.tsx` — Daily Targets row deep-links to `/targets`.
- `src/app/components/Library.tsx` — prototype port.
- `src/app/components/Targets.tsx` — new desktop read surface.
- `src/app/components/RecipeUpload.tsx` — import-mode header + idle-state restructure.
- `src/app/App.tsx` — wire `?view=targets` into the view router.
- `src/lib/recipes/libraryFilters.ts` — shared pill helpers (new).
- `src/lib/targets/targetsView.ts` — shared Targets view-model (new).
