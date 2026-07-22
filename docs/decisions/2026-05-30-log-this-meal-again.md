# One-tap "Log this meal again" from a populated Today slot

> **⚠️ SUPERSEDED (2026-07-21) — do not implement from this doc.** The instant
> "Log this/these again" row described below was replaced, before it ever ramped,
> by the destination-picker-first **"Copy to another day"** flow. The
> `logAgainSlot` handler + the `today-log-again-{slot}` row are deleted on both
> platforms; the `today_log_again` flag is reused for the new behavior. Reason:
> the instant relog was an unconfirmed, un-undoable, silently calorie-doubling
> mutation that also mis-stamped the entry with the current wall-clock time when
> viewing a past day. The deferred undo toast (§Undo below) is now shipped as a
> real Undo on the copy toast. See
> [`2026-07-21-copy-to-another-day.md`](2026-07-21-copy-to-another-day.md). This
> doc is kept as the historical record of the original decision.

**Date:** 2026-05-30
**Status:** **Superseded 2026-07-21** by [`2026-07-21-copy-to-another-day.md`](2026-07-21-copy-to-another-day.md) (was: Resolved, flag-gated OFF pending sim/browser sign-off — never ramped)
**Area:** Today / Logging / MFP-refugee retention loop
**Flag:** `today_log_again` (visual/structural → flag-gated per CLAUDE.md)
**Issue:** [ENG-786](https://linear.app/suppr/issue/ENG-786)
**Epic:** [ENG-771](https://linear.app/suppr/issue/ENG-771) (MFP-refugee logging loop)
**Related:** [`2026-05-30-edit-entry-v2-and-saved-meal-portion.md`](2026-05-30-edit-entry-v2-and-saved-meal-portion.md) (ENG-783), [`2026-05-30-edit-entry-portion-scales-fibre-and-micros.md`](2026-05-30-edit-entry-portion-scales-fibre-and-micros.md) (ENG-784)

## The gap

Grace, on the Dinner she'd just logged (verbatim): *"want to be able to log
this meal again but no way to."*

Once a slot held entries, the only re-log paths were: (a) "Save {Slot} as a
meal" → then later "Log usual" (two trips, and only useful for a *durable*
template), or (b) the per-meal copy flow (copies to *another* day, not a
repeat onto today). Neither does the obvious thing — *"I ate that again,
add it again now."*

## The decision (product-lead)

One tap on a **"Log this/these again"** row under a populated slot re-inserts
that slot's current entries as **fresh entries on the viewed day**, carrying
the **same baked macros**. Not save-as-usual (that's the quieter, durable
secondary, still present). Not copy-to-future-day (that's the existing copy
flow). The action Grace asked for is "repeat now", so that's what the row
does.

Interaction-model ambiguity (re-log-into-today vs save-as-usual vs
copy-to-future-day) is real; we ship the row **flag OFF by default** so Grace
feels it in the sim and can redirect before it reaches anyone else.

## Implementation

Same shape on both platforms; the row is a pure clone of the slot's current
entries, so it rides the existing baked-macro storage model (F-70): stored
`calories/protein/carbs/fat/fiberG/micros/portionMultiplier` are already
display-ready, so re-inserting them verbatim is correct and never re-scales.

- **Mobile** — `apps/mobile/components/today/TodayMealsSection.tsx` renders a
  full-width row (`testID today-log-again-{slot}`) iff `hasMeals && isOpen &&
  onLogAgain`, above the Save-as-usual row. Host
  `apps/mobile/app/(tabs)/index.tsx` → `logAgainSlot(slot)` clones
  `mealGroups[slot]` with `newMealId()` + the current time (`createdAt`
  dropped so it reads as a fresh log), appends to `byDay[dayKey]`, and
  `persistMealsImmediate(dayKey, clones)` writes `fiber_g` /
  `nutrition_micros` / `portion_multiplier`. Wired
  `onLogAgain={isFeatureEnabled("today_log_again") ? logAgainSlot :
  undefined}`. Light haptic + per-clone `food_logged { source: "log_again" }`.

- **Web** — `src/app/components/suppr/today-meals-section.tsx` renders the
  matching `<button data-testid="today-log-again-{slot}">` inside the
  expanded-meals block, above the Save row. Host
  `src/app/components/NutritionTracker.tsx` → `logAgainSlot(slot)` finds the
  slot in `mealsGrouped`, strips each entry's `id`, sets a fresh time, and
  re-inserts via the same per-entry `addLoggedMealForDate(selectedDateKey,
  …, "log_again")` path `logSavedMeal` uses — so each row persists
  identically (`fiber_g` / `nutrition_micros` / `portion_multiplier` via
  `buildNutritionEntryRow`) and emits one `food_logged { source: "log_again"
  }`. Toast confirms. Wired
  `onLogAgain={isFeatureEnabled("today_log_again") ? logAgainSlot :
  undefined}`.

`logAgainSlot` sits **after** the `mealsGrouped` memo it reads on both
platforms — referencing the memo earlier (in a `useCallback` dep array)
throws a temporal-dead-zone `ReferenceError` at render.

## Why a new analytics source (not `copy_meal`)

`"log_again"` is added to the canonical `FoodLoggedSource` union
(`src/lib/analytics/events.ts`). Re-logging is a distinct retention moment —
it *is* the ENG-771 loop — so it earns its own source for the funnel rather
than being folded into `copy_meal` (a different action: copy to another day).
The cloned entry's **data provenance** (`meal.source`, e.g. "USDA") is
preserved unchanged; only the analytics action-source is `log_again`.

## Undo

v1 undo = the new rows are individually swipe-removable (mobile) / deletable
(web), same as any logged entry. A dedicated undo toast is **deferred** and
tracked as a P2 on ENG-786 (not silent).

## Tests

- Mobile: `apps/mobile/tests/unit/todayLogAgainRow.test.tsx` — 6 cases (row
  absent when prop omitted / flag off; renders with "Log this again" single /
  "Log these again" plural; tap fires `onLogAgain(slot)`; absent when
  collapsed; absent for an empty slot).
- Web: `tests/unit/todayMealsSectionLogAgain.test.tsx` — same 6-case matrix,
  mirrored, so the `today-log-again-{slot}` testID + label + flag contract
  can't drift between platforms.

Both green. Mobile + web typecheck clean.

## Parity

Identical row, identical `today-log-again-{slot}` testID, identical
copy ("Log this again" / "Log these again"), identical baked-macro clone
semantics, identical `food_logged { source: "log_again" }` event, identical
flag (`today_log_again`) on both surfaces. The only intentional platform
difference is mobile's light haptic (no web equivalent).

## Rollout

Flag OFF in PostHog. Grace validates in the iOS sim + browser; once she
confirms the interaction is the one she wanted, ramp via the PostHog
dashboard. After two weeks at 100% with no regression, the gate can be
removed in a follow-up cleanup PR.
