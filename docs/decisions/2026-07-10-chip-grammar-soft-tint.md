# Chip grammar — soft tint carries selection (2026-07-10)

**Ruling (ENG-1375, component-grammar epic, slice S1):**

- **Soft tint = ALL filter/option chips.** Fully round (`rounded-full` /
  `Radius.full`). Rest = quiet card or secondary fill, **no border**.
  Selected = **primary-soft tint fill + primary-solid semibold label** — the
  ENG-1022 grammar. Canonical primitives:
  - Web: `src/app/components/ui/filter-chip.tsx`
  - Mobile: `apps/mobile/components/ui/FilterChip.tsx` (new in S1)
- **Solid primary fill = day cells ONLY** — week-strip day cells and date
  pills. No filter/option chip may use the solid fill for selection.

Rest-fill nuance (mobile): `card` on page-ground rows; `secondary`
(`colors.backgroundSecondary`) when the chip sits on a card-coloured surface
(sheets), where a card fill would vanish. Both are legal §7 quiet fills.

## Migrated in S1

- Mobile: `MealTypePicker`, `AddIngredientSheet` unit chips (killed the raw
  `accent.primary + "15"` alpha string), `RecipeEditSheet` meal-type chips,
  `planner.tsx` filter chips (bordered rest → borderless quiet fill).
- Both platforms: `PlanMealFilterChipsV3` solid selected fill → soft tint
  (day cells in the Plan week strip stay solid — in scope of the day-cell
  carve-out, untouched).
- Web: `HouseholdBar` selected pill `bg-primary/15` → `bg-primary-soft`.

Out of scope for S1 (later slices): ENG-814 FoodSearchPanel chips, onboarding
segmented controls.
