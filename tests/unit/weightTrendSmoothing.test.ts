/**
 * ENG-1039 — shared weight-trend smoothing model.
 *
 * Single source of truth for the on-track tile (`weightTrendTile.ts`,
 * ENG-1026) and the goal-date timeline (`calcGoalTimeline`, ENG-1039).
 * These pins lock the smoother itself so both consumers inherit a tested
 * model.
 */
import { describe, expect, it } from "vitest";

import {
  MIN_WEIGH_INS_FOR_SMOOTHING,
  smoothedTrendByDate,
  smoothedWeeklyRateKg,
} from "../../src/lib/nutrition/weightTrendSmoothing";

describe("smoothedTrendByDate", () => {
  it("returns each input date with a smoothed value", () => {
    const trend = smoothedTrendByDate([
      ["2026-06-01", 82],
      ["2026-06-08", 81],
      ["2026-06-15", 80],
    ]);
    expect(trend.has("2026-06-01")).toBe(true);
    expect(trend.has("2026-06-15")).toBe(true);
    // EMA lags a clean linear loss: the final trend sits ABOVE the final
    // raw reading (the trend hasn't fully caught up to the last point).
    expect(trend.get("2026-06-15")!).toBeGreaterThan(80);
    expect(trend.get("2026-06-15")!).toBeLessThan(82);
  });

  it("single point returns itself unsmoothed", () => {
    const trend = smoothedTrendByDate([["2026-06-01", 82]]);
    expect(trend.get("2026-06-01")).toBe(82);
  });

  it("empty series returns an empty map", () => {
    expect(smoothedTrendByDate([]).size).toBe(0);
  });
});

describe("smoothedWeeklyRateKg (least-squares slope)", () => {
  it("recovers the true rate on a clean linear loss (no lag, unlike EMA)", () => {
    // 82.0 → 80.5 over 21 days = -1.5 kg / 3 weeks = exactly -0.5 kg/wk.
    const r = smoothedWeeklyRateKg([
      ["2026-05-18", 82.0],
      ["2026-05-25", 81.5],
      ["2026-06-01", 81.0],
      ["2026-06-08", 80.5],
    ]);
    expect(r.smoothed).toBe(true);
    expect(r.weeklyRateKg).toBeCloseTo(-0.5, 5);
  });

  it("bounds a single water spike on the last reading (stays clearly losing)", () => {
    const clean = smoothedWeeklyRateKg([
      ["2026-05-18", 82.0],
      ["2026-05-25", 81.5],
      ["2026-06-01", 81.0],
      ["2026-06-08", 80.5],
    ]);
    const spiked = smoothedWeeklyRateKg([
      ["2026-05-18", 82.0],
      ["2026-05-25", 81.5],
      ["2026-06-01", 81.0],
      ["2026-06-08", 81.5], // +1 kg water
    ]);
    expect(clean.smoothed).toBe(true);
    expect(spiked.smoothed).toBe(true);
    // Both still read as a loss — the spike (one of 4 points) only pulls
    // the slope from -0.5 to ~-0.2 kg/wk, never flipping to "gaining".
    expect(clean.weeklyRateKg).toBeLessThan(0);
    expect(spiked.weeklyRateKg).toBeLessThan(0);
    // Bounded leverage: the +1 kg endpoint swing moves the weekly rate by
    // ≤ 0.35 kg/wk, versus the raw two-point delta which would have nearly
    // tripled the projected date.
    expect(Math.abs(spiked.weeklyRateKg - clean.weeklyRateKg)).toBeLessThanOrEqual(0.35);
  });

  it("falls back to the raw two-point delta with exactly 2 weigh-ins", () => {
    const r = smoothedWeeklyRateKg([
      ["2026-06-01", 81],
      ["2026-06-08", 80],
    ]);
    expect(r.smoothed).toBe(false);
    expect(r.weeklyRateKg).toBeCloseTo(-1.0, 5); // -1 kg / 7 days * 7
  });

  it("smooths at exactly the 3-weigh-in gate", () => {
    const r = smoothedWeeklyRateKg([
      ["2026-05-25", 81.5],
      ["2026-06-01", 81.0],
      ["2026-06-08", 80.5],
    ]);
    expect(r.smoothed).toBe(true);
    expect(MIN_WEIGH_INS_FOR_SMOOTHING).toBe(3);
  });

  it("returns zero for fewer than 2 weigh-ins", () => {
    expect(smoothedWeeklyRateKg([["2026-06-01", 80]])).toEqual({
      weeklyRateKg: 0,
      smoothed: false,
    });
    expect(smoothedWeeklyRateKg([])).toEqual({ weeklyRateKg: 0, smoothed: false });
  });

  it("does not divide by zero when two weigh-ins share a calendar day", () => {
    const r = smoothedWeeklyRateKg([
      ["2026-06-08", 81],
      ["2026-06-08", 80],
    ]);
    expect(Number.isFinite(r.weeklyRateKg)).toBe(true);
  });
});
