# Portion picker + macro display + activity bonus — unified PR plan

**Date drafted:** 2026-05-13
**Status:** Awaiting Grace approval before implementation
**Reference mockup:** `/tmp/barcode-redesign.html` (premium aesthetic, three states)
**Decision doc (activity bonus):** `docs/decisions/2026-05-13-activity-bonus-projected-eod-model.md`

## Goal

Three interlocking nutrition-display bugs surfaced in one TestFlight
session (2026-05-13 19:49–20:22). Bundling because each fix exposes
the next and shipping them serially would mean three rounds of visual
review on the same screens.

1. **Activity bonus shows wrong number.** Today chip used prorated
   "bonus so far" math that visibly diverged from the burn-detail
   page and silently risked overeating.
2. **Macro values display rounded to integer at portion sizes where
   1g of precision flips the result.** `Math.round(0.5)` = 1 in JS,
   so a 22 g portion of meatballs shows "1 g carbs" while the 87 g
   serving shows "2 g carbs" — same per-100g basis, contradictory
   display.
3. **Barcode portion picker has a redundant mode toggle.** "By grams"
   vs "By serving (87 g)" is a top-level toggle that interacts badly
   with a chip row mixing three units (count / grams / serving). The
   user is forced to mentally convert "3 meatballs" → 66 g rather
   than just saying "3 meatballs".

## Goals (testable)

- G1 — A user can scan a product, type "3", tap the unit pill, pick
  "meatball", and log 3 meatballs without doing any arithmetic.
  No mode toggle anywhere in the flow.
- G2 — At any portion size, the per-portion macros displayed multiply
  cleanly into the per-serving macros. `1 meatball × 3 = 3 meatballs`
  for every nutrient, no rounding surprises.
- G3 — The bonus number shown on the Today chip equals the value
  added to the food budget and equals the bonus value on the
  burn-detail page. One source of truth, one rule for display.

## Scope (audit)

### Mobile

| File | Issue | Action |
|---|---|---|
| `apps/mobile/components/BarcodeScannerModal.tsx` | `logBasis` toggle, `Math.round(scaled.*)` display | Rewrite portion picker block, use shared `formatMacroG()` |
| `apps/mobile/components/AddIngredientSheet.tsx:398-399` | `Math.round(macro)P/C/F` row | Swap in `formatMacroG()` |
| `apps/mobile/components/SaveMealSheet.tsx:322` | A11y description with rounded macros | Swap in `formatMacroG()` |
| `apps/mobile/components/today/TodayEatAgainBanner.tsx:92-93` | Per-meal macro caption | Swap in `formatMacroG()` |
| `apps/mobile/app/create-recipe.tsx:718-720` | Round-before-save — **investigate first**, may be lossy persistence not display | Defer if storage-side |
| `apps/mobile/app/weekly-recap.tsx`, `app/creator/[id].tsx`, `app/progress-metric.tsx` | Round in copy strings | Swap in `formatMacroG()` |
| `apps/mobile/app/(tabs)/index.tsx` *(activity bonus)* | Already done — projected-EOD math via shared `computeActivityBonusKcal` | Carry into this PR |
| `apps/mobile/app/burn-detail.tsx` *(activity bonus)* | Already done — 3-row card, projected-EOD math | Carry into this PR |
| `apps/mobile/components/today/TodayActivityBonusCard.tsx` *(activity bonus)* | Already done — chip reads "+N bonus earned" | Carry into this PR |

### Web

| File | Issue | Action |
|---|---|---|
| `src/app/components/suppr/today-barcode-dialog.tsx` | Mirror of mobile barcode flow | Replace picker block; share state shape with mobile |
| `src/app/components/suppr/create-custom-food-dialog.tsx:349` | `per_serving / per 100 g` basis pattern | Same rewrite |
| `src/app/components/NutritionTracker.tsx` *(activity bonus)* | Already done — shared `computeActivityBonusKcal` | Carry into this PR |
| Any web call site of `Math.round(macro)` in display | Same as mobile sweep | Swap in `formatMacroG()` |

### New shared modules

| File | Purpose |
|---|---|
| `src/lib/nutrition/activityBonus.ts` | **Already shipped** — projected-EOD bonus math |
| `src/lib/nutrition/formatMacro.ts` | **New** — `formatMacroG(n)` rule (1 decimal under 10g, integer ≥10g; strict types so calories/sodium can't accidentally route through it) |
| `src/lib/nutrition/portionPicker.ts` | **New** — pure state model for the picker: `{ amount: number, unit: PortionUnit }` + canonical `unit → grams` resolution. Drives both mobile + web pickers. |
| `apps/mobile/components/PortionPicker.tsx` *or* `src/app/components/suppr/portion-picker.tsx` | **New shared component** if web/mobile abstraction allows; otherwise two thin wrappers around the shared state model |

## Design decisions

1. **No mode toggle.** Single amount + unit picker. The unit shown next
   to the amount is the unit the user is thinking in. Tapping the
   unit pill opens a small popover listing all available units with
   gram equivalents. Switching units preserves the gram weight (3
   meatballs ≈ 66 g → switches to "0.75 serving" or "66 g").

2. **Stepper, not free-text-only.** Big +/- buttons either side of a
   tabular number. Tap the number to edit directly via keyboard.
   Stepper steps: 1 for count units, 0.5 for serving, 5 for grams.

3. **Quick row stays but is units-aligned.** Compact horizontal scroll
   row of `1 meatball / 4 meatballs / 1 serving / 100 g`. Tapping a
   chip sets BOTH amount and unit. This is the only place where
   pre-built shortcuts live — they don't fight the stepper.

4. **Macro tiles at top.** 4-column grid (kcal / P / C / F) matching
   Suppr's existing Today macro tile aesthetic. Updates live as the
   picker state changes. Kcal in accent orange, macros in neutral.

5. **`formatMacroG()` precision rule:**
   - `value < 0.05` → `"0g"` (true zeros)
   - `0.05 ≤ value < 10` → `"0.5g"`, `"4.3g"` (1 decimal)
   - `value ≥ 10` → `"17g"` (integer)
   - Optional `min: "<0.1g"` variant for the FDA-style rendering, not
     used in main flow.

6. **Per-meatball unit data source.** Comes from
   `product.servingOptions` — already exists. Each option has
   `{ label, grams }`. The new picker reads them as units, not as
   raw gram values.

7. **Persistence unchanged.** Logged nutrition is still stored in the
   canonical gram form. The picker is a display + intent layer.

## Sequencing

This is **one PR** but built in commits so review is tractable:

1. **Commit 1 (already in working tree):** activity bonus → projected-EOD
   model + shared helper + decision doc + 7-case test.
2. **Commit 2:** `formatMacroG()` helper + test + sweep all
   call-sites identified above (no logic change, just display).
3. **Commit 3:** `portionPicker.ts` shared state model + test.
4. **Commit 4:** Mobile `BarcodeScannerModal.tsx` rewrite using the
   new picker + new macro display. Visual screenshot in commit
   message.
5. **Commit 5:** Web `today-barcode-dialog.tsx` rewrite, same picker.
   Cross-platform parity check.
6. **Commit 6:** Custom-food entry (mobile + web) — same picker
   applied to the manual basis.
7. **Commit 7:** Decision doc for portion picker + screenshot
   appendix. Update planning doc to "Resolved".

Visual validation gate (Grace eyeballs on phone + browser) after
commits 4 and 5 before pushing.

## Risks

- **Test coverage on the picker state model is mandatory.** The unit
  conversion is exactly the kind of math that produces a footgun
  silently. Pin every transition: count → grams, grams → count,
  count → serving, serving → count, edge case where serving size
  isn't a whole-number multiple of the per-unit grams.
- **Stored portion memory.** `getRememberedPortion(barcode)` returns
  grams. New picker needs to resolve "the user usually logs 88 g"
  back into "≈ 4 meatballs" when the count unit exists. Test pin.
- **Serving size = 0 fallback.** When a product has no serving size,
  unit options collapse to just "g". The picker still needs to look
  intentional, not broken.
- **A11y.** Stepper + unit pill must have correct `accessibilityRole`,
  `accessibilityLabel`, and `accessibilityValue` so VoiceOver reads
  "3 meatballs" not "3".
- **PR size.** This PR will be 1000+ lines. Already at the upper bound
  per the 3-open-PRs cap rule. **Mitigation:** if review fatigue
  hits, split commits 6+7 (custom-food) into a follow-up PR.

## Out of scope

- Adding new units beyond what's already in `product.servingOptions`
  (no "tbsp" / "cup" inference unless OFF gives it). That's a
  food-matching upgrade, not a picker change.
- Changing the underlying nutrition storage contract.
- Custom food creation UX outside of basis toggle — text-input
  precision, "snap label" flow, etc. all stay as-is.
- Recipe builder ingredient editing (different surface, different
  affordances; can mirror the picker later if useful).

## Acceptance criteria

- [ ] Maestro flow exists: open scanner, scan a known barcode, log 3
  meatballs without typing in a grams field, with the right calorie
  count landing on Today.
- [ ] `formatMacroG()` unit test covers 0, 0.04, 0.05, 0.5, 9.95, 10,
  17.0, 17.5.
- [ ] `computeActivityBonusKcal` unit test (already exists) still
  passing.
- [ ] Visual: Today chip number matches burn-detail bonus number on
  the same day. Visually verified on Grace's phone + browser.
- [ ] No `Math.round(macro)` references in display layer for protein
  / carbs / fat / fiber — only via `formatMacroG()`.
- [ ] No `logBasis` references anywhere in code.
- [ ] `npm run ci` green locally.
- [ ] Decision doc captures the new portion-picker contract and links
  to the bonus model decision doc as a related change.
- [ ] Linear issue for follow-ups: custom-food parity, recipe-builder
  parity (if those split out).
