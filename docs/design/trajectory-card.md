# Trajectory card — design brief (ENG-741)

> Implemented 2026-05-26 behind the `progress_trajectory_box` feature
> flag (default off). Shared maths:
> `src/lib/weightProjection.ts` (`computeTrajectory`,
> `avgCaloriesOverRecentLoggedDays`, `signedObservedKgPerWeek`). Web
> renderer: `src/app/components/suppr/trajectory-card.tsx`. Mobile
> renderer: `apps/mobile/components/progress/TrajectoryCard.tsx`. Wired
> into `src/app/components/ProgressDashboard.tsx` (web) and
> `apps/mobile/app/(tabs)/progress.tsx` (mobile), directly under the
> weight chart card. Approved prototype:
> `docs/prototypes/2026-05-26-progress-trajectory-box/index.html`.
> Pinned by `tests/unit/computeTrajectory.test.ts`,
> `tests/unit/trajectoryCard.test.tsx` (web), and
> `apps/mobile/tests/unit/trajectoryCard.test.tsx` (mobile).

## 1. Design intent

Answer the question "if I keep going at this pace, what will I weigh?"
as its own calm, single-hero card — separate from the goal-anchored
Journey card (which is about days-to-goal + progress-to-goal). It is a
**forecast, not a verdict**: blue/accent throughout, never red/green.

It does **not** modify or replace the weight chart, and it does not
duplicate the Journey card — it sits between them.

## 2. Placement

Directly under the weight chart card, above the Journey card. Same
`weightSurfaceMode === "show"` gate as the chart + Journey card, so a
single weight opt-out hides every absolute-weight surface on Progress.

## 3. States

The state is decided entirely by the shared `computeTrajectory()` helper
(no rendering-side maths). Three outcomes:

| State | Condition | Render |
|---|---|---|
| **projection** | ≥5 food-logged days **and** a real recent average **and** a current weight | eyebrow `PROJECTED WEIGHT`; hero `{projectedKg} kg` (large, accent blue) + `in ~{N} weeks`; basis line `If you keep your current pace — last 7 days averaged {avg} kcal/day vs {target} target.`; footnote `Based on 7,700 kcal ≈ 1 kg. An estimate, not a promise.` |
| **placeholder** | a current weight exists but <5 food-logged days (or eligible but the recent average is 0) | eyebrow + `Log {N} more days to see your trajectory` + `We project from your last 7 days. A 3-day average swings too much to forecast honestly.` + a thin progress bar (days-logged / 5) |
| **hidden** | no current weight at all | renders nothing — never fabricate a forecast from a missing input |

The 5-day floor is `MIN_DAYS_FOR_PROJECTION` (pinned by
`weightProjectionFloor.test.ts`). Below it the projection is suppressed
honestly rather than back-filled with a noisy 2–3-day forecast.

## 4. Reused logic (no duplication)

The card never re-derives the projection. `computeTrajectory()` composes
the existing primitives the Progress "Journey" card already used inline:

- `avgCaloriesOverRecentLoggedDays(byDay, 7)` — trailing 7 food-logged
  days, negatives floored at 0, returns `{ avgCalories, daysWithFood }`.
  The Journey card's inline 7-day average was promoted into this shared
  helper so both surfaces (and web ↔ mobile) project from one number.
- `shouldRenderDailyProjection(daysWithFood)` — the ≥5-day gate.
- `signedObservedKgPerWeek(timeline)` — the observed-scale-rate override
  (negative = losing) fed into `projectWeight({ observedKgPerWeek })`.
- `projectWeight(...)` — the 7,700 kcal/kg model, observed-rate-aware.

Inputs at both call sites are identical to the Journey card's:
`latestWeightKg`, `targets.calories`, effective `maintenanceTdeeKcal`
(adaptive when available, else static Mifflin), `userGoal`, and the
`calcGoalTimeline` result.

## 5. Tone & tokens

- Accent blue (`var(--primary)` / `Accent.primary`) for the hero and the
  progress-bar fill — calm forecast, not a pass/fail signal.
- Tokens only, no hardcoded hex. Numbers use `tabular-nums`.
- Hero number is `ph-mask`ed on web (session-replay privacy, matching the
  Journey card's weight bookends).

## 6. Cross-platform deviations

None of substance. Same structure, copy, states, colour, and gate on both
platforms. Platform-native primitives only (web `<section>` + Tailwind
tokens; mobile `<View>` + theme constants).

## 7. Related modal-copy fix (ENG-741)

The mobile "Day logged!" modal
(`apps/mobile/components/today/TodayCompleteDayModal.tsx`) previously read
"Your Journey page uses your 7-day average, so the number there may
differ." That pointed users with <5 logged days at a Progress projection
that is gated off until day 5. The sentence was dropped; the modal now
describes only its own single-day basis ("…repeated daily (7,700 kcal ≈
1 kg). An estimate, not a promise."). The web dialog
(`src/app/components/suppr/today-complete-day-dialog.tsx`) never made the
Journey claim, so it was already truthful and is unchanged.

## 8. Feature flag

`progress_trajectory_box` (PostHog). Default-absent → false → card not
shown (current layout preserved in the `else`). Web reads it via
`isFeatureEnabled("progress_trajectory_box")` from `@/lib/analytics`;
mobile via the same call in `apps/mobile/lib/analytics.ts`, with the dev
override `EXPO_PUBLIC_FLAG_FORCE_PROGRESS_TRAJECTORY_BOX=true`. Once the
flag holds 100% for two weeks with no regression, the gate can be removed
in a follow-up cleanup PR.

## 9. Open questions (deferred — from the prototype "For you" notes)

- Show a goal-weight ETA inside this card too ("on track to hit your
  48 kg goal by Jul 4"), or keep it pure-trajectory? Current build keeps
  it pure-trajectory — the Journey card owns goal-ETA.
- Placement: directly under the chart (current) vs lower near the Journey
  card. Shipped under the chart per the approved prototype.
