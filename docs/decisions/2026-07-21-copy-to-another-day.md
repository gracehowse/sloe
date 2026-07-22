# "Copy to another day" — replacing the instant Today-slot relog

**Date:** 2026-07-21
**Status:** Resolved (both platforms implemented, tests green; gated OFF behind the existing `today_log_again` flag pending Grace sim/browser sign-off)
**Area:** Today / Logging / MFP-refugee retention loop
**Flag:** `today_log_again` — **same flag key, new behavior** (not a new flag; the old instant-relog path is deleted, not left in the `else`)
**Issue:** [ENG-786](https://linear.app/suppr/issue/ENG-786)
**Supersedes:** [`2026-05-30-log-this-meal-again.md`](2026-05-30-log-this-meal-again.md) — the shipped ENG-786 "Log this/these again" row and its `logAgainSlot` handler are removed on both platforms.

## The problem — the shipped relog was a defect, not a feature

The 2026-05-30 decision shipped a one-tap **"Log this/these again"** row under a
populated Today slot that instantly re-inserted the slot's entries as fresh logs
on the viewed day. It rode in flag-OFF precisely because the interaction model
was flagged as uncertain — "we ship the row flag OFF by default so Grace feels it
in the sim and can redirect before it reaches anyone else." Feeling it in the sim
is the redirect. The instant action is wrong on three counts:

1. **Silent calorie-doubling, no confirmation.** One tap silently duplicated an
   entire meal slot's calories onto the day. There is no more expensive silent
   mutation in a calorie tracker than doubling a meal the user can't see happen —
   and it happened with zero confirmation step.
2. **No undo.** The 2026-05-30 doc itself deferred a dedicated undo toast as "a P2
   on ENG-786"; v1 undo was "delete the rows one by one." So the most destructive
   action on Today was also the only mutating action with no first-class reversal.
3. **A real dating bug: it stamped the *current wall-clock time* even when the user
   was viewing a past day.** `logAgainSlot` cloned the slot's entries with a fresh
   "now" timestamp. Viewing last Tuesday and tapping "Log again" did **not** log
   the meal onto Tuesday at Tuesday's time — it stamped it with today's clock. The
   one gesture whose entire purpose is "I ate this again" mis-dated the entry it
   created, corrupting the very day-total the user was looking at.

The through-line: an *instant, unconfirmed, irreversible, mis-dated* mutation of
nutrition data. Each property on its own is a bug; together they make the control
a liability the moment the flag ramps.

## The decision

Tapping the control on a populated slot — same slot row, same `today_log_again`
flag — **always opens a destination picker** ("Copy to another day"). Nothing is
written until the user confirms a destination. The picker resolves:

- **Which day(s).** A single target day, or a multi-day quick-range (the existing
  `CopyMealSheet` / `copy-meal-dialog` calendar + quick-range chips), reusing the
  established per-meal copy surface rather than inventing a second one.
- **Which meal slot.** A slot-selector pill row (Breakfast / Lunch / Dinner /
  Snacks) so "copy Monday's big lunch into Tuesday's dinner" is one gesture. The
  summary line only appends the ` · <Slot>` suffix when the slot actually changes.

Commit goes through the new slot-aware `copySlotToDateRange` (mobile
`useCopyDuplicateMeal.ts`, web `useNutritionJournalState.ts` /
`copyMeals.ts`), which copies **every** entry in the source slot to each chosen
day+slot, and a success toast fires with a **real, working Undo**
(`undoCopyToSlot`) — closing the exact gap the 2026-05-30 doc deferred. Empty
slot → an info toast ("Nothing to copy"), no dialog thrash.

### Smart default destination — match the real-world gesture

The picker opens on the day the user most likely means, derived from the day they
are viewing:

- **Viewing today → default target = tomorrow.** The common "cook once, eat it
  again tomorrow" plan-ahead gesture.
- **Viewing a past day → default target = today.** This is the "log what I ate
  last Tuesday" gesture: the user is looking at Tuesday's meal precisely because
  they want it on *today's* plate. Defaulting to today (not to Tuesday-again, and
  not to tomorrow) lands the copy where the intent points. Implemented as
  `initialTargetDayKey` when `selectedDateKey` is in the past.

The default is a *starting position*, not a commitment — every destination is
still one tap away, and nothing writes until confirm.

## What we rejected and why

- **Keep an instant default, add a chevron / long-press for the picker.** The
  tempting "preserve the fast path, make the destination optional" design. Rejected
  because **the instant default itself is the thing nobody wants.** An instant
  relog-onto-today is silent doubling with a mis-dated timestamp — preserving it as
  the default just preserves the defect and hides the correct action behind a
  secondary gesture most users never discover. There is no "safe" instant default
  to preserve here; the destination step *is* the feature, so it is the primary and
  only path.
- **Fold "Save as a meal" into this flow.** Rejected — "save this slot as a durable
  usual meal" is a *different intent* (build a reusable template) from "copy this
  instance to another day," and it already ships as its own adjacent control (the
  full-width "Save {Slot} as a meal" row / the Usual-meals system). Merging two
  distinct intents into one control is exactly the interaction-model ambiguity the
  2026-05-30 doc worried about. They stay separate, side by side.
- **A new feature flag.** Rejected — the old path is being *replaced*, not run in
  parallel. Reusing `today_log_again` (with the old branch deleted, not stubbed in
  the `else`) keeps one ramp lever and avoids a dead flag. The PostHog analytics
  source moves `log_again` → `copy_slot` to keep the funnel honest about what the
  tap now does.

## Parity

Same behavior both platforms: mobile `CopyMealSheet` + `TodayScreen` /
`TodayMealsSection`; web `copy-meal-dialog` + new `copy-slot-dialog` host +
`NutritionTracker` / `today-meals-section`. Same slot-selector, same
3-arg `onConfirm(targetDayKeys, targetSlot, summary)`, same smart default, same
Undo toast, same `copy_slot` event, same flag. Icon moves `RefreshCw`/`refresh`
→ `Copy`; label is always "Copy to another day"; testIDs `today-log-again-*` →
`today-copy-slot-*`.

Mobile screen-budget (ENG-621/717 `check:screen-budget`) — this rebuild pushed
three pinned mobile files over their pin; each was brought back under budget by
extraction, not re-pinning: `CopyMealSheet.tsx`'s month-calendar grid moved to
`components/today/CopyMealCalendar.tsx`, and `TodayScreen.tsx`'s whole-slot
`CopyMealSheet` render + `onConfirm`/toast wiring moved to
`components/today/CopySlotSheetHost.tsx`. `TodayMealsSection.tsx` was brought back
under its pin by tightening comments. No behavior change from any of the three.

## Tests

- Mobile: `useCopyDuplicateMeal.test.tsx` (`copySlotToDateRange` happy /
  same-day-diff-slot / same-day-same-slot no-op / empty-slot / partial-fail +
  `undoCopyToSlot` exact-id removal), `todayCopySlotRow.test.tsx` (replaces the
  deleted `todayLogAgainRow.test.tsx`), `copyMealSheet.test.tsx` (slot selector +
  3-arg payload + suffix).
- Web: `copyMealDialog.test.tsx`, `todayMealsSectionCopySlot.test.tsx` (renamed
  from `…LogAgain`), `nutritionJournalBulkInsert.test.tsx` (`copySlotToDateRange`
  matrix incl. same-day/same-slot no-op, plus the legacy-`"Snack"` normalization
  case below).

## Fix — web count-shown vs items-copied divergence (review, 2026-07-21)

Adversarial review caught a web-only bug: `NutritionTracker`'s `mealsGrouped` (the
source of both the dialog's shown item count and `copy-slot-dialog.tsx`'s `count`)
groups meals by `normalizeJournalSlotName(m.name)` — which maps the legacy DB
value `"Snack"` → `"Snacks"` — but `useNutritionJournalState.ts`'s
`copySlotToDateRange` filtered the source slot by the **raw** `m.name`. A legacy
`"Snack"` row was therefore visibly counted under "Snacks" but silently excluded
from the copy: the toast under-reported the item count, or read "Nothing to copy"
for a visibly non-empty slot, and the row never got re-slotted. Fixed by
normalizing both sides of the comparison (`normalizeJournalSlotName(m.name) ===
normalizeJournalSlotName(sourceSlot)`), so the shown count and the copied count
agree by construction. Mobile does not have this bug — `TodayScreen.tsx`'s
`mealGroups` (the header-count source) and `useCopyDuplicateMeal.ts`'s
`copySlotToDateRange` both group/filter by the same **raw** `m.name || "Other"`,
so there is no shown-vs-copied asymmetry to fix there.

## Rollout

Flag stays OFF in PostHog. Grace validates the picker-first flow + the smart
default in the iOS sim and browser; once confirmed, ramp via the dashboard. After
two weeks at 100% with no regression, the flag gate can be removed in a follow-up
cleanup PR.
