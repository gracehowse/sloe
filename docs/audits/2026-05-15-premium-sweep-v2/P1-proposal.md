# P1 proposal table — daily-use surfaces

**Status:** EMPTY (populated after S4 audit run)
**Bucket size:** ~55 surfaces
**Capture set:** `docs/audits/2026-05-15-premium-sweep-v2/captures/P1/`
**Auditor report (S4 output):** `docs/audits/2026-05-15-premium-sweep-v2/P1-auditor-report.md`

---

## In-flight tripwire

- Items in this bucket: **0** (table not yet populated)
- Reverts so far: **0 / 2**
- On 2nd revert: bucket pauses; mini-retro required at
  `docs/audits/2026-05-15-premium-sweep-v2/P1-tripwire-retro.md`,
  and Grace must approve resuming before any further row touches code.

**Note:** the 2026-05-14 reverts all landed in this bucket's surface
family (Today logged-state, calorie ring, day strip, burn detail).
Watch the tripwire closely here.

---

## Surface scope (~55)

### Web — product
- Today logged-state at `app/today/page.tsx`
- `app/plan/page.tsx` — Plan
- `app/library/page.tsx` or `app/recipes/page.tsx` — Library
- `app/discover/page.tsx` — Discover
- `app/recipe/[id]/page.tsx` — Recipe Detail
- `app/shopping/page.tsx` — Shopping
- `app/progress/page.tsx` — Progress (Weight Tracker / Macro Detail / Burn Detail nested)
- `src/app/components/FoodSearch.tsx` — Food search

### Web — dialogs
- `src/app/components/suppr/log-sheet.tsx` — Log Sheet
- `src/app/components/suppr/photo-log-dialog.tsx` — Photo log
- `src/app/components/suppr/voice-log-dialog.tsx` — Voice log
- `src/app/components/suppr/create-custom-food-dialog.tsx` — Custom food
- `src/app/components/suppr/override-ingredient-dialog.tsx` — Override ingredient
- `src/app/components/suppr/add-ingredient-dialog.tsx` — Add ingredient
- `src/app/components/suppr/save-meal-dialog.tsx` — Save meal
- `src/app/components/suppr/copy-meal-dialog.tsx` — Copy meal
- `src/app/components/suppr/duplicate-day-dialog.tsx` — Duplicate day
- `src/app/components/suppr/plan-templates-dialog.tsx` — Plan templates
- `src/app/components/suppr/today-add-meal-dialog.tsx` — Today add meal
- `src/app/components/suppr/today-complete-day-dialog.tsx` — Complete day
- `src/app/components/suppr/today-barcode-dialog.tsx` — Today barcode

### Mobile — tabs + stack
- `apps/mobile/app/(tabs)/index.tsx` — Today (logged-state)
- `apps/mobile/app/(tabs)/planner.tsx` — Plan
- `apps/mobile/app/cook.tsx` — Cook mode
- `apps/mobile/app/recipe/[id].tsx` — Recipe Detail
- Shopping sub-tab within `apps/mobile/app/(tabs)/planner.tsx`
- `apps/mobile/app/(tabs)/library.tsx` — Library
- `apps/mobile/app/(tabs)/discover.tsx` — Discover
- `apps/mobile/app/weight-tracker.tsx` — Weight Tracker
- `apps/mobile/app/macro-detail.tsx` — Macro Detail
- `apps/mobile/app/burn-detail.tsx` — Burn Detail
- `apps/mobile/app/meal-nutrition.tsx` — Meal Nutrition

### Mobile — sheets / modals
- `apps/mobile/components/FoodSearchModal.tsx` — Food search
- `apps/mobile/components/BarcodeScannerModal.tsx` — Barcode scanner
- `apps/mobile/components/today/LogSheet.tsx` — Log sheet
- `apps/mobile/components/progress/LogWeightSheet.tsx` — Log weight
- `apps/mobile/components/PhotoLogSheet.tsx` — Photo log
- `apps/mobile/components/VoiceLogSheet.tsx` — Voice log
- `apps/mobile/components/today/PortionPickerSheet.tsx` — Portion picker
- `apps/mobile/components/MoveMealSheet.tsx` — Move meal
- `apps/mobile/components/SaveMealSheet.tsx` — Save meal
- `apps/mobile/components/CopyMealSheet.tsx` — Copy meal
- `apps/mobile/components/CreateCustomFoodSheet.tsx` — Custom food
- `apps/mobile/components/OverrideIngredientSheet.tsx` — Override ingredient
- `apps/mobile/components/PlanTemplatesSheet.tsx` — Plan templates
- `apps/mobile/components/DuplicateDaySheet.tsx` — Duplicate day
- `apps/mobile/components/today/TodayCompleteDayModal.tsx` — Complete day
- `apps/mobile/components/today/TodayEditMealModal.tsx` — Edit meal
- `apps/mobile/components/today/TodayNutrientsModal.tsx` — Nutrients

---

## Capture map

(empty — populated at S4)

---

## Proposal table

`Item type`: SUBTRACT / TIGHTEN / REPLACE / NEW
`Complexity`: cleanup (<1h) / refactor (1-4h) / new build (>4h) / design-needed
`Status` lifecycle: proposed → approved → in-progress → implemented → sim-validated → `[x]` (or → rejected / reverted)

| # | Surface | Item type | What changes | What it duplicates / weakens | Before screenshot path | After-target description | Affected platforms | DC# touched | Auditor verdict | Complexity | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|

(empty — populated at S5 from S4 auditor report)

---

## Refuse-to-pass (sub-list)

(empty)

---

## Defended Choices touched (sub-list)

Likely to include DC1 (multi-ring spine), DC2 (3% fit chip), DC3
(Eat Again), DC10 (calorie ring 3-state colour), DC13 (recipe import).
Filled from S4 auditor report.

(empty)
