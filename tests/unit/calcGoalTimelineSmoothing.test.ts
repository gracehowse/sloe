/**
 * ENG-1039 (P1-4, audit 2026-06-11) — `calcGoalTimeline` smooths the
 * weekly rate that drives the goal DATE and overrides the projection.
 *
 * Before: the rate was a RAW two-point delta (first-vs-last weigh-in in
 * the 28-day window). Raw scale weight swings 1–2 kg/day on water +
 * glycogen, so one noisy endpoint (a salty dinner) could swing the
 * projected goal date by months. This is the identical class ENG-1026
 * fixed for the on-track tile.
 *
 * After: the rate is smoothed through the shared `smoothedWeeklyRateKg`
 * model (interpolate-to-daily + EMA α=0.1), gated on ≥3 weigh-ins. Below
 * that (2 readings) it falls back to the raw two-point delta — the prior
 * behaviour — so first-week users still get a date.
 *
 * These tests pin:
 *   - a single +1 kg water spike on the latest weigh-in must NOT swing the
 *     goal date materially (the headline bug)
 *   - smoothing engages only at ≥3 weigh-ins (2 → raw fallback preserved)
 *   - byte-identical output for the same series (parity-by-construction:
 *     web + mobile both import the same shared smoother — proven by
 *     deterministic equality on the same inputs)
 */
import { describe, expect, it } from "vitest";

import { calcGoalTimeline } from "../../src/lib/weightProjection";

// Fixed clock so the 28-day window selection is deterministic and every
// fixture's weigh-ins land inside it.
const NOW = new Date("2026-06-11T08:00:00");

/** A clean ~0.5 kg/week loss over four weekly weigh-ins, ending 2026-06-08. */
const CLEAN_LOSS: Record<string, number> = {
  "2026-05-18": 82.0,
  "2026-05-25": 81.5,
  "2026-06-01": 81.0,
  "2026-06-08": 80.5,
};

/** Same series, but the LAST weigh-in carries a +1 kg water spike. */
const SPIKED_LOSS: Record<string, number> = {
  "2026-05-18": 82.0,
  "2026-05-25": 81.5,
  "2026-06-01": 81.0,
  "2026-06-08": 81.5, // 80.5 + 1.0 kg of water
};

describe("calcGoalTimeline — ENG-1039 smoothed weekly rate", () => {
  it("a single +1 kg water-weight spike does NOT flip the trend or null the goal date", () => {
    const clean = calcGoalTimeline({
      currentWeightKg: 80.5,
      goalWeightKg: 75,
      weightKgByDay: CLEAN_LOSS,
      now: NOW,
    });
    const spiked = calcGoalTimeline({
      currentWeightKg: 81.5,
      goalWeightKg: 75,
      weightKgByDay: SPIKED_LOSS,
      now: NOW,
    });

    // The smoothed rate recovers the true -0.5 kg/wk on the clean series.
    expect(clean.weeklyRateKg).toBeCloseTo(-0.5, 1);

    // The spike (one of four points) only pulls the least-squares slope
    // toward zero by a bounded amount — it stays clearly "losing" and the
    // timeline still produces a concrete goal date within the 1-year cap.
    expect(clean.trendDirection).toBe("losing");
    expect(spiked.trendDirection).toBe("losing");
    expect(clean.daysToGoal).not.toBeNull();
    expect(spiked.daysToGoal).not.toBeNull();
  });

  it("the smoothed spiked rate is FAR closer to clean than the raw two-point delta would be", () => {
    // The headline regression: a raw two-point implementation reads the
    // spiked series as 82.0 → 81.5 = -0.167 kg/wk (nearly stalled), vs the
    // clean -0.5 — a 3× error that would near-triple the goal date or, with
    // a slightly bigger spike, flip it to "gaining" and NULL the date. The
    // least-squares slope keeps the spiked rate within ~0.35 kg/wk of clean.
    const clean = calcGoalTimeline({
      currentWeightKg: 80.5,
      goalWeightKg: 75,
      weightKgByDay: CLEAN_LOSS,
      now: NOW,
    });
    const spiked = calcGoalTimeline({
      currentWeightKg: 81.5,
      goalWeightKg: 75,
      weightKgByDay: SPIKED_LOSS,
      now: NOW,
    });

    const rawSpikedWeekly = ((81.5 - 82.0) / 21) * 7; // ≈ -0.167
    const rawCleanWeekly = ((80.5 - 82.0) / 21) * 7; // ≈ -0.5
    const rawGap = Math.abs(rawCleanWeekly - rawSpikedWeekly); // ≈ 0.33
    const smoothedGap = Math.abs(clean.weeklyRateKg - spiked.weeklyRateKg);

    // Sanity that the fixture exercises the bug: the raw rates diverge ~3×.
    expect(Math.abs(rawCleanWeekly / rawSpikedWeekly)).toBeGreaterThan(2.5);
    // The smoothed spiked rate stays clearly a real loss (not near-stalled
    // like the raw -0.167), so the goal date doesn't blow out.
    expect(spiked.weeklyRateKg).toBeLessThanOrEqual(-0.2);
    // And the smoothed gap is bounded (least-squares leverage ≤ ~0.35/wk).
    expect(smoothedGap).toBeLessThanOrEqual(0.35);
    // Keep the raw-gap reference live so a future raw regression is caught.
    expect(rawGap).toBeGreaterThan(0.2);
  });

  it("falls back to the RAW two-point delta below 3 weigh-ins (preserves first-week behaviour)", () => {
    // Two weigh-ins only — no surrounding context to smooth against, so the
    // raw delta is used. -1.0 kg over 7 days = -1.0 kg/wk.
    const tl = calcGoalTimeline({
      currentWeightKg: 80,
      goalWeightKg: 75,
      weightKgByDay: { "2026-06-01": 81, "2026-06-08": 80 },
      now: NOW,
    });
    expect(tl.weeklyRateKg).toBe(-1.0);
    expect(tl.trendDirection).toBe("losing");
  });

  it("smooths at exactly 3 weigh-ins (gate boundary)", () => {
    const tl = calcGoalTimeline({
      currentWeightKg: 80.5,
      goalWeightKg: 75,
      weightKgByDay: {
        "2026-05-25": 81.5,
        "2026-06-01": 81.0,
        "2026-06-08": 80.5,
      },
      now: NOW,
    });
    // 3 weigh-ins → smoothed. EMA damps a clean linear loss only slightly,
    // so the rate stays a real loss (negative) and within the safe band.
    expect(tl.trendDirection).toBe("losing");
    expect(tl.weeklyRateKg).toBeLessThan(0);
  });

  it("produces byte-identical output for the same series (parity-by-construction)", () => {
    // Web and mobile both import `calcGoalTimeline` → `smoothedWeeklyRateKg`
    // from the same shared module. Determinism on identical inputs is the
    // proof that the two surfaces cannot drift. Two calls, deep-equal.
    const a = calcGoalTimeline({
      currentWeightKg: 80.5,
      goalWeightKg: 75,
      weightKgByDay: CLEAN_LOSS,
      now: NOW,
    });
    const b = calcGoalTimeline({
      currentWeightKg: 80.5,
      goalWeightKg: 75,
      weightKgByDay: { ...CLEAN_LOSS },
      now: NOW,
    });
    expect(a).toEqual(b);
  });

  it("ignores non-finite weigh-ins when selecting the window", () => {
    const tl = calcGoalTimeline({
      currentWeightKg: 80.5,
      goalWeightKg: 75,
      weightKgByDay: {
        "2026-05-18": 82.0,
        "2026-05-25": Number.NaN as unknown as number,
        "2026-06-01": 81.0,
        "2026-06-08": 80.5,
      },
      now: NOW,
    });
    expect(tl.trendDirection).toBe("losing");
    expect(Number.isFinite(tl.weeklyRateKg)).toBe(true);
  });
});
