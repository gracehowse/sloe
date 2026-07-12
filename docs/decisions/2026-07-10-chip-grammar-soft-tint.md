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

## AddControl — the add-row grammar (ENG-1375 S4)

**Ruling:** the **quiet-fill pill** is THE add-row grammar. Every in-card
"add another X" affordance (add food, add ingredient, add step, add slot)
renders as:

- `bg-fill-quiet` (web) / `colors.fillQuiet` (mobile) fill — **no border**,
  no second card;
- **radius 12** (`rounded-[12px]` web / `Radius.xl` mobile — the
  12-inside-24 concentric inner standard);
- **Plus glyph + primary-solid semibold label**, centred;
- **full-width in-card** (card-edge inset carried by a wrapper).

**DASHED borders are upload DROPZONES only** (photo-log dialog,
`RecipeUpload`). A dashed edge on an add-row action is a bug.

Canonical primitives (extracted from the F-160 Today "Add food" pair — the
first quiet-fill adoption, 2026-06-12):

- Web: `src/app/components/ui/add-row-button.tsx`
- Mobile: `apps/mobile/components/ui/AddRowButton.tsx`

Both ship loading (spinner + disable, no double-submit) and disabled states
with the element. Mobile takes a `haptic` weight (`selection` for
open-a-sheet adds; `confirm` when the press itself commits data, ENG-1016)
and a `size="sm"` step for dense multi-control rows.

### Migrated in S4

- The canonical Today "Add food" pair itself (web `today-meals-section.tsx` +
  mobile `TodayMealsSection.tsx`) now renders via the primitive — ONE source
  (radius 8 → 12 with the ruling).
- Mobile `planner.tsx` add-slot chips: full-radius + textSecondary 11px →
  the primitive (`size="sm"`, `haptic="confirm"`).
- Mobile `create-recipe.tsx` + `CreateRecipeWizard.tsx` "Add ingredient" /
  "Add step": dashed outlines → the primitive (add-INGREDIENT actions, not
  dropzones).
- Mobile `RecipeEditSheet.tsx` "Add ingredient": ENG-821 soft-tint +
  bordered variant → the primitive.
- Mobile `app/recipe/verify.tsx` "Add ingredient": dashed raw-alpha pressable
  → the primitive; the helper line moved below as a caption.
- Web `today-add-meal-dialog.tsx` "Search foods" hand-off: dashed
  `border-dashed` CTA → the primitive (search-glyph override — an add-food
  action, not a dropzone).

Left dashed (sanctioned dropzones): `photo-log-dialog.tsx`,
`RecipeUpload.tsx`.

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

Left dashed — the truthful inventory (refuter-audited 2026-07-11):
sanctioned upload dropzones (`photo-log-dialog.tsx`, `RecipeUpload.tsx`);
the v3 plan empty-SLOT affordances (`PlanEmptySlotV3`, mobile twin — the
prototype's own `.plan-empty` dashed grammar, an empty-state affordance
not an add control); empty-state placeholder CONTAINERS (DiscoverFeed
L994, Library L430 — containers, not controls); `MealPlanner` "+ New"
plan-slot pill (L1438 — a create-new-collection affordance; converts
with the S5+ slice if a ruling extends there); `FoodSearchPanel` L2755
(ENG-814 flag fork — S7 scope).

## Appendix — S5 avatar ruling (2026-07-10, ENG-1375)

**ONE identity fill = solid damson/plum** — the mobile Figma `654:6`
direction (`Accent.purple` #6A4B7A + white sans-bold initial). Retired:
the web `--accent-info` avatar fill (Today header) and the plum→pink
avatar gradients (desktop sidebar, pricing header). Functional
**per-member accent micro-discs stay** (household surfaces) — colour is
information there, not identity chrome.

- Web primitive: `src/app/components/ui/avatar-disc.tsx` — sizes
  18/22/28/36/52 (initials 9/9/11/13/18, all on the type ladder); fills
  `identity` (new scheme-constant `--avatar-identity` token — the
  theme-resolved `--accent-info` lightens to #9A7BAA in dark and fails AA
  under white text) and `member` (accent via `householdMemberAccent`).
- Mobile: `GradientAvatar`'s identity default flipped grey-ink →
  `Accent.purple`; the `brand` gradient variant survives for
  marketing-only surfaces.
- Migrated in S5: web `today-date-header` (both avatar buttons),
  `desktop-sidebar` profile entry (gradient + shadow retired; its
  token-budget pin removed), `PricingHeaderAuth`, `EditorialProfileBlock`
  monogram.
- Later S5 slice (not drift — pinned by `profileAvatarGradient.test.ts`):
  `SettingsProfileHeaderCard` (56px gradient — the last
  `--avatar-gradient-accent` consumer; its size joins the ladder and its
  parity pin moves in the same change), and household member-disc call
  sites (`HouseholdBar`, `HouseholdSettingsPage`, `ShoppingList`, mobile
  `HouseholdCard`) adopting the `member` variant.

## Appendix — S6 screen-chrome ruling (2026-07-10, ENG-1375)

**ONE sticky mobile-web tab header:** `src/app/components/suppr/
screen-chrome.tsx`, mirroring mobile `screen-section-chrome.tsx` —
overline (11/700/uppercase, tertiary ink) → serif title
(`--font-headline`) → optional subtitle (13/600 muted) → trailing slot,
hairline bottom border, hidden at `md+`.

**Title ruling: ONE tab-title size = serif 24.** Mobile `Type.title`
(serif 24) is canonical; web Progress's 28px forked it from sibling tabs
(Plan/Recipes were already 24). Desktop headers (`text-3xl` Progress
desktop header) are a different surface class — untouched here.

- Migrated in S6: `recipes-tab-chrome`, `progress-tab-chrome` (28 → 24),
  `plan-tab-chrome` (overline muted → shared tertiary ink) — all now thin
  wrappers over the primitive; `today-date-header` titles re-skinned
  sans-bold → the same serif-24 voice. Overline-rhythm pin re-pointed to
  the primitive (`sectionHeaderRhythm.test.ts`).
