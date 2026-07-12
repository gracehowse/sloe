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

### Out-of-scope additions (refuter sweep, same day)
- `planner.tsx` day-of-week option pills (`dayBtn*`, ~L1801/L4005) — option-pill
  family; converts in a later slice with the day-cell ruling applied.
- `ActivityLevelPreview.tsx:88` raw `+"15"` alpha — onboarding slice (S3).

## Segmented controls — §8 track-and-thumb (S2/S3, ENG-1375, same day)

**Ruling:** ONE segmented grammar, both platforms — the §8 track-and-thumb:

- **Track:** full-radius quiet rail — `bg-muted` (web) / `colors.inputBg`
  (mobile) — with the **2px inner pad** (`p-0.5` / the primitive's
  `TRACK_PAD`). The 2px pad is a control-internal inset, not a layout rhythm
  value; it lives only inside the primitives, never as a `Spacing` token.
- **Thumb (active segment):** card-white, full-radius, + the **subtle 1px
  shadow** (`shadow-sm` / shadowOpacity 0.08, radius 4, y+1). Legal under the
  interactive-elevation carve-out
  (`2026-07-10-card-grammar-rounder-flat.md`) — a thumb is feedback chrome,
  not a resting card.
- **Labels:** active = `primary-solid` **semibold**; inactive =
  `textSecondary` / `muted-foreground` medium.
- **Canonical primitives** (the ONLY way to render a segmented control):
  - Web: `src/app/components/ui/segmented-track.tsx` (`tablist` or
    `radiogroup`, roving tabindex + arrow-key movement).
  - Mobile: `apps/mobile/components/ui/SegmentedTrack.tsx` (`PressableScale`
    segments, `selection` haptic on actual change only).

Extracted from the two conforming references (mobile `WeightRangeToggle` +
`ProgressPeriodControl`).

### Migrated in S2 (web) / S3 (mobile)

- Web: `MacroDetailPanel` breakdown toggle, `ProgressDashboard` Trend/Scale
  toggle, `progress-period-control.tsx` (the census's named divergent — it had
  NO track, bare card segments + tint thumb; now tracked, restoring parity
  with its mobile mirror), `onboarding/segmented.tsx` (square bordered track +
  tint thumb → §8).
- Mobile: `WeightRangeToggle` + `ProgressPeriodControl` (re-pointed at the
  primitive they were extracted from), `app/macro-detail.tsx` breakdown
  toggle, `SettingsBundleContent` `SegmentedRow` (square 8/6 rail on
  `cardBorder` → §8), `onboarding/segmented.tsx` `MobileSegmented` (tint
  thumb → card thumb; its consumers — height/weight steps,
  `TrialEndReminderDayPicker` — inherit).

### Intentionally different — not a gap

- **CookMode's A−/A+ text-size stepper** (`src/app/components/CookMode.tsx`)
  is a stepper (increment/decrement action pair), not a single-select
  segmented control — it stays on its own treatment. Not §8.
- **Web `settings-segmented.tsx`** (`SettingsSegmented`) is the 48px
  option-row picker with per-option hint text — a two-line option-card form
  control, not a slim track-and-thumb; it cannot carry a thumb without losing
  its hints. Stays on treatment #9 (aubergine edge + soft tint). Its mobile
  sibling (`SegmentedRow`, hint-less) DID migrate to §8 — the cross-platform
  read is acceptable because the web rows carry hint copy the mobile rows
  don't; if the hints ever move out, it converges to §8 (tracked: ENG-1375
  epic scope note).
