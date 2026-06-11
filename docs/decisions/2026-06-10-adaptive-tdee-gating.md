# Adaptive TDEE — completeness gate, slope trend, plausibility bound, sedentary seed

**Date:** 2026-06-10 · **Status: Resolved** · **Area:** Nutrition engine

Companion research (the spec this implements):
- `docs/ux/research/2026-06-10-adaptive-tdee-review.md` — forensic root-cause
  (R1/R2/R3 definitions + Grace's real data series + the exact failure
  arithmetic).
- `docs/ux/research/2026-06-10-tdee-methodology-survey.md` — methodology survey
  (the four-layer architecture; R1 promoted load-bearing, R2 ships *with* R1,
  R3 becomes a **bound/assert** not a standing blend).

## Problem

Grace's adaptive TDEE read ~1,314 kcal when it should have been ~1,500–1,600.
Root cause (forensic, confidence 9/10): the energy-balance estimator was
**healthy maths fed unhealthy input**. 7 of the 26 logging days in its 28-day
window were *partial* logs (284–680 kcal — a single snack, not a full day),
and there was **no completeness gate**. Average daily intake collapsed to
1,369, and TDEE (≈ intake − weight-trend) followed it down to 1,314 — *below
Grace's own sedentary formula floor (1,458)*, an internal contradiction no
surface flagged. She also *gained* +0.6 kg across the window while "eating
1,369" — physiologically impossible at a true 1,314 maintenance, the signature
of under-logging.

Two secondary defects compounded it: the per-weigh-in EMA(α=0.1) muted the
weight trend (captured only ~29% of the real move on sparse weigh-ins), and the
formula *seed* used Grace's **light (1.375)** multiplier — which already bakes
in workouts — *and then* the per-day activity bonus added workout burn on top
(a latent double-count).

## Decision — four layers (the recommended architecture)

The survey was deliberately adversarial to all three live positions (current
gate-less estimator; "use the Apple Watch total as maintenance"; "Watch
baseline + energy-balance drift"). The evidence (wearable energy-expenditure
MAPE 15–150%; MacroFactor / Carbon / RP all run *gated* energy balance and all
*refuse* wearable burn as the expenditure input) lands on: **keep gated
adaptive energy balance as the estimator of record; demote the Watch to a
plausibility bound + the per-day bonus.** Concretely:

### R1 — Completeness gate (load-bearing)
A day enters the intake average only when it is plausibly a *full* day:
`kcal ≥ max(1000, 0.8 × BMR)` (≈ 1,000 for Grace) and — when per-day entry
counts are available — `≥ 2 entries`. Excluded (partial) days do **not** count
toward the window or the confidence ramp. This is the MacroFactor/Carbon
"trusted day" guard, automated.

> On Grace's real series: 19 trusted days survive (7 partial days excluded).
> Gated mean intake **1,675** (vs ungated **1,369**) — the partial-day drag was
> **306 kcal/day**.

### R2 — Weight trend = least-squares slope (ships with R1)
Replace the per-weigh-in EMA(α=0.1) with a **least-squares slope** (kg/day) over
the raw weigh-ins in the window, **capped at ±0.35 kg/week** to reject
water/glycogen noise. The EMA under-smoothed sparse data; the slope reads the
real trend. **R2 must ship with R1** — shipped alone it makes Grace's number
*worse* (it removes the accidental cushion the intake error was getting from the
muted trend).

### R3 — Plausibility bound (a bound, NOT a standing blend)
Before the value is published, clamp it into **[0.85, 1.30] × sedentary
Mifflin** and floor it at the **HealthKit resting-energy** minimum when
available (resting energy is formula-grade — Apple derives it from a
Mifflin/Harris-Benedict formula — so it's a legitimate hard floor; active
energy is the noisy slice and is *not* used here). An out-of-band value is
**clamped, downgraded to `low` confidence, and logged with a structured
reason** — never a silent clamp. The survey explicitly *drops* the forensic's
optional "formula blend" half: gating fixes the input, so we don't permanently
dilute the output (a blend would mask genuine metabolic adaptation — the very
thing adaptive TDEE exists to capture).

> Grace's stored 1,314 < her 1,458 sedentary floor → 0.85 × 1,458 = 1,239 would
> have caught it tonight.

### Seed — sedentary (1.2), not the profile multiplier
The maintenance number that **coexists with the per-day activity bonus** (Today
derives `maintenanceKcal` from `resolveMaintenance`, then
`computeActivityBonusKcal` adds workout burn on top) is now seeded at
**sedentary (1.2)** regardless of the profile's activity setting. In Suppr's
add-back architecture (NEAT base + per-day exercise bonus), maintenance must be
the **lazy-day / NEAT** burn — or the activity the profile multiplier bakes in
is counted twice. Applied **only** to the bonus-coexisting chain
(`resolveMaintenance.computeFormulaKcal`, and the Progress "how this works"
explainer row that must reconcile to it). The static budget path
(`getEffectiveTDEE`/`calculateTDEE`), onboarding seed, and the profile activity
level's other consumers are **unchanged**.

## Reproduced numbers (Grace's real series, frozen clock)

| Variant | avg intake | trend energy | TDEE |
|---|---|---|---|
| **As-shipped (ungated, EMA)** — the bug | 1,369 | −49 | **1,320** (stored 1,314) |
| Gated, EMA trend (forensic gate-isolation figure) | 1,675 | −49 | **1,626** |
| **Gated + slope (R1+R2 — the shipped number)** | 1,675 | −83 | **1,592** |

The shipped result **1,592** is inside Grace's expected 1,500–1,600 range. The
1,626 figure is the same gate with the *old* EMA trend — kept as the
gate-isolation regression anchor (proves the gate alone moves 1,314 → 1,626).

## Product consequence flagged (for `product-lead`)

The sedentary seed flows through **`recomputeTargetsFromProfile`** (the shared
post-onboarding goal/pace editor + Settings activity-level self-edit), because
the saved `target_calories` *also* coexists with the per-day bonus on Today.
Consequence: the **Settings activity-level self-edit** (the AIIm60n / AHCSYMATS
fix) **no longer moves the calorie target** — the control still persists
`activity_level`, but maintenance is the same lazy-day number whatever the user
picks. This is *honest* under the add-back model (the bonus pays for activity),
but it makes the Settings activity control a near-no-op for calories. Whether
that control should be reframed (e.g. "activity affects your daily burn bonus,
not your baseline") or removed is a **UX decision for `product-lead`**, not a
nutrition-correctness one — flagged here so it isn't a silent behaviour change.
Pinned by the updated `tests/unit/profileActivityUpdate.test.ts`.

## Scope / parity

Pure shared modules under `src/lib/nutrition/`, re-exported to mobile via
`@suppr/shared`. Mobile consumes the *same* functions (verified: `progress.tsx`,
`index.tsx`, `burn-detail.tsx` import `resolveMaintenance` /
`maintenanceChain` from `@suppr/shared/nutrition/*`; the API route + mobile
`refreshAdaptiveTdee` re-export feed the same `computeAdaptiveTDEE`). No
mobile-side fork, no UI change. The only mobile-local TDEE copy
(`apps/mobile/lib/calcTargets.ts` `getEffectiveTDEE`/`calculateTDEE`) is the
*static budget* path, deliberately untouched.

## Display-layer follow-on — ENG-1034 (2026-06-11)

Once the gated estimator started correctly storing **`adaptive_tdee_confidence
= "medium"`** (value ~1,699), a display bug surfaced: the Progress **THIS WEEK**
card still showed the *"still calibrating"* headline + a **Low** confidence chip,
while the Maintenance card below it showed *"medium confidence"* — the two cards
contradicted each other for the same number (the same symptom F-124 flagged for
"high" in May, here for "medium").

Root cause: `generateProgressCommentary` (`src/lib/nutrition/progressCommentary.ts`)
re-gated a stored *medium* confidence on the caller's `loggingDays` (`calibrating`
when `< 14`). But both production callers — web `ProgressDashboard` and mobile
`Progress` tab — pass a **range-scoped** day count (this week's `daysWithFood`,
≤ 7), never the cumulative history. And the engine's confidence ladder
(`adaptiveTdee.ts`) only assigns "medium" at **≥ 14** cumulative logging days
(+ ≥ 5 weigh-ins) and "high" at ≥ 21 (+ ≥ 7). So a stored "medium" *already*
guarantees the warm-up is past; the weekly count can never reach 14, so the
re-gate forced every medium-confidence user into calibrating copy.

Fix: trust the engine's stored confidence — `calibrating` fires only when there
is **no estimate** or the engine itself reports **low**. The redundant
`loggingDays < 14` re-gate (and its `CALIBRATING_MIN_DAYS` constant) is removed.
The confidence chip + copy variant now follow the stored confidence on both
platforms. Pinned by `progressCommentaryPhase4.test.ts` (web) +
`progressHeadlinePhase4.test.tsx` (mobile), mapping each stored level →
chip + regime. Verified in-sim: the card shows *"Maintenance held steady this
week … 1,699 kcal with medium confidence"* + a **Medium** chip.

## One-time refresh for Grace's stored stale value

The fix changes the algorithm, but `daily_targets.maintenance_tdee` /
`profiles.adaptive_tdee = 1,314` is a value already written by the OLD logic. It
refreshes itself on next app open: a journal or weight write fires
`refreshAdaptiveTdeeForUser`, which recomputes with the new gate and persists.
The throttle (6h) is bypassable for an immediate refresh via the existing API:

- **Path (no SQL):** `POST /api/nutrition/adaptive-tdee` while authenticated as
  the account — it calls `refreshAdaptiveTdeeForUser(supabase, userId, {
  bypassThrottle: true })` and returns the recomputed value. Equivalent to
  opening the app and logging/weighing once (which clears the throttle window
  naturally within 6h regardless).
- **Account note:** Grace's live daily-driver rows are under
  `gracemturner@hotmail.co.uk` (not the `gracehowse@outlook.com` account, whose
  adaptive value is stale + no longer displayed). Refresh the *active* account.

Do **not** run anything against the production database directly to set the
value — let the recompute path write it (it's the only writer of those columns;
direct writes would trip the tier-lockdown trigger and bypass the confidence
gate).

## Confidence

9/10 on the root cause (the live function reproduces the stored value to within
6 kcal; removing only the partial days moves the output into Grace's expected
range). 8/10 on the architecture (the convergent practice of every serious
adaptive app + the direct fix for the observed bug). The 2 points of doubt are
the *exact* gate threshold + trend-cap constants, which want validation on more
than one user's series before the confidence-ramp constants are locked — these
are exported, named, and easy to tune.
