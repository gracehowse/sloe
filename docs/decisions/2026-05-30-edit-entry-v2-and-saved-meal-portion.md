# Edit-entry sheet reskin + saved-meal portion editor (ENG-783)

**Date:** 2026-05-30
**Status:** Resolved (mobile shipped behind flag; web parity tracked — see "Parity")
**Area:** Today / Logging / Saved meals
**Flag:** `today-edit-entry-v2`
**Related:** [`2026-05-13-portion-picker-and-macro-display.md`](2026-05-13-portion-picker-and-macro-display.md), ENG-782 (slot-pill contrast)

## The ask

Grace's red-line on the mobile "Edit Entry" modal (verbatim): *"this is
still hideous and it shouldnt jump to today as a pop up it should stay
within the log menu. also when selected a saved meal you should be able
to edit the portion."* Three asks:

1. **The edit-entry sheet is visually hideous** → redesign it.
2. **It pops up over Today instead of staying within the log menu** →
   make it read as the same bottom-sheet family as the `LogSheet`, not a
   centred floating popup.
3. **Selecting a saved meal should let you edit the portion** before
   logging.

All three ship behind one flag — `today-edit-entry-v2` — with the old
path preserved in the `else`/fallback per the feature-flag rollout rule.

## Decision

### Ask 1 + 2 — `EditEntryV2` (reskinned edit-entry sheet)

`apps/mobile/components/today/TodayEditMealModal.tsx` is now a flag-aware
shell:

```
export function TodayEditMealModal(props) {
  if (props.enabled) return <EditEntryV2 {...props} />;
  return <EditEntryLegacy {...props} />;   // byte-identical pre-ENG-783 body
}
```

The host sets `enabled={isFeatureEnabled("today-edit-entry-v2")}`.

`EditEntryV2` adopts the canonical `LogSheet` sheet grammar: drag handle,
headered, rendered on `colors.background` (the log-menu surface, **not**
`cardColor`) so it reads as the same sheet family rather than a popup
floating over Today; scrollable body; sticky single-primary footer.
Inputs are labelled, dotted, unit-suffixed; an explicit **PORTION**
stepper sits above the macros. The active slot pill uses the soft-tint +
primary-border language from the ENG-782 contrast fix (not solid indigo
with ~3.34:1 white text).

### Ask 3 — `SavedMealPortionSheet` (pick a portion before logging)

A new bottom sheet (`apps/mobile/components/today/SavedMealPortionSheet.tsx`,
same sheet grammar + shared `PortionStepper`) lets the user choose a
multiplier before a saved meal is logged. When the flag is **on**,
tapping a saved meal opens this sheet first; **off**, the saved meal logs
1× instantly exactly as before.

Reachability is wired at every saved-meal tap site via a single fallback
shape — `(onRequestPortion ?? onLogSavedMeal)(meal, slot)` — where the
host passes `onRequestPortion` only when the flag is on:

- **Surface (a) — `TodayMealsSection`** (3 tap sites):
  - the in-header "Log usual" pill (`today_log_usual_row_v2` OFF),
  - the dedicated-row "Log usual" pill (`today_log_usual_row_v2` ON),
  - the usual-picker Modal rows (when a slot has ≥2 saved meals). The
    picker closes **before** the portion sheet opens (capture slot →
    `setUsualPicker(null)` → open) to avoid modal-over-modal stacking on
    iOS.
- **Surface (b) — `LogSheet` "Saved meals" rows**: when
  `saved.onRequestPortion` is wired, the row relabels to
  `Edit portion for <title>` and routes to the portion sheet; otherwise
  it keeps `Log <title>` and the instant `onPick`.

### Portion math

`SavedMealPortionSheet` reads the base from `summariseSavedMeal(meal)`
(the unrounded canonical sum of items) and displays
`Math.round(base.total* × mult)` live as the stepper moves — so it scales
the true canonical, not the rounded display. On confirm the host calls
the shared `buildMealEntriesFromSavedMeal(meal, slot, timeLabel, idFn,
mealPortionMultiplier)` (5th param, default `1`, added for ENG-783) which
scales the whole combo. Default `1` keeps the instant-log byte-identical.

Chips `[0.5, 0.75, 1, 1.5, 2]`, clamp `0.125–24`, step `0.25` — the same
grammar as the edit-entry portion stepper, so the two never drift.

## What changed

**Shared (`src/lib/nutrition/savedMealsLogic.ts`):**
- `buildMealEntriesFromSavedMeal(...)` gains a 5th `mealPortionMultiplier
  = 1` param that scales every built entry; guarded to finite `> 0`.

**Mobile (`apps/mobile/`):**
- `components/today/TodayEditMealModal.tsx` — flag-aware shell +
  `EditEntryV2` renderer; `EditEntryLegacy` kept in the `else`.
- `components/today/SavedMealPortionSheet.tsx` — new portion sheet.
- `components/today/TodayMealsSection.tsx` — `onRequestPortion?` prop;
  all 3 saved-meal tap sites route through `onRequestPortion ??
  onLogSavedMeal`.
- `components/today/LogSheet.tsx` — `saved.onRequestPortion?`; `SavedList`
  rows route through it and relabel to `Edit portion for <title>`.
- `app/(tabs)/index.tsx` — host wiring: `openPortionConfirm` (slot
  precedence `slot || meal.defaultMealSlot || activeMealSlot`),
  `confirmPortionLog` (logs via `logSavedMealFromPanel` + fires
  `saved_meal_logged` with `portionMultiplier` for funnel parity), the
  flag-gated `<SavedMealPortionSheet>` mount, and `onRequestPortion`
  passed to both `TodayMealsSection` and the `LogSheet` `saved` prop.

**Tests:**
- `tests/unit/todayLogUsualRowV2.test.tsx` — 5 new cases: all 3
  `TodayMealsSection` tap sites with the prop wired (→ portion editor)
  and omitted (→ instant `onLogSavedMeal` fallback).
- `tests/unit/logSheetPhase3.test.tsx` — 2 new cases: LogSheet saved-meal
  row with `onRequestPortion` wired (relabel + route) and omitted
  (`Log <title>` + `onPick`).

## Why this is correct

- One flag (`today-edit-entry-v2`) gates all three asks; the old path is
  alive in every `else`/`??` fallback, so a 0% ramp is byte-identical to
  pre-ENG-783.
- The portion editor reuses the shared `PortionStepper` and the shared
  `buildMealEntriesFromSavedMeal` builder, so edit-entry and saved-meal
  portioning can't drift, and the persisted entries are identical to a
  manual N× log.
- The fallback shape `(onRequestPortion ?? onLogSavedMeal)` mirrors the
  existing QuickAddPanel pattern; the flag lives only at the host (single
  source of truth), never duplicated in leaf components.
- Slot precedence puts the **tapped** slot first, so a Lunch-header pill
  opens the editor on Lunch even when the saved meal's default is
  Breakfast.

## Acceptance checks performed

- Mobile `tsc --noEmit` clean.
- Mobile vitest: `todayLogUsualRowV2` (12) + `logSheetPhase3` (33) green.
- iOS sim (iPhone 17, iOS 26.5), flag forced on: both ask-#3 surfaces
  pixel-verified end-to-end — LogSheet "Saved meals" row → portion sheet
  (stepper, chips, slot change, canonical macro rescale) and the
  slot-header "Log usual" pill → portion sheet seeded to the tapped slot.
  The close-then-open picker→sheet transition is clean (no modal
  stacking).

## Parity

Mobile is shipped behind the flag. **Web parity** — the
`NutritionTracker.tsx` edit dialog reskin + saved-meal portion editor —
is the matching follow-up (ENG-783 web parity, Today-tab project),
deferred until Grace signs off the mobile sim flow. Per
`feedback_mobile_decisions_apply_to_web.md` this is not optional; it
lands before ENG-783 is closed. Not a silent deferral — tracked on the
ENG-783 issue and in the session task list.

When the web edit dialog is built, its portion control **must** call the
shared `scaleLoggedMealFiberAndMicros` helper so fibre + micros scale with
the portion delta — see
[`2026-05-30-edit-entry-portion-scales-fibre-and-micros.md`](2026-05-30-edit-entry-portion-scales-fibre-and-micros.md).
This is a hard acceptance check for web parity, not optional polish.

## How to apply

When a new surface logs a saved meal, route the tap through an
`onRequestPortion ?? onLog` fallback and let the host decide via
`isFeatureEnabled("today-edit-entry-v2")` — never read the flag in the
leaf. Reuse `SavedMealPortionSheet` + the shared
`buildMealEntriesFromSavedMeal(..., mult)`; don't build a second portion
control.
