# Progress empty-state contract — nutrition-engine sign-off

**Date:** 2026-05-13
**Status:** Resolved
**Area:** Nutrition / Progress surface
**Authority:** [ENG-97](https://linear.app/suppr/issue/ENG-97/) (audit #4 of `docs/audits/2026-04-30-full-sweep-audit.md`)

## Problem

The 2026-04-30 full-sweep audit flagged the Progress tab fabricating
"Maintenance held steady · high confidence" with zero logged data,
and a weight trend rendering "55.3 kg" with zero weigh-ins. The
underlying gates were already in place — `progressStoryGate.ts`,
`adaptiveTdee.ts`, the WeightChart empty-state — but each surface
read its own literal threshold. A future regression on any one of
them could silently leak fabricated confidence into the UI again,
and the contract was never written down for the nutrition-engine
agent to enforce.

The audit asked for a documented contract with sign-off on the
minimum sample sizes before any confidence-laden language is allowed.

## Decision

Adopt **three floors**, owned by `src/lib/nutrition/progressDataContract.ts`:

| Surface                         | Threshold                                | Below: render…                              |
| ------------------------------- | ---------------------------------------- | ------------------------------------------- |
| Progress story headline + body  | `MIN_LOGGING_DAYS_FOR_STORY = 3`         | `<ProgressStoryGate>` count-up placeholder  |
| Adaptive TDEE publication       | `MIN_LOGGING_DAYS_FOR_ADAPTIVE_TDEE = 7` | Formula-estimate Maintenance card (no chip) |
|                                 | `MIN_WEIGH_INS_FOR_ADAPTIVE_TDEE = 3`    |                                             |
| Weight trend line               | `MIN_WEIGH_INS_FOR_TREND = 2`            | "No weigh-ins in this range" caption        |

These match what the codebase was already enforcing in `adaptiveTdee.ts`
(`MIN_LOGGING_DAYS = 7`, `MIN_WEIGH_INS = 3`) and `progressStoryGate.ts`
(`STORY_DATA_FLOOR_DAYS = 3`). The contract module re-exports them
under a single name so the gates can't drift.

### Rationale

- **3 days for the story** is the smallest window over which an
  observation like "this week" is honest. Below that, the user hasn't
  finished a meaningful slice of the period the headline describes.
- **7 days / 3 weigh-ins for adaptive TDEE** matches the Hall & Chow
  energy-balance model's noise floor: shorter than 7 days, the
  weight-change derivative is dominated by water/glycogen, not real
  expenditure. Three weigh-ins is the minimum for an EMA-smoothed
  trend to have direction.
- **2 weigh-ins for a trend** is the irreducible minimum for "a line
  exists" — one point is a dot, not a trend.

## Implementation

- New module: `src/lib/nutrition/progressDataContract.ts` exports the
  three thresholds + three boolean helpers
  (`hasEnoughDataForStory`, `hasEnoughDataForAdaptiveTDEE`,
  `hasEnoughWeighInsForTrend`).
- `progressStoryGate.ts` and `adaptiveTdee.ts` re-export their
  existing constants from the contract — back-compat preserved,
  drift impossible.
- `tests/unit/progressDataContract.test.ts` pins the values + the
  fail-closed posture: NaN, negative, or non-finite input always
  returns `false` (renders the placeholder, never the claim).
- `tests/unit/progressEmptyStateContract.test.ts` is the regression
  test: every Progress surface path is exercised against the
  zero-data scenario and asserts no confidence-laden copy leaks.

## Carve-outs / open

- The Maintenance card still shows a labelled **"Formula estimate"**
  pill with a kcal value when the user has profile basics but no
  logged data. This is intentional and honest: it's not a claim
  about *measured* expenditure, it's a static Mifflin–St Jeor
  projection labelled as such. The confidence-bars row is gated on
  `showAdaptiveExtras === true` so no confidence framing leaks.
- The contract intentionally does **not** govern the formula
  Maintenance card's kcal display. That falls under
  `resolveMaintenance.ts` and predates the audit; its honesty is
  enforced by the "Formula estimate" pill, not by data-floor gates.

## References

- Linear issue: [ENG-97](https://linear.app/suppr/issue/ENG-97/)
- Audit source: [docs/audits/2026-04-30-full-sweep-audit.md](../audits/2026-04-30-full-sweep-audit.md)
- Contract module: [src/lib/nutrition/progressDataContract.ts](../../src/lib/nutrition/progressDataContract.ts)
