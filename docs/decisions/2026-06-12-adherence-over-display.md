# Adherence headline: band-inverted over-target display

**Date:** 2026-06-12
**Status:** Resolved (shipped behind flag `adherence_over_display`, 0% rollout)
**Area:** Progress (web + mobile)
**Source:** Launch-readiness audit P1-3 (carried from 2026-06-11 audit P1-8); product-lead decision 2026-06-12.

## Problem

`progressRangeStats.adherencePct` is `round((avgCalories/target)*100)` **uncapped**, and the Progress headline printed it raw — a user averaging over target saw **"112% Average Adherence"**, which reads as a *better* score the further over target they are. Trust bug on the primary reflection surface.

## Decision

Band-inverted headline semantics, one shared formatter (`src/lib/nutrition/adherenceDisplay.ts`, `formatAdherenceHeadline`):

| Band | Condition | Headline | Label | Tone |
|---|---|---|---|---|
| Under | pct < 90 | `{pct}%` | Under target | success |
| On target | 90 ≤ pct ≤ 110 | `{pct}%` | On target | success |
| Over | pct > 110 | `{pct−100}% over` | Over target | **warning (amber)** |

- Above the existing 90–110% tolerance band, the metric **stops claiming to be adherence** (111% adherent is incoherent) and shows the overshoot magnitude — small-when-good, so it can never be misread as achievement. "112%" becomes **"12% over"**.
- 100–110% stays raw with "On target" — no jarring "1% over" at 101%.
- Body-neutral copy: "Over target" is a directional fact in the same register as "Under target"; amber (not destructive red) matches the macro-bar over treatment.
- **Per-macro rows intentionally unchanged** ("Carbs 104% · over") — they are a comparison grid, already honest, and inverting some rows would make the grid harder to scan.
- Rejected: cap-at-100 + badge (hides overshoot magnitude); rename-only (keeps the big-number-reads-as-good problem).
- Reconsider trigger: if the over-number being *smaller* than under-numbers confuses users (session replay / TF), switch the over band to the absolute kcal delta ("≈260 kcal over/day") — `deltaVsTargetKcal` already exists.

## Implementation

- Render sites (all four consume the shared formatter's `value`/`suffix`/`qualifier`/`tone` — no site-local copy): web `progress-hero-metric.tsx` + `progress-average-adherence.tsx`; mobile `ProgressHeroMetric.tsx` + `ProgressAverageAdherence.tsx`.
- Flag `adherence_over_display` gates ONLY the >110% branch; ≤110% renders identically in both branches, so a flag flicker can't change a healthy user's number. Old path alive in the `else`. PostHog flag created 2026-06-12 at 0% ([flag 714758](https://us.posthog.com/project/389168/feature_flags/714758)).
- `adherencePct` stays raw/uncapped in `progressRangeStats.ts` (data value; display owns presentation).
- Before/after captures: `docs/audit/captures/2026-06-12-fixes/progress-adherence-{before,after}.png`.
- Tests: `tests/unit/adherenceDisplay.test.ts` (web + mobile copies) pin all bands; wiring pins on all four render sites.
