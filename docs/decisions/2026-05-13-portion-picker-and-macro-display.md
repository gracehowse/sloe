# Portion picker + macro display overhaul

**Date:** 2026-05-13
**Status:** Resolved
**Area:** Nutrition / Barcode logging / Custom food
**Related decision:** [`2026-05-13-activity-bonus-projected-eod-model.md`](2026-05-13-activity-bonus-projected-eod-model.md)
**Plan:** [`docs/planning/2026-05-13-portion-picker-macro-display-overhaul.md`](../planning/2026-05-13-portion-picker-macro-display-overhaul.md)

## Decision

Two coordinated changes to the barcode + macro surfaces:

### 1. Portion picker — drop the `logBasis` mode toggle

The legacy barcode flow asked the user to pick a mode first
(`per 100 g` vs `per serving`) and then interpret a single text field
in that mode's terms. A chip row underneath mixed three unit kinds
(count, grams, "serving"). The mode toggle and the chip row routinely
fought each other — tapping `1 meatball (~22 g)` while in `By
serving` mode silently multiplied to 1,914 g.

Replaced with a single `{ amount, unit }` state model where the **unit
is the mental model the user is in** (meatball / serving / gram /
ounce). Stepper changes the amount. A unit pill underneath opens a
small popover that lists every available unit and its gram
equivalent; switching unit preserves the gram weight (`3 meatballs
≈ 66 g` swaps to `0.76 serving` or `66 g` losslessly).

Quick-chip row remains — but each chip carries its own `{ amount,
unit }` state, so tapping a chip sets both fields simultaneously and
the picker can't enter an internally-inconsistent state.

### 2. Macro display — `formatMacro` everywhere

`Math.round(0.5)` returns `1` in JavaScript. At small portions the
result was: `1 meatball → "1 g carbs"`, `4 meatballs → "2 g carbs"`,
visually `1 × 4 ≠ 2` — looked broken even though the underlying
per-100 g basis was identical. The user couldn't trust the macros.

`formatMacro(value, macroKey, unit?)` (which already existed at
`src/lib/nutrition/formatMacro.ts` from 2026-04-25 but wasn't swept
across the codebase) is now used at every macro display site:

  - Calories and sodium → integer
  - Protein, carbs, fat, fibre, sugar → 1 decimal, with trailing `.0`
    trimmed so `2.0 g` displays as `2 g`

This means `0.5 g × 4 = 2.0 g` displays as `0.5 g` and `2 g`
respectively — the math reads cleanly.

## What changed

**New shared modules:**

- `src/lib/nutrition/portionPicker.ts` — state model, unit
  derivation from `servingOptions`, gram conversion, default-state
  picker, formatter. Pure TS, no React. (Tests:
  `tests/unit/portionPicker.test.ts`, 21 cases.)
- `src/lib/nutrition/activityBonus.ts` — shared by mobile + web. See
  the activity-bonus decision doc.

**Mobile (`apps/mobile/`):**

- `components/PortionPicker.tsx` — RN component. Stepper + unit pill
  + unit-picker modal + quick chip row.
- `components/BarcodeScannerModal.tsx` — `logBasis` state removed;
  picker block + chip row replaced with `<PortionPicker>`; macro row
  rebuilt as a 4-tile grid (kcal in accent + protein/carbs/fat);
  primary CTA + icon-only "Scan again" pair (44 × 44).
- `components/AddIngredientSheet.tsx`, `components/SaveMealSheet.tsx`,
  `components/today/TodayEatAgainBanner.tsx`, `app/weekly-recap.tsx`,
  `app/creator/[id].tsx`, `app/progress-metric.tsx` — `Math.round`
  on grams replaced with `formatMacro`.

**Web (`src/app/`):**

- `components/suppr/portion-picker.tsx` — web mirror, Tailwind.
  Consumes the same shared state model.
- `components/suppr/today-barcode-dialog.tsx` — gram input + Quick
  picks block replaced with a thin `<BarcodePicker>` adapter that
  bridges the host's gram-based state to the picker's unit-aware
  state. Macro display swapped to `formatMacro`.
- `components/NutritionTracker.tsx` — `dayActivityBudgetAddonWeb` +
  `activityAdjustment` now call `computeActivityBonusKcal` (see the
  related decision doc).

## What did not change

- The `BarcodeScannerModal` correction-mode form (`corrBasis`) keeps
  its `per 100 g / per serving` toggle. That toggle is about
  data-entry from a label, not about picking a portion — a different
  concern.
- The `create-custom-food-dialog` `macroBasis` toggle, same reason.
- Persistence contract: nutrition values are still stored in their
  canonical per-100 g form in the database.
- Recipe-builder ingredient editing (different surface, different
  affordances; can mirror the picker later if useful).

## Why this is correct

- One mental model: "X of unit Y". No mode toggle to remember.
- The picker is identical across web + mobile because the state +
  math live in one TS file, not duplicated.
- Macros multiply visibly. `1 × 4 = 4` works the way users expect at
  every portion size.
- Default state prefers the most human unit (count → serving → gram).
- Remembered portions resolve back to the friendliest unit when they
  land on a whole count; otherwise fall back to exact grams.

## Acceptance checks performed

- 40 unit tests pass (`activityBonus`, `formatMacro`, `portionPicker`,
  `burnDetailPanel`).
- Mobile + web `tsc --noEmit` clean.
- Visual confirmed in iOS simulator: scan barcode → new picker
  renders, macros 1-decimal under 10 g, chip row sorted ascending,
  bad OFF chips filtered.
- Web dev server compiles `/tracker` route.

## How to apply

When new logging surfaces are added (manual food search, recipe-builder
ingredient picker, photo-log review), use the shared
`<PortionPicker>` / `<PortionPickerWeb>` plus the shared
`buildPickerOptions` / `stateToGrams` helpers. Don't reintroduce a
basis toggle or a free-text grams input that mixes units.

When the host has a per-100 g macro panel (barcode, search hit, custom
food), pass it as `macrosPer100g` so the picker runs
`evaluatePortionScalePlausibility` and surfaces an inline warning as the
user adjusts amount — same guard as the log-time `checkScaledLogPlausibility`
soft-flag, but visible before confirm.

For any new macro display site: import from
`src/lib/nutrition/formatMacro` (`formatMacro` for strings,
`formatMacroValue` for numeric math). Never `Math.round(macroG)` for
display.
