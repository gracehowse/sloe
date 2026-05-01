# Weekly Check-in — MacroFactor parity (TDEE delta + goal-pace re-tune)

**Date:** 2026-04-30
**Status:** Resolved
**Area:** Progress / Today / Onboarding adjacent
**Owner:** Grace
**Authority:** extended-competitor-audit (2026-04-30) — MacroFactor
identified as a conversion-blocker for the analytical-tracker persona.

## Problem

> "MacroFactor walks the user through a structured weekly review:
> weight delta, intake delta, 'your TDEE moved from X to Y, here's
> why.' Suppr's `refreshAdaptiveTdeeForUser` runs silently with
> confidence gating. The math is there; the *moment* isn't."
>
> "MacroFactor lets the user explicitly slow/speed the cut from the
> check-in. Suppr requires an onboarding-style profile re-run."

The shared adaptive-TDEE engine
(`src/lib/nutrition/adaptiveTdee.ts` + `refreshAdaptiveTdee.ts`) and
goal-rate math (`src/lib/onboarding/targets.ts`) were both shipped
months ago. The audit finding was about the **surface**, not the math:
Suppr never made the weekly TDEE update visible, and the user couldn't
adjust pace without re-running onboarding.

## Decision

Ship a Weekly Check-in moment that:

1. Shows **TDEE before → after** with a plain-English why-line
   ("Your body is burning more than we thought.").
2. Shows **intake delta vs target** + **weight delta vs week-ago**
   in observational copy.
3. Offers a **goal-pace re-tune** sheet that re-runs `calcTargets`
   with a new kg/week input — no onboarding rerun.
4. Holds the calm-streak posture: no celebration, no exclamation
   marks, no emoji glyphs, no shame.

The check-in lives **on the existing `weekly-recap` screen** rather
than a new route. Single coherent weekly surface; the StreakPip pip
already navigates there. Web parity is the existing
`<Digest>` card's narrative section — extended with the same payload
the mobile screen renders (shared `buildWeeklyCheckin` helper).

## Architecture

### Pure shared module — `src/lib/nutrition/weeklyCheckin.ts`

Owns the cascade. Three states:

- `first_week` — `previousTdeeKcal == null`. Headline: "Your check-in
  starts after 7 days of data." No delta, no why-line.
- `low_confidence` — `weighInsThisWeek < 3`. Headline: "Building
  confidence — needs more data." Delta line still rendered for
  transparency; why-line suppressed.
- `ready` — both gates pass. Headline names the direction
  ("up by N kcal" / "down by N kcal"); why-line names the
  intake-vs-burn pattern.

Direction has a noise floor of `±20 kcal` — under that, we say
"held steady" rather than misleading the user about a change that's
inside the calculator's expected variance.

### Pure shared module — `src/lib/nutrition/goalPaceRetune.ts`

Owns the math for the goal-pace re-tune. Re-uses `paceToKcalAdjustment`
+ `calculateMacros` + `safetyFloorFor` from the existing onboarding
helpers so the result is identical to onboarding's Reveal step.

`computeRetunedTargets` is preview-safe — it returns the new target
calories + macros + a `belowSafetyFloor` flag the UI uses to render
the soft-warn banner. The flag never blocks the Confirm button
(Suppr policy: soft-warn-not-block, decision doc 2026-04-19).

### Mobile — `apps/mobile/app/weekly-recap.tsx`

New "Your TDEE this week" section above the existing days/calories/
protein cards. The "Adjust goal pace" CTA opens
`apps/mobile/components/recap/GoalPaceRetuneSheet.tsx`, which writes
the new `(target_calories, target_protein, target_carbs, target_fat,
target_fiber_g, plan_pace)` to `profiles` and fires
`goal_pace_adjusted`.

### Mobile — `apps/mobile/components/today/WeeklyCheckinBanner.tsx`

Sunday-morning Today banner pointing at `/weekly-recap`. AsyncStorage-
gated per `(userId, weekKey)` so dismissals don't leak across weeks.
Rendered only on the first day of the user's week (Sun for Sunday-
start, Mon for Monday-start) AND only when not dismissed for the
current `weekKey`.

### Mobile — previous-week TDEE storage

`apps/mobile/lib/lastWeekTdee.ts` — AsyncStorage helper that captures
the current adaptive TDEE under each week's key on screen unmount.
Next week's visit reads the previous week's entry as the baseline.

**Why AsyncStorage and not a schema column:** the audit task explicitly
called this out — adding a complex history table just to compute one
delta is over-engineering. The web side reads from `daily_targets`
snapshots (which already capture `maintenance_tdee` per day), so we
already have the data on web; mobile uses local storage for the same
purpose without round-tripping through the network.

### Web — `src/app/components/suppr/digest.tsx`

Digest narrative gains an optional `weeklyCheckin` slot rendering the
same payload the mobile screen produces. `onAdjustGoalPace` routes to
`/settings#targets` (the existing Targets edit flow). No parallel
modal sheet on web — Settings → Targets already covers the write
surface.

### Analytics

Three new events registered in `src/lib/analytics/events.ts`:

- `weekly_checkin_viewed` — once per visible week, on either
  platform. Payload: `{ weekKey, kind, direction, tdeeDeltaKcal }`.
- `goal_pace_adjusted` — on confirm. Payload:
  `{ previousPaceKgPerWeek, newPaceKgPerWeek, previousTargetKcal,
  newTargetKcal, belowSafetyFloor, surface }`.
- `weekly_checkin_banner_tapped` / `weekly_checkin_banner_dismissed`
  — Today banner engagement (mobile-only).

## Posture rules (calm)

Pinned by `tests/unit/weeklyCheckin.test.ts` — every rendered string
is asserted against a forbidden-token list:

- No `!` (exclamation marks).
- No "amazing", "crushed", "great job", "on fire".
- No 🔥, 💪, 🎯, 💯, ✨ glyphs.
- The "flat" branch produces "Your TDEE estimate held steady" —
  observational, not silent.

## Files

- **New:** `src/lib/nutrition/weeklyCheckin.ts` (cascade + helpers).
- **New:** `src/lib/nutrition/goalPaceRetune.ts` (re-tune math).
- **New:** `apps/mobile/lib/weeklyCheckin.ts` (re-export).
- **New:** `apps/mobile/lib/goalPaceRetune.ts` (re-export).
- **New:** `apps/mobile/lib/lastWeekTdee.ts` (AsyncStorage snapshot).
- **New:** `apps/mobile/lib/weeklyCheckinBannerDismissal.ts`
  (per-week dismissal storage).
- **New:** `apps/mobile/components/recap/GoalPaceRetuneSheet.tsx`.
- **New:** `apps/mobile/components/today/WeeklyCheckinBanner.tsx`.
- **Extended:** `apps/mobile/app/weekly-recap.tsx` — Check-in section
  + retune sheet wiring.
- **Extended:** `apps/mobile/app/(tabs)/index.tsx` — Sunday banner.
- **Extended:** `src/app/components/suppr/digest.tsx` — narrative
  slot.
- **Extended:** `src/app/components/ProgressDashboard.tsx` — payload
  + onAdjustGoalPace handler.
- **Extended:** `src/lib/analytics/events.ts` — 4 new events.

## Tests

- `tests/unit/weeklyCheckin.test.ts` — 17 tests pinning the cascade,
  why-line phrasing, calm-posture, and numeric correctness.
- `tests/unit/goalPaceRetune.test.ts` — 14 tests pinning the math
  (paceToKcalAdjustment integration + macro reconciliation +
  safety-floor flag + paceLabel copy).
- `apps/mobile/tests/unit/weeklyCheckinStorage.test.ts` — 11 tests
  pinning the AsyncStorage round-trips for both stores.
- `apps/mobile/tests/unit/goalPaceRetuneSheet.test.tsx` — 4 tests
  pinning the sheet's preview / safety-warn / confirm-write flow.

Total: **46 new tests**.

## Web/mobile parity

- **Same:** `buildWeeklyCheckin` cascade, `computeRetunedTargets`
  math, copy phrasing, `weekly_checkin_viewed` + `goal_pace_adjusted`
  events.
- **Different (intentional):**
  - Mobile has a dedicated route + modal sheet; web routes
    `Adjust goal pace` to Settings → Targets (already shipped).
  - Mobile has a Sunday Today banner; web does not. Web's Digest is
    Sunday-cadence-gated already, so a banner on the Progress page
    would be redundant.
  - Mobile reads previous-week TDEE from AsyncStorage; web reads from
    `daily_targets` snapshot rows. Same value semantically; storage
    layer differs because the platforms have different defaults.
