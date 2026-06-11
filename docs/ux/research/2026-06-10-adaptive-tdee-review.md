# Adaptive TDEE forensic review — why Grace's estimate reads ~1,300

**Date:** 2026-06-10 · **Status: FOR GRACE'S CALL — no behaviour changed.**
Analysis only; every number below is reproduced from code on
`claude/skia-ring-2026-06-10` and read-only SQL against the linked Supabase
project (`fnfgxsignmuepshbebrl`).

**Grace's report:** "adaptive tdee might need reviewing — it's got mine very
low (1300 ish, it should be more like 1500-1600)."

**Verdict in one line:** the estimator is healthy maths fed unhealthy input —
7 of the 26 days in its window are partial logs (284–680 kcal), there is no
completeness gate, so "average daily intake" collapses to 1,369 and the TDEE
follows it down to 1,314. Gate out the under-logged days and the same
algorithm reads **1,626** — inside her expected range.

---

## 1. The algorithm, plainly

Estimator: `src/lib/nutrition/adaptiveTdee.ts` → `computeAdaptiveTDEE()`
(mobile consumes the same file via `@suppr/shared`).

1. **Window:** trailing 28 days from the device-local date.
2. **Intake series:** `nutrition_entries` summed per `date_key`. A day counts
   as a "logging day" if its total is **> 0 kcal** — that is the only gate.
   A single 100 kcal snack makes the day count exactly like a fully logged
   1,900 kcal day.
3. **Weight series:** `profiles.weight_kg_by_day` entries inside the window,
   smoothed with an **EMA, α = 0.1, applied per weigh-in** (not per day — gaps
   are not expanded).
4. **Energy balance:**
   `TDEE = round(avg intake over logging days) − round(smoothedΔkg/day × 7,700)`,
   floored at 800.
5. **Eligibility:** ≥ 7 logging days + ≥ 3 weigh-ins
   (`progressDataContract.ts`). **Confidence:** medium at ≥ 14 days + ≥ 5
   weigh-ins, high at ≥ 21 + ≥ 7.
6. **Persistence:** `refreshAdaptiveTdeeForUser()`
   (`src/lib/nutrition/refreshAdaptiveTdee.ts`, mobile re-export) runs after
   journal/weight writes, throttled to 6 h, and persists to
   `profiles.adaptive_tdee` **only when confidence is medium/high**.
7. **Display/consumption:** `resolveMaintenance()`
   (`src/lib/nutrition/resolveMaintenance.ts`) prefers the adaptive value when
   confident **and** < 14 days old. Consumers: the Progress maintenance card
   (web `ProgressDashboard.tsx`, mobile `(tabs)/progress.tsx`
   `progress-maintenance-card`), Today's activity-bonus baseline,
   `getEffectiveTDEE()` (`tdee.ts`), the goal-pace editor / weekly check-in
   retune (`useGoalPaceEditor.ts` passes the adaptive columns into
   `recomputeTargetsFromProfile`), and the daily `daily_targets` snapshot
   (`maintenance_tdee` column).

Pinning tests: `tests/unit/adaptiveTdee.test.ts`,
`recomputeAdaptiveMaintenance.test.ts`, `resolveMaintenance.test.ts`,
`getEffectiveTDEE.test.ts`. **Note:** every fixture in `adaptiveTdee.test.ts`
uses fully-logged synthetic days, so the missing completeness gate is never
exercised by a test.

### Which account, which surface

Grace's live daily-driver rows are under **gracemturner@hotmail.co.uk**
(`e9f85055-…`, 424 entries, logged through 2026-06-10). The
gracehowse@outlook.com account stopped logging 2026-05-13 (its adaptive value,
1,617/high, is stale and no longer displayed). The "~1,300" she saw is
`profiles.adaptive_tdee = 1,314` (medium), written **2026-06-11 01:59 UTC =
20:59 local, tonight**, rendered by the Progress maintenance card via
`resolveMaintenance` (adaptive wins: medium + fresh).

Her quoted daily **goals** are a different pipeline: rendered goal = current
`target_calories` 1,252 (goal_history, effective 2026-06-08: steady
0.4 kg/week off **formula** maintenance) + that day's exercise bonus
(1,545 = 1,252 + 293 · 1,691 = 1,252 + 439 · 1,619 = 1,252 + 367 ✓). So the
1,314 is not currently inside her daily goal — but it **will** drive the next
goal-pace retune while fresh (see §5 blast radius).

---

## 2. Her data — the estimator's actual window

Window at the 2026-06-10 20:59 refresh: **2026-05-13 → 2026-06-10** (28 days,
local America/Cayman). 26 logging days, 6 weigh-ins.

| Date (2026) | kcal logged | entries | weight kg | counts toward avg? | complete day? |
|---|---|---|---|---|---|
| 05-13 | 1,460 | 11 | 54.4 | yes | yes |
| 05-14 | 1,921 | 9 | — | yes | yes |
| 05-15 | **284** | 3 | — | **yes** | **no — partial** |
| 05-16 | — | 0 | — | no (zero-day skipped) | — |
| 05-17 | 3,750 | 2 | — | yes | plausible feast day (kept) |
| 05-18 | **520** | 1 | — | **yes** | **no — partial** |
| 05-19 | — | 0 | — | no | — |
| 05-20 | 1,664 | 9 | — | yes | yes |
| 05-21 | **672** | 8 | 54.9 | **yes** | **no — partial** |
| 05-22 | **466** | 2 | 54.9 | **yes** | **no — partial** |
| 05-23 | **680** | 1 | — | **yes** | **no — partial** |
| 05-24 | 2,100 | 2 | — | yes | yes |
| 05-25 | 1,276 | 18 | — | yes | yes |
| 05-26 | 1,459 | 20 | — | yes | yes |
| 05-27 | 1,267 | 9 | — | yes | yes |
| 05-28 | 1,504 | 11 | 54.7 | yes | yes |
| 05-29 | 1,626 | 10 | — | yes | yes |
| 05-30 | 1,182 | 11 | — | yes | yes |
| 05-31 | 1,292 | 7 | — | yes | yes |
| 06-01 | 1,944 | 3 | — | yes | yes |
| 06-02 | 1,529 | 4 | — | yes | yes |
| 06-03 | 1,901 | 5 | — | yes | yes |
| 06-04 | 1,708 | 4 | 54.6 | yes | yes |
| 06-05 | **458** | 1 | — | **yes** | **no — partial** |
| 06-06 | — | 0 | — | no | — |
| 06-07 | **676** | 2 | — | **yes** | **no — partial** |
| 06-08 | 1,765 | 9 | — | yes | yes |
| 06-09 | 1,136 | 3 | 55.0 | yes | yes |
| 06-10 | 1,345 | 5 | — | yes | yes |

- Zero-logging days (05-16, 05-19, 06-06) are correctly excluded (`v > 0`).
- The **7 bold partial days average 537 kcal** — single-entry or two-entry
  days that are clearly not full days of eating. The algorithm cannot tell.

## 3. The recomputation (real function, frozen clock)

Ran the actual `computeAdaptiveTDEE` module against the series above with the
clock frozen at the refresh instant (TZ America/Cayman):

```
avg intake   = 35,585 / 26 days            = 1,369 kcal/day
weight EMA   = 54.4 → 54.5716 over 27 days = +0.0064 kg/day
energy term  = +0.0064 × 7,700             = +49 kcal/day (gaining)
TDEE         = 1,369 − 49                  = 1,320   (confidence: medium — 26 days, 6 weigh-ins)
```

Stored value: **1,314**. The 6 kcal residual is consistent with a small entry
edit after the 01:59 UTC write (every 06-10 entry's `created_at` predates the
refresh; `nutrition_entries` has no `updated_at` to confirm). Same maths,
same shape — the reproduction is exact to within one edited snack.

**Root cause, with arithmetic:** the 7 partial days contribute
3,756 kcal / 7 days. Without them, the remaining 19 full days sum to
31,829 → **1,675 kcal/day**. The partial days drag the mean down by
**306 kcal/day**, and since TDEE ≈ mean intake ± a small weight-trend
correction, the estimate lands at ~1,314 — it is measuring *what got logged*,
not *what Grace burns*. Meanwhile her raw weight **rose** +0.6 kg across the
window while "eating 1,369" — physiologically inconsistent, and exactly the
signature of under-logging.

**Secondary defect — the EMA mutes the weight signal.** α = 0.1 applied
per-weigh-in over only 6 points lets the smoothed series capture just 29% of
the raw change (+0.173 kg vs +0.6 kg). Here that accidentally *propped the
estimate up* (raw trend would give 1,369 − 171 = **1,198**); for a user
genuinely losing weight it does the opposite and understates TDEE. Either
way the trend term is ~3.5× too weak with sparse weigh-ins.

Not the cause: no unit issues (kg throughout, 7,700 kcal/kg per Hall & Chow),
no seed blending (the estimator never mixes in Mifflin), window length is a
minor amplifier only, and the 2023 outlier weigh-ins (93.1 kg etc.) are
outside the 28-day window.

## 4. Sanity baselines on the same person

| Estimate | kcal/day | Notes |
|---|---|---|
| Mifflin BMR (55 kg · 157 cm · 31 F) | 1,215 | `calculateBMR` |
| Mifflin × sedentary 1.2 | 1,458 | floor-of-plausibility for her |
| **Mifflin × light 1.375 (her setting)** | **1,671** | what the formula branch shows |
| Katch-McArdle | n/a | no body-fat % stored anywhere in `profiles` |
| **As-shipped adaptive** | **1,314–1,320** | the complaint |
| Trusted-day gated (days ≥ 1,000 kcal), EMA trend | **1,626** | same algorithm + completeness gate |
| Trusted-day gated, raw weight trend | **1,504** | gate + un-muted trend |

A MacroFactor-style trusted-day estimator on her own series lands
**1,500–1,650 — exactly the 1,500–1,600 she expected.** The stored 1,314 is
also *below her sedentary formula floor* (1,458), an internal contradiction no
surface currently flags.

The `daily_targets.maintenance_tdee` history makes the input-noise visible:
1,490 (06-01) → 1,391 → **1,216 (06-04)** → 1,289 → 1,416 → 1,406 → 1,380 →
1,394 → 1,384 (06-10) — a ±270 kcal swing in 10 days as partial days slide
through the window.

## 5. Blast radius of the wrong 1,314

1. **Progress maintenance card** (web + mobile) — shows ~1,314 as "your
   maintenance" with a medium-confidence badge. This is what Grace saw.
2. **Next goal-pace retune** — `useGoalPaceEditor` now passes the adaptive
   columns; while 1,314 is fresh + medium, a steady-pace (0.4 kg/wk, −440)
   retune would write a **874 kcal/day target** — far below the 1,200 female
   floor, which only soft-warns. (Precedent: goal_history already contains an
   845 kcal target from a 2026-05-25 accelerated retune off formula 1,670 —
   the floor genuinely does not block.)
3. **Today's activity-bonus baseline + recap deficit math** — both read
   `resolveMaintenance`, so deficits are computed against an understated
   maintenance.
4. Her **current** daily goal (1,231 from tonight's onboarding redo;
   1,252 before it) happens to be formula-based, so the daily goal itself is
   not yet contaminated.

## 6. Remediation options — FOR GRACE'S CALL (ranked, no behaviour changed)

**R1 — Completeness gate on logging days (recommended root fix).**
A day only enters `avgDailyIntake` if it is plausibly a full day —
e.g. `kcal ≥ max(1000, 0.8 × Mifflin BMR)` (≈ 1,000 for Grace), optionally
AND ≥ 2 entries. This is the MacroFactor trusted-day idea, automated.
On her series: 19 trusted days → **1,626**. *Cost:* fewer eligible days means
slower confidence ramp (she'd still clear `medium` comfortably at 19 days);
a genuine fasting day is wrongly excluded — an acceptable, conservative bias.
Touches `adaptiveTdee.ts`, `progressDataContract.ts` thresholds, and the
fixtures in `adaptiveTdee.test.ts` (which currently never test partial days).

**R2 — Fix the weight-trend signal (ship together with R1, not alone).**
Replace the per-entry α = 0.1 EMA with a least-squares slope over the raw
weigh-ins in the window (or a time-aware EMA). Today the trend term carries
only ~29% of the real weight change with sparse weigh-ins. *Cost:* more
sensitivity to water-weight noise on short windows — mitigate with the
existing ≥ 3 weigh-in gate plus a slope cap (e.g. ±0.35 kg/week). **Warning:**
shipped alone this makes Grace's number *worse* (1,369 − 171 = 1,198), because
it removes the accidental cushioning of the intake error. R1 first, then R2
gives 1,504.

**R3 — Plausibility clamp + formula blend (cheap guardrail, masks not fixes).**
Reject (or confidence-downgrade) adaptive values outside e.g.
0.85–1.30 × the sedentary formula TDEE, and/or blend
`w × energyBalance + (1−w) × Mifflin` with `w` keyed to confidence. 1,314 <
1,458 sedentary would have been caught tonight. *Cost:* dilutes the "learns
your real metabolism" promise and can hide genuine metabolic adaptation;
keeps bad inputs flowing into a number that merely looks safer.

**Recommendation:** R1 + R2 as one change (with R3's clamp as a belt-and-braces
assert), then recompute for her account via the existing
`refreshAdaptiveTdeeForUser(…, { bypassThrottle: true })` path. Expected
post-fix readout for Grace on today's data: **~1,500–1,630**.

Confidence in the root cause: **9/10** — the live function reproduces the
stored value to within 6 kcal, and removing only the partial days moves the
output into her expected range with no other change.

---

*Sources: `src/lib/nutrition/adaptiveTdee.ts`, `refreshAdaptiveTdee.ts`,
`resolveMaintenance.ts`, `tdee.ts`, `progressDataContract.ts`,
`goalPaceRetune.ts`, `recomputeTargetsForActivity.ts`,
`apps/mobile/components/recap/useGoalPaceEditor.ts`; read-only SQL on
`profiles`, `nutrition_entries`, `daily_targets`, `goal_history`
(2026-06-10). Grace's own health data in her own private repo.*
