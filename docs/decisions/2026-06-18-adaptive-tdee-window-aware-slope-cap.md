# Adaptive TDEE — window/confidence-aware slope cap (ENG-1116)

**Date:** 2026-06-18 · **Status: Resolved** · **Area:** Nutrition engine

Supersedes the **flat slope cap** half of the R2 trend rule in
`docs/decisions/2026-06-10-adaptive-tdee-gating.md`. R1 (completeness gate), R3
(plausibility bound), the sedentary seed, and the least-squares slope method are
all unchanged — this decision touches **only** the cap magnitude applied to the
slope.

Companion research:
- `docs/ux/research/2026-06-10-nutrition-calculations-audit.md` — §#1/§2, the
  "0.5 kg/week must recover ~550 kcal/day, not ~130" anchor.
- `docs/decisions/2026-06-10-adaptive-tdee-gating.md` — the original R1/R2/R3
  decision this amends.

## Problem

The 2026-06-10 gating decision clamped the weight-trend slope to a **flat
±0.35 kg/week** to reject water/glycogen noise on short windows. Applied
**unconditionally**, that cap under-credited legitimate **fast losers**:

- A real 0.5 kg/week deficit = 0.0714 kg/day. The flat cap pins it at
  0.05 kg/day → slope energy pins at **~385 kcal/day** instead of the real
  **~550**.
- TDEE ≈ intake − slope energy, so maintenance reads **~165 kcal/day too low**,
  and the suggested intake derived from it is correspondingly too low.

This is nutrition-sensitive: it tells someone losing weight fast and healthily
that their maintenance — and therefore their target — is lower than it really
is.

The flat cap was correct as a **water-noise guard on short, noisy windows** (a
couple of erratic weigh-ins early on can fake a huge slope). It was wrong as an
**unconditional** ceiling, because a slope measured over a long, well-sampled
window is trustworthy and should be surfaced in full.

## Decision

Make the slope cap **window/confidence-aware**, derived from the **same
confidence tier the estimator already computes** (gated logging days +
weigh-in count):

| Confidence | Ladder | Slope cap |
|---|---|---|
| low | < (14 days & 5 weigh-ins) | **±0.35 kg/week** (unchanged tight guard) |
| medium | ≥ 14 days & ≥ 5 weigh-ins | **±0.70 kg/week** |
| high | ≥ 21 days & ≥ 7 weigh-ins | **±1.00 kg/week** |

The cap stays **tight at low confidence** — short/noisy windows keep the exact
±0.35 water-noise protection from the 2026-06-10 decision — and only **widens
once the window is long enough to trust the slope**.

### What we deliberately did NOT do

**Raise the flat cap to 1.0.** That would re-admit water noise on short/
low-confidence windows — the exact failure the 2026-06-10 gating decision
fixed. The cap must remain tight until the window earns trust. (Naive-fix
rejected.)

## Why this is still safe

A wider slope cap is **still bounded downstream**:

- **R3 plausibility band** clamps the published estimate into
  **[0.85, 1.30] × sedentary Mifflin** and **floors at the HealthKit
  resting-energy** minimum when available. A relaxed slope can never push the
  estimate outside a person's own physiology.
- **Any R3 clamp forces confidence to `low`** and records a structured reason —
  no silent clamps. So even at high confidence with a ±1.0 cap, an estimate
  that lands outside the band is clamped and downgraded.

The wider cap therefore changes only the **in-band** behaviour: a trustworthy
fast-loss slope is surfaced in full instead of being artificially muted.

## Implementation

`src/lib/nutrition/adaptiveTdee.ts`:

- Removed the single `SLOPE_CAP_KG_PER_WEEK = 0.35` constant; added named
  exports `SLOPE_CAP_LOW_KG_PER_WEEK` (0.35), `SLOPE_CAP_MED_KG_PER_WEEK`
  (0.70), `SLOPE_CAP_HIGH_KG_PER_WEEK` (1.00).
- Added `determineAdaptiveTdeeConfidence(loggingDays, weighInCount)` and
  `selectSlopeCapKgPerWeek(confidence)` — exported so the cap and the surfaced
  confidence derive from one source of truth and can never disagree.
- **Hoisted** the confidence determination above the slope clamp so the cap can
  read it. (Confidence depends only on the gated day/weigh-in counts, both
  already known at that point, so the value is identical to the old post-clamp
  computation; the R3 clamp may still downgrade it to `low` afterward.)
- The clamp at the slope `Math.max/Math.min` now uses the selected per-tier cap
  instead of the flat constant.

Tests: `tests/unit/adaptiveTdee.test.ts` — the AUDIT-P0 anchor now asserts a
high-confidence 0.5 kg/week series recovers the real **1,800 + 550** (was the
under-read 1,800 + 385); a new low-confidence short-window case proves the
±0.35 cap still fires; a tier-pin test locks each cap magnitude + the selector;
the steep-slope cap test asserts against whichever tier its window resolves to.

## Cross-platform parity

Pure shared business logic in `src/lib/nutrition/adaptiveTdee.ts`. Mobile
imports this exact module via its path alias (no RN-native fork of the
estimator), so the change applies identically to web and mobile. No mobile
code change is required for parity — both platforms read the new tiered cap
from the one module.

## Confidence

8/10. The arithmetic is exact and bounded by R3; the only judgement call is the
specific cap magnitudes per tier (±0.7 / ±1.0), which are reasonable upper
bounds on real sustained loss/gain rates and are themselves still subject to the
R3 physiological band.
