# Nutrition-audit P1 fixes (ENG-1025…1029)

**Date:** 2026-06-11
**Area:** Nutrition engine / Progress / Fasting / Targets
**Status:** Resolved
**Source audit:** `docs/ux/research/2026-06-10-nutrition-calculations-audit.md`

Five P1 findings from the 2026-06-10 nutrition-calculations audit, fixed as one
batch. The P0 (#1 adaptive-TDEE slope bias) and the gap-fill smoothing (#3) are
owned separately under `adaptiveTdee.ts` and are not part of this change.

---

## ENG-1025 — gain-goal 2× mismatch (audit #2)

**Problem.** The calorie budget halves the surplus for gaining
(`calculateBudget` → `tdee + PACE_DAILY_DEFICIT[pace] * 0.5`, e.g. +275 at
"steady"), but the "why this number" explainer and the weeks-to-goal projection
used the **full** nominal pace (+550, 0.5 kg/wk). A gaining user saw a Goal row
and a Result row that disagreed by 2×, and goal dates ~2× too optimistic.

**Convention decided.** The **halved-surplus budget is the deliberate,
defended behaviour** — gaining lean mass is slower than losing fat at the same
nominal rate (audit table #13: surplus-smaller-than-deficit bulking is the
lean-bulk norm). So the explainer + weeks-to-goal now reflect the **halved
effective pace**, sourced from the budget, not from the nominal preset.

**Single source of truth.** `GAIN_SURPLUS_PACE_FACTOR = 0.5` and
`effectiveWeeklyKgForGoal(nominalWeeklyKg, goalType)` in `tdee.ts`. For gain,
the "why this number" Goal row now derives its pace from `target − maintenance`
(the budget is the source of truth), so the Goal row and the Result row can
never disagree again. `weeksToGoal` / `planOptions` scale the gain rate through
the same factor. Loss / maintain are unscaled (a losing user's display always
matched their budget).

**Pinned by** `tests/unit/tdee.test.ts` (cross-module parity: budget ==
explainer == weeks-to-goal) + `tests/unit/whyThisNumber.test.ts`.

## ENG-1026 — "On track" tile judged raw 7-day delta (audit #4)

**Problem.** The Trend tile's "on track" / "this week" copy was judged on two
**raw** weigh-ins ~7 days apart. Raw scale weight swings 1–2 kg/day on water +
glycogen, so a single blip could flip the verdict.

**Fix.** `computeWeightTrendCopy` (`weightTrendTile.ts`) now judges the
**smoothed** trend: interpolate the window's weigh-ins to a daily series and
EMA-smooth (α = 0.1, the TrendWeight / Hacker's Diet standard the audit cites),
then difference the trend at the recent vs comparison dates. The **headline
delta the user sees stays raw** (it must match what they'd read off their own
scale); only the verdict is smoothed. Smoothing engages at **≥ 3 weigh-ins**
(with only two readings there's no surrounding context to tell a blip from a
real move, so the long-standing two-point behaviour is preserved).

**Surface scope — corrected by ENG-1039 (2026-06-11).** The original note here
said the raw-delta noise bug was "web-only" because mobile Progress shows
`weekDeltaKg` + the goal-date label rather than this on-track copy. That was
wrong about the *class*: the goal-date label is driven by
`calcGoalTimeline().weeklyRateKg`, which was **itself** a raw two-point delta —
on **both** platforms. So the same noise lived in the goal date and in the
projection override on mobile and web. ENG-1039 fixes that path; see below.
`computeWeightTrendCopy` (this helper) is still the web Trend-tile copy; if
mobile adopts it, it gets the smoothed verdict for free.

**Pinned by** `tests/unit/weightTrendTile.test.ts` — water-blip fixtures (one
+1 kg spike on a flat/declining trend must NOT flip the copy).

## ENG-1039 — `calcGoalTimeline` weekly rate was a raw two-point delta (audit 2026-06-11 P1-4)

**Problem.** `calcGoalTimeline().weeklyRateKg` was computed from the **raw**
first-vs-last weigh-in in the 28-day window — no smoothing. That rate (a) sets
the days-to-goal **date** and (b) feeds `projectWeight({ observedKgPerWeek })`,
which **overrides** the formula projection when `|rate| ≥ 0.05`. Raw scale
weight swings 1–2 kg/day on water + glycogen, so one noisy endpoint could swing
the projected goal date by months and flip the trajectory. Identical class to
ENG-1026 — and live on **both** web (ProgressDashboard / Targets / trajectory
card) and mobile (`progress.tsx`), because both import the same shared
`calcGoalTimeline`.

**Fix.** A new shared module `src/lib/nutrition/weightTrendSmoothing.ts` holds
the canonical smoothing model. The on-track tile and the goal-date timeline both
consume it, but with **different exports for different needs**:

- `smoothedTrendByDate` (EMA, interpolate-to-daily, α = 0.1) — used by the
  on-track tile, which reads only the trend's **direction** (EMA lag is
  harmless there). This is the exact ENG-1026 model, lifted out of
  `weightTrendTile.ts` so it's no longer a private duplicate.
- `smoothedWeeklyRateKg` (least-squares slope ×7) — used by the timeline, which
  needs the rate's **magnitude** to compute a date. EMA lag would understate a
  short-window rate and push the date too far out, so least-squares (the same
  unbiased best-fit model `adaptiveTdee.ts` already trusts) is the right tool:
  it recovers the true rate on a clean series yet bounds a single endpoint
  spike's leverage to ~1/N.

Smoothing engages at **≥3 weigh-ins** (`MIN_WEIGH_INS_FOR_SMOOTHING`); below
that (2 readings, no surrounding context to damp a blip) it falls back to the
**raw two-point delta** — the prior behaviour — so first-week users still get a
date.

**Parity.** Both platforms run the identical shared `calcGoalTimeline` →
`smoothedWeeklyRateKg`. Mobile imports it via `@suppr/shared/weightProjection`.
Byte-identical output for the same series is parity-by-construction.

**Pinned by** `tests/unit/weightTrendSmoothing.test.ts` (the smoother) and
`tests/unit/calcGoalTimelineSmoothing.test.ts` — a single +1 kg water spike on
the latest weigh-in must NOT flip the trend or null the goal date, and the
smoothed spiked rate must stay far closer to the clean rate than a raw
two-point delta (~3× error) would.

## ENG-1027 — safety floor acknowledge-to-proceed + sex-aware check-in floor (audit #5, #24)

**Problem.** Below the 1200F/1500M floor the pace editor soft-warned only — the
user could scroll past and save. And the weekly check-in's suggested-target
floor was a flat 1200 unisex, which our own safety classifier flags as a
"warning" for men.

**Fix.**
- **Acknowledge step** (Cronometer pattern — explicit confirm, honest copy,
  body-neutral, no shaming, names NHS/NIH, gives the user agency). The shared
  gate (`canSaveBelowFloor`) + copy (`SAFETY_ACK_TITLE` / `safetyAckBody` /
  `SAFETY_ACK_CONFIRM_LABEL`) live in `goalEditorPace.ts` so web
  (`goal-pace-editor-dialog.tsx`) and mobile (`GoalPaceEditorSheet.tsx`) can't
  drift. Save is disabled until the box is ticked; the commit path is guarded
  too; the acknowledgment is dropped the moment the target rises back above the
  floor (so a stale tick can't cover a further pace cut). A
  `belowFloorAcknowledged` analytics property is emitted on `goal_pace_adjusted`.
- **Sex-aware check-in floor** — `suggestedTargetFloorFor(sex)` in
  `weeklyCheckin.ts` (1500 M / 1200 F / 1350 unspecified); `sex` is wired
  through both Today call sites. Optional for back-compat (no sex → historical
  1200).

We kept the soft-warn (it has precedent at the higher-trust end of the market)
and did NOT hard-refuse like MFP / Lose It — the acknowledge tap closes the gap
without paternalistic blocking.

**Pinned by** `tests/unit/goalEditorPace.test.ts` (gate + copy) +
`tests/unit/weeklyCheckin.test.ts` (sex-aware floor).

## ENG-1028 — autophagy copy (audit #6)

**Problem.** The 24–36h fasting line ("Autophagy may engage as the fast
extends") implied a personal physiological claim. Human autophagy timing is not
established — the evidence is mostly animal — making it the app's highest
claims-risk line.

**Fix.** Reworded to **population framing**: "In studies — mostly in animals —
autophagy may increase around this point." Added a one-line **"how we know
this"** disclosure (`fastingStageDisclosure`) shown beneath the narrative for
the autophagy stage only, stating that human timing isn't established. No
human-benefit claims; stage structure unchanged. Surfaced on both fasting
screens (`FastingTimer.tsx` web, `fasting.tsx` mobile).

**Pinned by** `tests/unit/fastingStageNarrative.test.ts`.

## ENG-1029 — projection horizon guard (audit #7)

**Problem.** The linear 7700 kcal/kg projection is correct at the 5-week cap but
over-estimates loss over long horizons (Hall 2013). Nothing stopped a future
caller stretching the horizon.

**Fix.** `assertLinearHorizon(weeksOut, usingObservedTrend)` +
`MAX_LINEAR_PROJECTION_WEEKS = 5` in `weightProjection.ts`. The linear formula
path past 5 weeks **throws in development** (a new caller trips a test loudly)
and is **clamped in production**. The observed-trend path is exempt (a measured
rate over a longer window is a real signal). No behaviour change for the
existing 5-week production path.

**Pinned by** `tests/unit/weightProjection.test.ts`.

---

## Parity

- **ENG-1025 / 1028 / 1029** — shared pure helpers; web + mobile read the same
  code, no platform divergence.
- **ENG-1027** — acknowledge step + copy shipped on BOTH the web dialog and the
  mobile sheet from one shared gate/copy module; sex wired through both Today
  call sites.
- **ENG-1026** — web-only by design (mobile Progress uses a different
  on-track surface; documented above — not drift).
